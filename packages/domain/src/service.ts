import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  createRoomCommandSchema,
  draftMissionCommandSchema,
  confirmMissionCommandSchema,
  inviteMemberCommandSchema,
  memberDecisionCommandSchema,
  createCharterCommandSchema,
  signCharterCommandSchema,
  declineCharterCommandSchema,
  claimTaskCommandSchema,
  deliverTaskCommandSchema,
  reviewTaskCommandSchema,
  peerRatingCommandSchema,
  requesterRatingCommandSchema,
  settlementVoteCommandSchema,
  createDisputeCommandSchema,
  defaultConsensusConfig,
  defaultTimeoutRules,
  type CharterDraft,
  type RoomEvent,
  type RoomEventType,
  type RoomStatus,
  type SettlementStatus,
  type TaskStatus
} from "@agentic-room/contracts";
import { getDbPool } from "@agentic-room/db";
import { buildPaymentHandoff, signSettlementPayload } from "@agentic-room/integrations";
import { appendRoomEvent, fetchRoomEvents, verifyEventChain } from "@agentic-room/ledger";
import { computeSettlement } from "@agentic-room/settlement";
import { DomainError, InvariantError } from "./errors.js";
import { replayRoomEvents } from "./replay.js";

export type MutationResult = { ok: true; eventId: string; seq: number; roomId: string };

type JsonValue = Record<string, unknown>;

type RoomRow = {
  id: string;
  name: string;
  requester_id: string;
  coordinator_id: string;
  budget_total: string | number;
  status: RoomStatus;
  phase: string;
  execution_deadline_at: Date;
  created_at: Date;
  updated_at: Date;
};

type MissionRow = {
  room_id: string;
  raw_input: string;
  structured: JsonValue;
  confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type MemberRow = {
  room_id: string;
  member_id: string;
  identity_ref: string;
  role: string;
  status: string;
  charter_signed: boolean;
  charter_signed_at: Date | null;
  stake_locked: string | number;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type CharterRow = {
  id: string;
  room_id: string;
  version: number;
  baseline_split: Record<string, number>;
  bonus_pool_pct: string | number;
  malus_pool_pct: string | number;
  consensus_config: JsonValue;
  timeout_rules: JsonValue;
  status: string;
  sign_deadline: Date | null;
  created_at: Date;
  updated_at: Date;
};

type TaskRow = {
  id: string;
  charter_id: string;
  room_id: string;
  title: string;
  description: string;
  deliverable_spec: string;
  effort_estimate: string;
  weight: string | number;
  dependencies: string[];
  assigned_to: string | null;
  status: TaskStatus;
  claim_deadline: Date | null;
  delivery_deadline: Date | null;
  artifact_id: string | null;
  review_status: string | null;
  delivery_count: number;
  created_at: Date;
  updated_at: Date;
};

type ArtifactRow = {
  id: string;
  room_id: string;
  task_id: string;
  submitted_by: string;
  content_ref: string;
  content_type: string;
  version: number;
  review_notes: string | null;
  metadata: JsonValue;
  submitted_at: Date;
};

type SettlementProposalRow = {
  id: string;
  room_id: string;
  status: SettlementStatus;
  allocations: Record<string, number>;
  bonus_pool_used: string | number;
  malus_pool_reclaimed: string | number;
  computation_log: JsonValue;
  signature_payload: JsonValue | null;
  proposed_at: Date;
  finalized_at: Date | null;
};

type SettlementVoteRow = {
  id: string;
  proposal_id: string;
  room_id: string;
  agent_id: string;
  vote: "ACCEPT" | "REJECT" | "ABSTAIN";
  reason: string | null;
  submitted_at: Date;
};

type DisputeRow = {
  id: string;
  room_id: string;
  category: string;
  sub_type: string;
  claimant_id: string;
  respondent_id: string;
  filing_stake: string | number;
  remedy_sought: string;
  status: string;
  cooling_off_expires_at: Date;
  response_deadline_at: Date | null;
  panel_deadline_at: Date | null;
  resolution: JsonValue | null;
  created_at: Date;
  updated_at: Date;
};

type JobRow = {
  id: string;
  type: string;
  status: string;
  run_at: Date;
  payload: JsonValue;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  locked_by: string | null;
};

const OPEN_TASK_STATUSES = new Set<TaskStatus>(["OPEN", "REQUEUED", "REJECTED"]);
const TERMINAL_TASK_STATUSES = new Set<TaskStatus>(["ACCEPTED", "CANCELLED", "BLOCKED"]);
const PENDING_JOB_STATUS = "PENDING";

function now() {
  return new Date();
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function numeric(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function parseJson<T>(value: T | string): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

async function withClient<T>(handler: (client: PoolClient) => Promise<T>) {
  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loadRoom(client: PoolClient, roomId: string) {
  const room = await client.query<RoomRow>("SELECT * FROM rooms WHERE id = $1", [roomId]);
  assert(room.rows[0], `Room ${roomId} not found`);
  return room.rows[0];
}

async function loadMission(client: PoolClient, roomId: string) {
  const result = await client.query<MissionRow>("SELECT * FROM missions WHERE room_id = $1", [roomId]);
  return result.rows[0] ?? null;
}

async function loadMembers(client: PoolClient, roomId: string) {
  const result = await client.query<MemberRow>(
    "SELECT * FROM room_members WHERE room_id = $1 ORDER BY created_at ASC",
    [roomId]
  );
  return result.rows;
}

async function loadMember(client: PoolClient, roomId: string, memberId: string) {
  const result = await client.query<MemberRow>(
    "SELECT * FROM room_members WHERE room_id = $1 AND member_id = $2",
    [roomId, memberId]
  );
  return result.rows[0] ?? null;
}

async function loadLatestCharter(client: PoolClient, roomId: string) {
  const result = await client.query<CharterRow>(
    "SELECT * FROM charters WHERE room_id = $1 ORDER BY version DESC LIMIT 1",
    [roomId]
  );
  return result.rows[0]
    ? {
        ...result.rows[0],
        baseline_split: parseJson<Record<string, number>>(result.rows[0].baseline_split),
        consensus_config: parseJson<JsonValue>(result.rows[0].consensus_config),
        timeout_rules: parseJson<JsonValue>(result.rows[0].timeout_rules)
      }
    : null;
}

async function loadTasks(client: PoolClient, roomId: string, charterId?: string) {
  const result = await client.query<TaskRow>(
    charterId
      ? "SELECT * FROM charter_tasks WHERE room_id = $1 AND charter_id = $2 ORDER BY created_at ASC"
      : "SELECT * FROM charter_tasks WHERE room_id = $1 ORDER BY created_at ASC",
    charterId ? [roomId, charterId] : [roomId]
  );

  return result.rows.map((row) => ({
    ...row,
    dependencies: parseJson<string[]>(row.dependencies as unknown as string)
  }));
}

async function loadTask(client: PoolClient, roomId: string, taskId: string) {
  const result = await client.query<TaskRow>("SELECT * FROM charter_tasks WHERE room_id = $1 AND id = $2", [
    roomId,
    taskId
  ]);
  const task = result.rows[0];
  assert(task, `Task ${taskId} not found`);
  return {
    ...task,
    dependencies: parseJson<string[]>(task.dependencies as unknown as string)
  };
}

async function loadArtifact(client: PoolClient, artifactId: string) {
  const result = await client.query<ArtifactRow>("SELECT * FROM artifacts WHERE id = $1", [artifactId]);
  return result.rows[0]
    ? {
        ...result.rows[0],
        metadata: parseJson<JsonValue>(result.rows[0].metadata)
      }
    : null;
}

async function loadLatestSettlement(client: PoolClient, roomId: string) {
  const result = await client.query<SettlementProposalRow>(
    "SELECT * FROM settlement_proposals WHERE room_id = $1 ORDER BY proposed_at DESC LIMIT 1",
    [roomId]
  );
  return result.rows[0]
    ? {
        ...result.rows[0],
        allocations: parseJson<Record<string, number>>(result.rows[0].allocations),
        computation_log: parseJson<JsonValue>(result.rows[0].computation_log),
        signature_payload: result.rows[0].signature_payload
          ? parseJson<JsonValue>(result.rows[0].signature_payload)
          : null
      }
    : null;
}

async function loadSettlementVotes(client: PoolClient, proposalId: string) {
  const result = await client.query<SettlementVoteRow>(
    "SELECT * FROM settlement_votes WHERE proposal_id = $1 ORDER BY submitted_at ASC",
    [proposalId]
  );
  return result.rows;
}

async function loadDisputes(client: PoolClient, roomId: string) {
  const result = await client.query<DisputeRow>(
    "SELECT * FROM dispute_cases WHERE room_id = $1 ORDER BY created_at DESC",
    [roomId]
  );
  return result.rows.map((row) => ({
    ...row,
    resolution: row.resolution ? parseJson<JsonValue>(row.resolution) : null
  }));
}

async function enqueueJob(
  client: PoolClient,
  input: {
    type: string;
    runAt: Date;
    payload: JsonValue;
    maxAttempts?: number;
  }
) {
  await client.query(
    `
      INSERT INTO job_queue (id, type, status, run_at, payload, attempts, max_attempts)
      VALUES ($1, $2, $3, $4, $5::jsonb, 0, $6)
    `,
    [randomUUID(), input.type, PENDING_JOB_STATUS, input.runAt.toISOString(), JSON.stringify(input.payload), input.maxAttempts ?? 10]
  );
}

async function touchRoom(client: PoolClient, roomId: string, status?: RoomStatus, phase?: string) {
  if (status && phase) {
    await client.query(
      "UPDATE rooms SET status = $2, phase = $3, updated_at = NOW() WHERE id = $1",
      [roomId, status, phase]
    );
    return;
  }

  if (status) {
    await client.query("UPDATE rooms SET status = $2, updated_at = NOW() WHERE id = $1", [roomId, status]);
    return;
  }

  await client.query("UPDATE rooms SET updated_at = NOW() WHERE id = $1", [roomId]);
}

async function upsertMission(
  client: PoolClient,
  roomId: string,
  rawInput: string,
  structured: JsonValue,
  confirmedAt?: Date
) {
  await client.query(
    `
      INSERT INTO missions (room_id, raw_input, structured, confirmed_at)
      VALUES ($1, $2, $3::jsonb, $4)
      ON CONFLICT (room_id)
      DO UPDATE SET
        raw_input = EXCLUDED.raw_input,
        structured = EXCLUDED.structured,
        confirmed_at = EXCLUDED.confirmed_at,
        updated_at = NOW()
    `,
    [roomId, rawInput, JSON.stringify(structured), confirmedAt?.toISOString() ?? null]
  );
}

async function ensureMissionConfirmed(client: PoolClient, roomId: string) {
  const mission = await loadMission(client, roomId);
  assert(mission?.confirmed_at, "Mission must be confirmed before this action");
  return mission;
}

async function assertActiveMember(client: PoolClient, roomId: string, actorId: string): Promise<void> {
  const res = await client.query(
    `SELECT 1 FROM room_members WHERE room_id = $1 AND member_id = $2 AND status = 'ACTIVE'`,
    [roomId, actorId]
  );
  if ((res.rowCount ?? 0) === 0)
    throw new DomainError("NOT_A_MEMBER", `${actorId} is not an active member of room ${roomId}`);
}

async function assertActiveMemberTarget(client: PoolClient, roomId: string, memberId: string) {
  const member = await loadMember(client, roomId, memberId);
  if (!member || member.status !== "ACTIVE") {
    throw new DomainError("NOT_A_MEMBER", `${memberId} is not an active member of room ${roomId}`);
  }
  return member;
}

async function assertRequester(client: PoolClient, roomId: string, actorId: string) {
  const room = await loadRoom(client, roomId);
  if (room.requester_id !== actorId) {
    throw new DomainError("UNAUTHORIZED", `${actorId} is not the requester for room ${roomId}`);
  }
  return room;
}

async function assertCoordinatorOrAdmin(
  client: PoolClient,
  roomId: string,
  actorId: string,
  actorRole?: string
) {
  const room = await loadRoom(client, roomId);
  if (actorRole === "ADMIN" || room.coordinator_id === actorId) {
    return room;
  }

  const member = await loadMember(client, roomId, actorId);
  if (member?.status === "ACTIVE" && member.role === "ADMIN") {
    return room;
  }

  throw new DomainError("UNAUTHORIZED", `${actorId} is not authorized to administer room ${roomId}`);
}

async function assertCharterDeclineAuthorization(
  client: PoolClient,
  roomId: string,
  actorId: string,
  actorRole?: string
) {
  const room = await loadRoom(client, roomId);
  if (actorRole === "ADMIN" || room.requester_id === actorId || room.coordinator_id === actorId) {
    return room;
  }

  await assertActiveMember(client, roomId, actorId);
  return room;
}

async function assertReviewAuthorization(client: PoolClient, roomId: string, task: TaskRow, actorId: string) {
  const room = await loadRoom(client, roomId);
  if (task.assigned_to === actorId) {
    throw new DomainError("SELF_REVIEW_FORBIDDEN", "reviewer cannot review own task");
  }

  if (room.requester_id === actorId) {
    return room;
  }

  const member = await assertActiveMemberTarget(client, roomId, actorId);
  if (!["REVIEWER", "COORDINATOR", "ADMIN"].includes(member.role)) {
    throw new DomainError("UNAUTHORIZED", `${actorId} is not allowed to review tasks in room ${roomId}`);
  }
  return room;
}

async function assertRatingWindowOpen(client: PoolClient, roomId: string) {
  const room = await loadRoom(client, roomId);
  if (room.status === "SETTLED" || room.status === "FAILED" || room.status === "DISPUTED") {
    throw new DomainError("INVALID_STATE", `Ratings are not allowed while room is ${room.status}`);
  }

  const latestSettlement = await loadLatestSettlement(client, roomId);
  if (latestSettlement) {
    throw new DomainError("INVALID_STATE", "Ratings close once a settlement proposal exists");
  }

  const charter = await loadLatestCharter(client, roomId);
  assert(charter, "Charter is required before collecting ratings");
  const tasks = await loadTasks(client, roomId, charter.id);
  assert(
    tasks.every((task) => TERMINAL_TASK_STATUSES.has(task.status)),
    "Ratings are only allowed after execution closes"
  );

  return { room, charter, tasks };
}

const EXECUTION_BLOCKING_STATUSES = ["COOLING_OFF", "OPEN", "PANEL_ASSIGNED", "UNDER_REVIEW"] as const;

async function ensureNoBlockingDisputes(client: PoolClient, roomId: string) {
  const res = await client.query(
    `SELECT 1 FROM dispute_cases WHERE room_id = $1 AND status = ANY($2) LIMIT 1`,
    [roomId, EXECUTION_BLOCKING_STATUSES]
  );
  if ((res.rowCount ?? 0) > 0)
    throw new DomainError("OPEN_DISPUTE_EXISTS", "Room has an active dispute blocking execution");
}

async function ensureNoOpenDisputes(client: PoolClient, roomId: string) {
  const res = await client.query(
    `SELECT 1 FROM dispute_cases WHERE room_id = $1 AND status != 'RESOLVED' LIMIT 1`,
    [roomId]
  );
  if ((res.rowCount ?? 0) > 0)
    throw new DomainError("OPEN_DISPUTE_EXISTS", "Room has an unresolved dispute");
}

// BUG-01: DFS cycle detection for task dependency DAGs.
function detectCycle(tasks: Array<{ id: string; dependencies?: string[] }>): string | null {
  const adj = new Map<string, string[]>();
  for (const t of tasks) adj.set(t.id, t.dependencies ?? []);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adj.keys()) color.set(id, WHITE);
  function dfs(node: string): string | null {
    color.set(node, GRAY);
    for (const dep of adj.get(node) ?? []) {
      if (!adj.has(dep)) continue;
      if (color.get(dep) === GRAY) return `${node} → ${dep}`;
      if (color.get(dep) === WHITE) {
        const r = dfs(dep);
        if (r) return r;
      }
    }
    color.set(node, BLACK);
    return null;
  }
  for (const id of adj.keys()) {
    if (color.get(id) === WHITE) {
      const c = dfs(id);
      if (c) return c;
    }
  }
  return null;
}

function assertTaskWeights(tasks: CharterDraft["tasks"]) {
  const total = tasks.reduce((value, task) => value + task.weight, 0);
  assert(Math.abs(total - 100) < 0.0001, `Task weights must sum to 100, received ${total}`);
}

function assertBaselineSplit(split: Record<string, number>) {
  const total = Object.values(split).reduce((value, item) => value + item, 0);
  assert(Math.abs(total - 1) < 0.0001, `Baseline split must sum to 1.0, received ${total}`);
}

async function maybeFinalizeCharter(client: PoolClient, roomId: string, charterId: string, actorId: string) {
  const members = await loadMembers(client, roomId);
  const activeMembers = members.filter((member) => member.status === "ACTIVE");
  const allSigned = activeMembers.length > 0 && activeMembers.every((member) => member.charter_signed);

  if (!allSigned) {
    return false;
  }

  await client.query("UPDATE charters SET status = 'SIGNED', updated_at = NOW() WHERE id = $1", [charterId]);
  await touchRoom(client, roomId, "ACTIVE", "2");
  await appendRoomEvent(client, {
    roomId,
    eventType: "CHARTER_SIGNED",
    actorId,
    payload: { charterId }
  });
  await appendRoomEvent(client, {
    roomId,
    eventType: "ROOM_ACTIVATED",
    actorId,
    payload: { charterId }
  });
  await enqueueTaskClaimTimeouts(client, roomId, charterId, actorId);
  return true;
}

async function enqueueTaskClaimTimeouts(
  client: PoolClient,
  roomId: string,
  charterId: string,
  actorId: string
) {
  const charter = await loadLatestCharter(client, roomId);
  const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
  const claimDeadline = addHours(now(), timeoutRules.taskClaimWindowHours);
  const tasks = await loadTasks(client, roomId, charterId);

  for (const task of tasks.filter((item) => OPEN_TASK_STATUSES.has(item.status))) {
    await enqueueJob(client, {
      type: "TASK_CLAIM_TIMEOUT",
      runAt: claimDeadline,
      payload: {
        roomId,
        taskId: task.id,
        actorId,
        extensionCount: 0
      }
    });
  }
}

async function markRoomFailed(client: PoolClient, roomId: string, actorId: string, reason: string) {
  await touchRoom(client, roomId, "FAILED", "5");
  await appendRoomEvent(client, {
    roomId,
    eventType: "ROOM_FAILED",
    actorId,
    payload: { reason }
  });
}

export async function createRoom(input: unknown) {
  const command = createRoomCommandSchema.parse(input);

  return withClient(async (client) => {
    const roomId = randomUUID();
    await client.query(
      `
        INSERT INTO rooms (
          id, name, requester_id, coordinator_id, budget_total, status, phase, execution_deadline_at
        )
        VALUES ($1, $2, $3, $4, $5, 'FORMING', '0', $6)
      `,
      [roomId, command.name, command.requesterId, command.coordinatorId, command.budgetTotal, command.executionDeadlineAt]
    );

    await client.query(
      `
        INSERT INTO room_members (
          room_id, member_id, identity_ref, role, status, joined_at
        )
        VALUES ($1, $2, $3, 'COORDINATOR', 'ACTIVE', NOW())
      `,
      [roomId, command.coordinatorId, command.coordinatorId]
    );

    await appendRoomEvent(client, {
      roomId,
      eventType: "ROOM_CREATED",
      actorId: command.actorId,
      payload: {
        name: command.name,
        requesterId: command.requesterId,
        coordinatorId: command.coordinatorId,
        budgetTotal: command.budgetTotal,
        executionDeadlineAt: command.executionDeadlineAt
      }
    });
    const createRoomEvent = await appendRoomEvent(client, {
      roomId,
      eventType: "MEMBER_JOINED",
      actorId: command.actorId,
      payload: {
        memberId: command.coordinatorId,
        identityRef: command.coordinatorId,
        role: "COORDINATOR"
      }
    });

    await enqueueJob(client, {
      type: "ROOM_EXECUTION_DEADLINE",
      runAt: new Date(command.executionDeadlineAt),
      payload: { roomId, actorId: command.actorId }
    });

    return { ok: true as const, eventId: createRoomEvent.id, seq: createRoomEvent.seq, roomId };
  });
}

export async function draftMission(input: unknown) {
  const command = draftMissionCommandSchema.parse(input);

  return withClient(async (client) => {
    await loadRoom(client, command.roomId);
    await upsertMission(client, command.roomId, command.rawInput, command.structured);
    await touchRoom(client, command.roomId, "FORMING", "0");
    const draftMissionEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "MISSION_DRAFTED",
      actorId: command.actorId,
      payload: {
        rawInput: command.rawInput,
        structured: command.structured
      }
    });
    return { ok: true as const, eventId: draftMissionEvent.id, seq: draftMissionEvent.seq, roomId: command.roomId };
  });
}

export async function confirmMission(input: unknown) {
  const command = confirmMissionCommandSchema.parse(input);

  return withClient(async (client) => {
    await loadRoom(client, command.roomId);
    await upsertMission(client, command.roomId, command.rawInput, command.structured, now());
    await touchRoom(client, command.roomId, "PENDING_CHARTER", "1");
    const confirmMissionEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "MISSION_CONFIRMED",
      actorId: command.actorId,
      payload: {
        rawInput: command.rawInput,
        structured: command.structured
      }
    });
    return { ok: true as const, eventId: confirmMissionEvent.id, seq: confirmMissionEvent.seq, roomId: command.roomId };
  });
}

export async function inviteMember(input: unknown) {
  const command = inviteMemberCommandSchema.parse(input);

  return withClient(async (client) => {
    await ensureMissionConfirmed(client, command.roomId);
    await assertCoordinatorOrAdmin(client, command.roomId, command.actorId, command.actorRole);
    await client.query(
      `
        INSERT INTO room_members (room_id, member_id, identity_ref, role, status)
        VALUES ($1, $2, $3, $4, 'INVITED')
        ON CONFLICT (room_id, member_id)
        DO UPDATE SET identity_ref = EXCLUDED.identity_ref, role = EXCLUDED.role, status = 'INVITED', updated_at = NOW()
      `,
      [command.roomId, command.memberId, command.identityRef, command.role]
    );
    const inviteEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "MEMBER_INVITED",
      actorId: command.actorId,
      payload: {
        memberId: command.memberId,
        identityRef: command.identityRef,
        role: command.role
      }
    });
    const existingInvitationTimeout = await client.query(
      `
        SELECT 1
        FROM job_queue
        WHERE type = 'INVITATION_TIMEOUT'
          AND status IN ('PENDING', 'RUNNING')
          AND payload->>'roomId' = $1
        LIMIT 1
      `,
      [command.roomId]
    );
    if ((existingInvitationTimeout.rowCount ?? 0) === 0) {
      await enqueueJob(client, {
        type: "INVITATION_TIMEOUT",
        runAt: addHours(now(), defaultTimeoutRules.invitationWindowHours),
        payload: {
          roomId: command.roomId,
          actorId: command.actorId
        }
      });
    }
    return { ok: true as const, eventId: inviteEvent.id, seq: inviteEvent.seq, roomId: command.roomId };
  });
}

async function updateMemberDecision(
  client: PoolClient,
  input: ReturnType<typeof memberDecisionCommandSchema.parse>,
  status: "ACTIVE" | "DECLINED",
  eventType: RoomEventType
) {
  assert(input.actorId === input.memberId, "Only the invited member can accept or decline");
  const member = await client.query<MemberRow>(
    "SELECT * FROM room_members WHERE room_id = $1 AND member_id = $2",
    [input.roomId, input.memberId]
  );
  assert(member.rows[0], `Member ${input.memberId} not found`);

  await client.query(
    `
      UPDATE room_members
      SET status = $3, joined_at = CASE WHEN $3 = 'ACTIVE' THEN NOW() ELSE joined_at END, updated_at = NOW()
      WHERE room_id = $1 AND member_id = $2
    `,
    [input.roomId, input.memberId, status]
  );

  return appendRoomEvent(client, {
    roomId: input.roomId,
    eventType,
    actorId: input.actorId,
    payload: {
      memberId: input.memberId
    }
  });
}

export async function acceptMemberInvitation(input: unknown) {
  const command = memberDecisionCommandSchema.parse(input);

  return withClient(async (client) => {
    const event = await updateMemberDecision(client, command, "ACTIVE", "MEMBER_JOINED");
    return { ok: true as const, eventId: event.id, seq: event.seq, roomId: command.roomId };
  });
}

export async function declineMemberInvitation(input: unknown) {
  const command = memberDecisionCommandSchema.parse(input);

  return withClient(async (client) => {
    const event = await updateMemberDecision(client, command, "DECLINED", "MEMBER_DECLINED");
    return { ok: true as const, eventId: event.id, seq: event.seq, roomId: command.roomId };
  });
}

export async function createCharter(input: unknown) {
  const command = createCharterCommandSchema.parse(input);

  return withClient(async (client) => {
    await ensureMissionConfirmed(client, command.roomId);
    const room = await loadRoom(client, command.roomId);
    const latestCharter = await loadLatestCharter(client, command.roomId);
    const nextVersion = (latestCharter?.version ?? 0) + 1;

    assert(nextVersion <= 3, "Maximum charter rounds exceeded");
    assertTaskWeights(command.draft.tasks);
    assertBaselineSplit(command.draft.baselineSplit);
    // BUG-01: reject charters with circular task dependencies before any DB writes.
    const cycle = detectCycle(command.draft.tasks.map((t) => ({ id: t.id ?? "", dependencies: t.dependencies })));
    if (cycle) throw new DomainError(`Task dependency cycle detected: ${cycle}`, "DAG_CYCLE_DETECTED");

    const timeoutRules = {
      ...defaultTimeoutRules,
      ...(command.draft.timeoutRules ?? {})
    };
    const consensusConfig = {
      ...defaultConsensusConfig,
      ...(command.draft.consensusConfig ?? {})
    };
    const signDeadline = addHours(now(), timeoutRules.charterSignWindowHours);
    const charterId = randomUUID();
    const preparedTasks = command.draft.tasks.map((task) => ({
      ...task,
      id: task.id ?? randomUUID()
    }));

    await client.query(
      `
        INSERT INTO charters (
          id, room_id, version, baseline_split, bonus_pool_pct, malus_pool_pct,
          consensus_config, timeout_rules, status, sign_deadline
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, 'DRAFT', $9)
      `,
      [
        charterId,
        command.roomId,
        nextVersion,
        JSON.stringify(command.draft.baselineSplit),
        command.draft.bonusPoolPct,
        command.draft.malusPoolPct,
        JSON.stringify(consensusConfig),
        JSON.stringify(timeoutRules),
        signDeadline.toISOString()
      ]
    );

    for (const task of preparedTasks) {
      await client.query(
        `
          INSERT INTO charter_tasks (
            id, charter_id, room_id, title, description, deliverable_spec,
            effort_estimate, weight, dependencies, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'OPEN')
        `,
        [
          task.id,
          charterId,
          command.roomId,
          task.title,
          task.description,
          task.deliverableSpec,
          task.effortEstimate,
          task.weight,
          JSON.stringify(task.dependencies)
        ]
      );
    }

    await client.query(
      "UPDATE room_members SET charter_signed = FALSE, charter_signed_at = NULL, updated_at = NOW() WHERE room_id = $1 AND status = 'ACTIVE'",
      [command.roomId]
    );
    await touchRoom(client, command.roomId, "PENDING_CHARTER", "1");

    const charterProposedEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "CHARTER_PROPOSED",
      actorId: command.actorId,
      payload: {
        charterId,
        version: nextVersion,
        roomBudgetTotal: numeric(room.budget_total),
        baselineSplit: command.draft.baselineSplit,
        bonusPoolPct: command.draft.bonusPoolPct,
        malusPoolPct: command.draft.malusPoolPct,
        consensusConfig,
        timeoutRules,
        tasks: preparedTasks
      }
    });

    await enqueueJob(client, {
      type: "CHARTER_SIGN_TIMEOUT",
      runAt: signDeadline,
      payload: {
        roomId: command.roomId,
        charterId,
        actorId: command.actorId,
        version: nextVersion
      }
    });

    return { ok: true as const, eventId: charterProposedEvent.id, seq: charterProposedEvent.seq, roomId: command.roomId };
  });
}

export async function signCharter(input: unknown) {
  const command = signCharterCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertActiveMember(client, command.roomId, command.actorId);
    await ensureMissionConfirmed(client, command.roomId);
    const charter = await loadLatestCharter(client, command.roomId);
    assert(charter?.id === command.charterId, "Can only sign the latest charter");
    assert(charter.status === "DRAFT", "Charter is not open for signature");

    await client.query(
      `
        UPDATE room_members
        SET charter_signed = TRUE, charter_signed_at = NOW(), updated_at = NOW()
        WHERE room_id = $1 AND member_id = $2 AND status = 'ACTIVE'
      `,
      [command.roomId, command.actorId]
    );
    const signEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "CHARTER_SIGNATURE_RECORDED",
      actorId: command.actorId,
      payload: {
        charterId: command.charterId,
        memberId: command.actorId
      }
    });

    await maybeFinalizeCharter(client, command.roomId, command.charterId, command.actorId);
    return { ok: true as const, eventId: signEvent.id, seq: signEvent.seq, roomId: command.roomId };
  });
}

export async function declineCharter(input: unknown) {
  const command = declineCharterCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertCharterDeclineAuthorization(client, command.roomId, command.actorId, command.actorRole);
    const charter = await loadLatestCharter(client, command.roomId);
    assert(charter?.id === command.charterId, "Can only decline the latest charter");
    assert(charter.status === "DRAFT", "Charter is not open for decline");

    await client.query("UPDATE charters SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", [command.charterId]);
    await touchRoom(client, command.roomId, "PENDING_CHARTER", "1");
    const declineEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "CHARTER_DECLINED",
      actorId: command.actorId,
      payload: {
        charterId: command.charterId,
        reason: command.reason
      }
    });

    if ((charter?.version ?? 0) >= 3) {
      await markRoomFailed(client, command.roomId, command.actorId, "Charter declined after maximum rounds");
    }

    return { ok: true as const, eventId: declineEvent.id, seq: declineEvent.seq, roomId: command.roomId };
  });
}

function ensureDependenciesAccepted(tasks: TaskRow[], targetTask: TaskRow) {
  assert(areDependenciesAccepted(tasks, targetTask), `Dependencies must be accepted before claiming ${targetTask.id}`);
}

function areDependenciesAccepted(tasks: TaskRow[], targetTask: TaskRow) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const dependencyId of targetTask.dependencies) {
    const dependency = byId.get(dependencyId);
    if (!dependency || dependency.status !== "ACCEPTED") {
      return false;
    }
  }
  return true;
}

export async function claimTask(input: unknown) {
  const command = claimTaskCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertActiveMember(client, command.roomId, command.actorId);
    await ensureNoBlockingDisputes(client, command.roomId);
    const room = await loadRoom(client, command.roomId);
    assert(room.status === "ACTIVE", "Room must be active before claiming tasks");
    const charter = await loadLatestCharter(client, command.roomId);
    const tasks = await loadTasks(client, command.roomId, charter?.id);
    const task = tasks.find((item) => item.id === command.taskId);
    assert(task, `Task ${command.taskId} not found`);
    assert(OPEN_TASK_STATUSES.has(task.status), `Task ${command.taskId} is not claimable`);
    ensureDependenciesAccepted(tasks, task);
    // BUG-03: Lock the task row to prevent two agents claiming the same task concurrently.
    // The SELECT ... FOR UPDATE blocks until any concurrent transaction holding the row lock
    // commits or rolls back, then re-checks status before the UPDATE below.
    const locked = await client.query<{ status: string }>(
      `SELECT status FROM charter_tasks WHERE room_id = $1 AND id = $2 FOR UPDATE`,
      [command.roomId, command.taskId]
    );
    assert(locked.rows[0] && OPEN_TASK_STATUSES.has(locked.rows[0].status as TaskStatus),
      `Task ${command.taskId} is not claimable (concurrent claim may have won)`);
    const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
    const deliveryDeadline = addHours(
      now(),
      timeoutRules.taskDeliveryWindowHours ?? timeoutRules.taskClaimWindowHours
    );

    await client.query(
      `
        UPDATE charter_tasks
        SET assigned_to = $3, status = 'CLAIMED', claim_deadline = NOW(), delivery_deadline = $4, updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [command.roomId, command.taskId, command.actorId, deliveryDeadline.toISOString()]
    );
    await client.query(
      `
        UPDATE room_members
        SET stake_locked = stake_locked + $3, updated_at = NOW()
        WHERE room_id = $1 AND member_id = $2
      `,
      [command.roomId, command.actorId, numeric(task.weight)]
    );
    const claimEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "TASK_CLAIMED",
      actorId: command.actorId,
      payload: {
        taskId: command.taskId,
        assignedTo: command.actorId,
        deliveryDeadlineAt: deliveryDeadline.toISOString()
      }
    });
    await enqueueJob(client, {
      type: "TASK_DELIVERY_TIMEOUT",
      runAt: deliveryDeadline,
      payload: { roomId: command.roomId, taskId: command.taskId, actorId: command.actorId }
    });

    return { ok: true as const, eventId: claimEvent.id, seq: claimEvent.seq, roomId: command.roomId };
  });
}

export async function unclaimTask(input: { roomId: string; taskId: string; actorId: string }) {
  return withClient(async (client) => {
    const task = await loadTask(client, input.roomId, input.taskId);
    assert(task.status === "CLAIMED", "Only claimed tasks can be unclaimed");
    assert(task.assigned_to === input.actorId, "Only the assignee can unclaim the task");

    await client.query(
      `
        UPDATE charter_tasks
        SET assigned_to = NULL, status = 'REQUEUED', claim_deadline = NULL, delivery_deadline = NULL, updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [input.roomId, input.taskId]
    );
    await client.query(
      `
        UPDATE room_members
        SET stake_locked = GREATEST(stake_locked - $3 / 2, 0), updated_at = NOW()
        WHERE room_id = $1 AND member_id = $2
      `,
      [input.roomId, input.actorId, numeric(task.weight)]
    );
    await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_UNCLAIMED",
      actorId: input.actorId,
      payload: { taskId: input.taskId }
    });
    const requeueEvent = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_REQUEUED",
      actorId: input.actorId,
      payload: { taskId: input.taskId, reason: "voluntary_unclaim" }
    });
    const charter = await loadLatestCharter(client, input.roomId);
    const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
    await enqueueJob(client, {
      type: "TASK_CLAIM_TIMEOUT",
      runAt: addHours(now(), timeoutRules.taskClaimWindowHours),
      payload: {
        roomId: input.roomId,
        taskId: input.taskId,
        actorId: input.actorId,
        extensionCount: 0
      }
    });

    return { ok: true as const, eventId: requeueEvent.id, seq: requeueEvent.seq, roomId: input.roomId };
  });
}

export async function deliverTask(input: unknown) {
  const command = deliverTaskCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertActiveMember(client, command.roomId, command.actorId);
    await ensureNoBlockingDisputes(client, command.roomId);
    const task = await loadTask(client, command.roomId, command.taskId);
    assert(task.assigned_to === command.actorId, "Only the assignee can deliver the task");
    assert(task.status === "CLAIMED" || task.status === "REJECTED", "Task must be claimed or rejected before delivery");
    const charter = await loadLatestCharter(client, command.roomId);
    const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
    const artifactId = randomUUID();
    const version = (task.delivery_count ?? 0) + 1;
    const reviewDeadline = addHours(now(), timeoutRules.reviewWindowHours);

    await client.query(
      `
        INSERT INTO artifacts (
          id, room_id, task_id, submitted_by, content_ref, content_type, version, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        artifactId,
        command.roomId,
        command.taskId,
        command.actorId,
        command.contentRef,
        command.contentType,
        version,
        JSON.stringify({ reviewDeadlineAt: reviewDeadline.toISOString(), reviewTimeoutExtensions: 0 })
      ]
    );

    await client.query(
      `
        UPDATE charter_tasks
        SET status = 'DELIVERED',
            artifact_id = $3,
            review_status = 'PENDING',
            delivery_count = delivery_count + 1,
            updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [command.roomId, command.taskId, artifactId]
    );
    await touchRoom(client, command.roomId, "IN_REVIEW", "3");
    const deliverEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "TASK_DELIVERED",
      actorId: command.actorId,
      payload: {
        taskId: command.taskId,
        artifactId,
        contentRef: command.contentRef,
        contentType: command.contentType
      }
    });
    await enqueueJob(client, {
      type: "TASK_REVIEW_TIMEOUT",
      runAt: reviewDeadline,
      payload: { roomId: command.roomId, taskId: command.taskId, artifactId, actorId: command.actorId }
    });

    return { ok: true as const, eventId: deliverEvent.id, seq: deliverEvent.seq, roomId: command.roomId };
  });
}

async function finalizeTaskReview(
  client: PoolClient,
  input: {
    roomId: string;
    taskId: string;
    actorId: string;
    verdict: "ACCEPTED" | "REJECTED";
    notes: string;
  }
) {
  const task = await loadTask(client, input.roomId, input.taskId);
  assert(task.status === "DELIVERED", "Task must be delivered before review");
  const isSystemReview = input.actorId.toLowerCase() === "system";
  if (!isSystemReview) {
    await assertReviewAuthorization(client, input.roomId, task, input.actorId);
  }

  await client.query(
    `
      INSERT INTO task_reviews (id, room_id, task_id, reviewer_id, verdict, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [randomUUID(), input.roomId, input.taskId, input.actorId, input.verdict, input.notes]
  );

  let lastEvent;
  if (input.verdict === "ACCEPTED") {
    await client.query(
      `
        UPDATE charter_tasks
        SET status = 'ACCEPTED', review_status = 'ACCEPTED', updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [input.roomId, input.taskId]
    );
    await client.query(
      `
        UPDATE room_members
        SET stake_locked = GREATEST(stake_locked - $3, 0), updated_at = NOW()
        WHERE room_id = $1 AND member_id = $2
      `,
      [input.roomId, task.assigned_to, numeric(task.weight)]
    );
    lastEvent = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_ACCEPTED",
      actorId: input.actorId,
      payload: {
        taskId: input.taskId,
        notes: input.notes
      }
    });
  } else {
    const nextStatus: TaskStatus = task.delivery_count > 2 ? "BLOCKED" : "REJECTED";
    await client.query(
      `
        UPDATE charter_tasks
        SET status = $3,
            review_status = 'REJECTED',
            assigned_to = CASE WHEN $3 = 'BLOCKED' THEN NULL ELSE assigned_to END,
            updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [input.roomId, input.taskId, nextStatus]
    );
    if (nextStatus === "BLOCKED" && task.assigned_to) {
      await client.query(
        `
          UPDATE room_members
          SET stake_locked = GREATEST(stake_locked - $3, 0), updated_at = NOW()
          WHERE room_id = $1 AND member_id = $2
        `,
        [input.roomId, task.assigned_to, numeric(task.weight)]
      );
    }
    lastEvent = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_REJECTED",
      actorId: input.actorId,
      payload: {
        taskId: input.taskId,
        notes: input.notes,
        nextStatus
      }
    });
    if (nextStatus === "BLOCKED") {
      lastEvent = await appendRoomEvent(client, {
        roomId: input.roomId,
        eventType: "TASK_BLOCKED",
        actorId: input.actorId,
        payload: {
          taskId: input.taskId,
          reason: "review_rejected_max_attempts"
        }
      });
    }
  }

  const remainingDelivered = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM charter_tasks WHERE room_id = $1 AND status = 'DELIVERED'",
    [input.roomId]
  );

  await touchRoom(
    client,
    input.roomId,
    Number(remainingDelivered.rows[0]?.count ?? 0) > 0 ? "IN_REVIEW" : "ACTIVE",
    Number(remainingDelivered.rows[0]?.count ?? 0) > 0 ? "3" : "2"
  );

  await maybeGenerateSettlementIfEligible(client, input.roomId, input.actorId);
  return lastEvent;
}

export async function reviewTask(input: unknown) {
  const command = reviewTaskCommandSchema.parse(input);

  return withClient(async (client) => {
    const event = await finalizeTaskReview(client, command);
    return { ok: true as const, eventId: event?.id ?? "", seq: event?.seq ?? -1, roomId: command.roomId };
  });
}

export async function recordPeerRating(input: unknown) {
  const command = peerRatingCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertActiveMember(client, command.roomId, command.actorId);
    await assertActiveMemberTarget(client, command.roomId, command.targetId);
    assert(command.actorId !== command.targetId, "Self-rating is not allowed");
    await assertRatingWindowOpen(client, command.roomId);
    await client.query(
      `
        INSERT INTO peer_ratings (room_id, rater_id, target_id, signal)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id, rater_id, target_id)
        DO UPDATE SET signal = EXCLUDED.signal, created_at = NOW()
      `,
      [command.roomId, command.actorId, command.targetId, command.signal]
    );
    return { ok: true as const, eventId: "", seq: -1, roomId: command.roomId };
  });
}

export async function recordRequesterRating(input: unknown) {
  const command = requesterRatingCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertRequester(client, command.roomId, command.actorId);
    await assertActiveMemberTarget(client, command.roomId, command.targetId);
    assert(command.actorId !== command.targetId, "Requester cannot rate self");
    await assertRatingWindowOpen(client, command.roomId);
    await client.query(
      `
        INSERT INTO requester_ratings (room_id, requester_id, target_id, rating)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id, requester_id, target_id)
        DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()
      `,
      [command.roomId, command.actorId, command.targetId, command.rating]
    );
    return { ok: true as const, eventId: "", seq: -1, roomId: command.roomId };
  });
}

async function createSettlementProposal(
  client: PoolClient,
  input: { roomId: string; actorId: string }
) {
  await ensureNoOpenDisputes(client, input.roomId);
  const existingProposal = await loadLatestSettlement(client, input.roomId);
  if (existingProposal && ["PENDING_REVIEW", "MANUAL_REVIEW", "FINAL"].includes(existingProposal.status)) {
    return {
      ok: true as const,
      eventId: "",
      seq: -1,
      roomId: input.roomId,
      proposalId: existingProposal.id,
      reused: true
    };
  }

  const room = await loadRoom(client, input.roomId);
  const charter = await loadLatestCharter(client, input.roomId);
  assert(charter, "Charter is required before settlement");
  const tasks = await loadTasks(client, input.roomId, charter.id);
  assert(tasks.length > 0, "No tasks found for settlement");
  assert(
    tasks.every((task) => TERMINAL_TASK_STATUSES.has(task.status)),
    "All tasks must be terminal before settlement"
  );

  const peerRatingsResult = await client.query<{ rater_id: string; target_id: string; signal: number }>(
    "SELECT rater_id, target_id, signal FROM peer_ratings WHERE room_id = $1",
    [input.roomId]
  );
  const requesterRatingsResult = await client.query<{ target_id: string; rating: number }>(
    "SELECT target_id, rating FROM requester_ratings WHERE room_id = $1",
    [input.roomId]
  );

  const computation = computeSettlement({
    budgetTotal: numeric(room.budget_total),
    baselineSplit: charter.baseline_split,
    bonusPoolPct: numeric(charter.bonus_pool_pct),
    malusPoolPct: numeric(charter.malus_pool_pct),
    acceptedTasks: tasks
      .filter((task) => task.status === "ACCEPTED" && task.assigned_to)
      .map((task) => ({
        taskId: task.id,
        assignedTo: task.assigned_to as string,
        weight: numeric(task.weight)
      })),
    peerRatings: peerRatingsResult.rows.map((row) => ({
      raterId: row.rater_id,
      targetId: row.target_id,
      signal: Number(row.signal)
    })),
    requesterRatings: requesterRatingsResult.rows.map((row) => ({
      targetId: row.target_id,
      rating: Number(row.rating)
    }))
  });

  await client.query("DELETE FROM contrib_records WHERE room_id = $1", [input.roomId]);
  for (const record of computation.contributionRecords) {
    await client.query(
      `
        INSERT INTO contrib_records (
          room_id, agent_id, task_weight_sum, peer_adjustment, requester_adjustment, final_share, computation_log
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        input.roomId,
        record.agentId,
        record.acceptedTaskWeight,
        record.peerAdjustment,
        record.requesterAdjustment + record.taskWeightAdjustment,
        record.finalShare,
        JSON.stringify(record.computationLog)
      ]
    );
  }

  const timeoutRules = parseJson<Record<string, number>>(charter.timeout_rules ?? defaultTimeoutRules);
  const proposalId = randomUUID();
  await client.query(
    `
      INSERT INTO settlement_proposals (
        id, room_id, status, allocations, bonus_pool_used, malus_pool_reclaimed, computation_log
      )
      VALUES ($1, $2, 'PENDING_REVIEW', $3::jsonb, $4, $5, $6::jsonb)
    `,
    [
      proposalId,
      input.roomId,
      JSON.stringify(computation.allocations),
      computation.bonusPoolUsed,
      computation.malusPoolReclaimed,
      JSON.stringify({
        ...computation.computationLog,
        shares: computation.shares
      })
    ]
  );
  await touchRoom(client, input.roomId, "IN_SETTLEMENT", "4");
  const settlementEvent = await appendRoomEvent(client, {
    roomId: input.roomId,
    eventType: "SETTLEMENT_PROPOSED",
    actorId: input.actorId,
    payload: {
      proposalId,
      allocations: computation.allocations,
      shares: computation.shares
    }
  });
  await enqueueJob(client, {
    type: "SETTLEMENT_VOTE_TIMEOUT",
    runAt: addHours(now(), timeoutRules.settlementVoteWindowHours),
    payload: {
      roomId: input.roomId,
      proposalId,
      actorId: input.actorId,
      extensionCount: 0
    }
  });

  return {
    ok: true as const,
    eventId: settlementEvent.id,
    seq: settlementEvent.seq,
    roomId: input.roomId,
    proposalId
  };
}

async function maybeGenerateSettlementIfEligible(client: PoolClient, roomId: string, actorId: string) {
  const charter = await loadLatestCharter(client, roomId);
  if (!charter) {
    return null;
  }

  const hasOpenDispute = await client.query(
    "SELECT 1 FROM dispute_cases WHERE room_id = $1 AND status <> 'RESOLVED' LIMIT 1",
    [roomId]
  );
  if ((hasOpenDispute.rowCount ?? 0) > 0) {
    return null;
  }

  const tasks = await loadTasks(client, roomId, charter.id);
  if (tasks.length === 0 || !tasks.every((task) => TERMINAL_TASK_STATUSES.has(task.status))) {
    return null;
  }

  return createSettlementProposal(client, { roomId, actorId });
}

async function getSettlementVoteOutcome(client: PoolClient, roomId: string, proposalId: string) {
  const votes = await loadSettlementVotes(client, proposalId);
  const members = await loadMembers(client, roomId);
  const activeAgents = members.filter((member) => member.status === "ACTIVE");
  const charter = await loadLatestCharter(client, roomId);
  const quorumRatio =
    numeric(charter?.consensus_config?.settlementQuorumRatio as string) ||
    defaultConsensusConfig.settlementQuorumRatio;
  const acceptRatio =
    numeric(charter?.consensus_config?.settlementAcceptRatio as string) ||
    defaultConsensusConfig.settlementAcceptRatio;

  const acceptVotes = votes.filter((vote) => vote.vote === "ACCEPT").length;
  const castVotes = votes.filter((vote) => vote.vote !== "ABSTAIN").length;
  return {
    votes,
    activeAgentCount: activeAgents.length,
    acceptVotes,
    castVotes,
    hasQuorum: activeAgents.length === 0 ? true : castVotes / activeAgents.length >= quorumRatio,
    isAccepted: castVotes === 0 ? false : acceptVotes / castVotes >= acceptRatio
  };
}

async function finalizeSettlementProposal(
  client: PoolClient,
  roomId: string,
  proposal: SettlementProposalRow,
  actorId: string
) {
  if (proposal.status === "FINAL") {
    return null;
  }

  const signedPayload = signSettlementPayload({
    roomId,
    proposalId: proposal.id,
    allocations: proposal.allocations
  });
  const paymentPayload = buildPaymentHandoff({
    roomId,
    proposalId: proposal.id,
    allocations: proposal.allocations
  });
  await client.query(
    `
      UPDATE settlement_proposals
      SET status = 'FINAL', signature_payload = $2::jsonb, finalized_at = NOW()
      WHERE id = $1
    `,
    [proposal.id, JSON.stringify(signedPayload)]
  );
  await client.query(
    `
      INSERT INTO payment_handoffs (id, room_id, proposal_id, status, payload)
      VALUES ($1, $2, $3, 'READY', $4::jsonb)
    `,
    [randomUUID(), roomId, proposal.id, JSON.stringify(paymentPayload)]
  );
  await enqueueJob(client, {
    type: "PAYMENT_HANDOFF_SEND",
    runAt: now(),
    payload: {
      roomId,
      proposalId: proposal.id,
      actorId
    }
  });
  await touchRoom(client, roomId, "SETTLED", "5");
  await appendRoomEvent(client, {
    roomId,
    eventType: "SETTLEMENT_FINAL",
    actorId,
    payload: {
      proposalId: proposal.id,
      allocations: proposal.allocations,
      signature: signedPayload
    }
  });
  return appendRoomEvent(client, {
    roomId,
    eventType: "ROOM_SETTLED",
    actorId,
    payload: {
      proposalId: proposal.id
    }
  });
}

export async function proposeSettlement(input: { roomId: string; actorId: string }) {
  return withClient(async (client) => createSettlementProposal(client, input));
}

export async function voteSettlement(input: unknown) {
  const command = settlementVoteCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertActiveMember(client, command.roomId, command.actorId);
    if (command.vote === "REJECT") {
      assert(command.reason?.trim(), "Reject votes require a written reason");
    }
    await ensureNoOpenDisputes(client, command.roomId);

    const proposal = await loadLatestSettlement(client, command.roomId);
    assert(proposal?.id === command.proposalId, "Can only vote on the latest settlement proposal");
    assert(proposal.status === "PENDING_REVIEW", "Settlement proposal is not open for voting");

    await client.query(
      `
        INSERT INTO settlement_votes (id, proposal_id, room_id, agent_id, vote, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (proposal_id, agent_id)
        DO UPDATE SET vote = EXCLUDED.vote, reason = EXCLUDED.reason, submitted_at = NOW()
      `,
      [randomUUID(), command.proposalId, command.roomId, command.actorId, command.vote, command.reason ?? null]
    );
    let lastVoteEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "SETTLEMENT_VOTE",
      actorId: command.actorId,
      payload: {
        proposalId: command.proposalId,
        vote: command.vote,
        reason: command.reason ?? null
      }
    });

    const outcome = await getSettlementVoteOutcome(client, command.roomId, command.proposalId);
    if (outcome.hasQuorum && outcome.isAccepted) {
      lastVoteEvent =
        (await finalizeSettlementProposal(client, command.roomId, proposal, command.actorId)) ?? lastVoteEvent;
    }

    return { ok: true as const, eventId: lastVoteEvent.id, seq: lastVoteEvent.seq, roomId: command.roomId };
  });
}

export async function fileDispute(input: unknown) {
  const command = createDisputeCommandSchema.parse(input);

  return withClient(async (client) => {
    await assertActiveMember(client, command.roomId, command.actorId);
    const room = await loadRoom(client, command.roomId);
    const charter = await loadLatestCharter(client, command.roomId);
    const agreement = charter;
    if (!agreement) throw new DomainError("NO_CHARTER", "Room has no charter");
    const agentBaseline = (agreement.baseline_split as Record<string, number>)[command.actorId] ?? 0;
    if (agentBaseline === 0)
      throw new DomainError("AGENT_NOT_IN_ROOM", `${command.actorId} has no baseline in this room`);
    const filing_stake = Math.max(
      Number(numeric(room.budget_total)) * agentBaseline * 0.03,
      1.00
    ).toFixed(2);
    const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
    const disputeId = randomUUID();
    const coolingOffExpiresAt = addHours(now(), timeoutRules.disputeCoolingOffHours);
    await client.query(
      `
        INSERT INTO dispute_cases (
          id, room_id, category, sub_type, claimant_id, respondent_id,
          filing_stake, remedy_sought, status, cooling_off_expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'COOLING_OFF', $9)
      `,
      [
        disputeId,
        command.roomId,
        command.category,
        command.subType,
        command.actorId,
        command.respondentId,
        filing_stake,
        command.remedySought,
        coolingOffExpiresAt.toISOString()
      ]
    );

    for (const evidence of command.evidence) {
      await client.query(
        `
          INSERT INTO dispute_evidence (id, dispute_id, type, ledger_ref, submitted_by)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [randomUUID(), disputeId, evidence.type, evidence.ledgerRef, command.actorId]
      );
    }

    await touchRoom(client, command.roomId, "DISPUTED", room.phase);
    const disputeEvent = await appendRoomEvent(client, {
      roomId: command.roomId,
      eventType: "DISPUTE_FILED",
      actorId: command.actorId,
      payload: {
        disputeId,
        category: command.category,
        subType: command.subType,
        respondentId: command.respondentId,
        remedySought: command.remedySought
      }
    });
    await enqueueJob(client, {
      type: "DISPUTE_COOLING_OFF_END",
      runAt: coolingOffExpiresAt,
      payload: {
        roomId: command.roomId,
        disputeId,
        actorId: command.actorId
      }
    });

    return { ok: true as const, eventId: disputeEvent.id, seq: disputeEvent.seq, roomId: command.roomId };
  });
}

export async function assignDisputePanel(input: { roomId: string; disputeId: string; actorId: string; actorRole?: string; panelists?: string[] }) {
  return withClient(async (client) => {
    await assertCoordinatorOrAdmin(client, input.roomId, input.actorId, input.actorRole);
    const disputes = await loadDisputes(client, input.roomId);
    const dispute = disputes.find((item) => item.id === input.disputeId);
    assert(dispute, `Dispute ${input.disputeId} not found`);

    const charter = await loadLatestCharter(client, input.roomId);
    const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
    const panelDeadline = addHours(now(), timeoutRules.panelReviewWindowHours);
    const members = await loadMembers(client, input.roomId);
    // BUG-02: require at least MIN_PANEL_SIZE eligible arbiters.
    const MIN_PANEL_SIZE = 3;
    const eligibleMembers = members.filter(
      (member) =>
        member.status === "ACTIVE" &&
        member.member_id !== dispute.claimant_id &&
        member.member_id !== dispute.respondent_id
    );
    if (input.panelists?.length) {
      if (input.panelists.length < MIN_PANEL_SIZE)
        throw new DomainError(
          `Need at least ${MIN_PANEL_SIZE} eligible arbiters, found ${input.panelists.length}`,
          "INSUFFICIENT_PANEL_CANDIDATES"
        );
      const eligibleIds = new Set(eligibleMembers.map((member) => member.member_id));
      for (const panelistId of input.panelists) {
        if (!eligibleIds.has(panelistId)) {
          throw new DomainError(
            `${panelistId} is not eligible to serve on dispute panel ${input.disputeId}`,
            "PANEL_INELIGIBLE"
          );
        }
      }
    } else if (eligibleMembers.length < MIN_PANEL_SIZE) {
      throw new DomainError(
        `Need at least ${MIN_PANEL_SIZE} eligible arbiters, found ${eligibleMembers.length}`,
        "INSUFFICIENT_PANEL_CANDIDATES"
      );
    }
    const candidatePanel = input.panelists?.length
      ? input.panelists.slice(0, MIN_PANEL_SIZE)
      : eligibleMembers.slice(0, MIN_PANEL_SIZE).map((m) => m.member_id);
    await client.query("DELETE FROM dispute_panel_members WHERE dispute_id = $1", [input.disputeId]);
    for (const panelistId of candidatePanel) {
      await client.query(
        `
          INSERT INTO dispute_panel_members (dispute_id, member_id)
          VALUES ($1, $2)
        `,
        [input.disputeId, panelistId]
      );
    }
    await client.query(
      `
        UPDATE dispute_cases
        SET status = 'UNDER_REVIEW', panel_deadline_at = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [input.disputeId, panelDeadline.toISOString()]
    );
    const paneledEvent = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "DISPUTE_PANELED",
      actorId: input.actorId,
      payload: {
        disputeId: input.disputeId,
        panelists: candidatePanel,
        panelDeadlineAt: panelDeadline.toISOString()
      }
    });
    await enqueueJob(client, {
      type: "DISPUTE_PANEL_TIMEOUT",
      runAt: panelDeadline,
      payload: {
        roomId: input.roomId,
        disputeId: input.disputeId,
        actorId: input.actorId
      }
    });
    await enqueueJob(client, {
      type: "DISPUTE_RESOLUTION_TIMEOUT",
      runAt: addHours(now(), timeoutRules.disputeResolutionWindowHours),
      payload: {
        roomId: input.roomId,
        disputeId: input.disputeId,
        actorId: input.actorId
      }
    });
    return { ok: true as const, eventId: paneledEvent.id, seq: paneledEvent.seq, roomId: input.roomId };
  });
}

export async function resolveDispute(input: {
  roomId: string;
  disputeId: string;
  actorId: string;
  actorRole?: string;
  resolution: JsonValue;
  nextRoomStatus?: RoomStatus;
}) {
  return withClient(async (client) => {
    await assertCoordinatorOrAdmin(client, input.roomId, input.actorId, input.actorRole);
    const disputes = await loadDisputes(client, input.roomId);
    const dispute = disputes.find((item) => item.id === input.disputeId);
    assert(dispute, `Dispute ${input.disputeId} not found`);
    let nextRoomStatus: RoomStatus | undefined;
    let nextRoomPhase: string | undefined;

    await client.query(
      `
        UPDATE dispute_cases
        SET status = 'RESOLVED', resolution = $2::jsonb, updated_at = NOW()
        WHERE id = $1
      `,
      [input.disputeId, JSON.stringify(input.resolution)]
    );

    const remainingDisputes = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM dispute_cases WHERE room_id = $1 AND status NOT IN ('RESOLVED')",
      [input.roomId]
    );
    if (Number(remainingDisputes.rows[0]?.count ?? 0) === 0) {
      const latestSettlement = await loadLatestSettlement(client, input.roomId);
      nextRoomStatus = input.nextRoomStatus ?? (latestSettlement ? "IN_SETTLEMENT" : "ACTIVE");
      nextRoomPhase = nextRoomStatus === "IN_SETTLEMENT" ? "4" : "2";
      await touchRoom(client, input.roomId, nextRoomStatus, nextRoomPhase);
      if (nextRoomStatus !== "IN_SETTLEMENT") {
        await maybeGenerateSettlementIfEligible(client, input.roomId, input.actorId);
      }
    }
    const resolvedEvent = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "DISPUTE_RESOLVED",
      actorId: input.actorId,
      payload: {
        disputeId: input.disputeId,
        resolution: input.resolution,
        nextRoomStatus: nextRoomStatus ?? null,
        nextRoomPhase: nextRoomPhase ?? null
      }
    });

    return { ok: true as const, eventId: resolvedEvent.id, seq: resolvedEvent.seq, roomId: input.roomId };
  });
}

export async function overrideRoomStatus(input: {
  roomId: string;
  actorId: string;
  actorRole?: string;
  status: RoomStatus;
  phase: string;
  reason: string;
}) {
  return withClient(async (client) => {
    await assertCoordinatorOrAdmin(client, input.roomId, input.actorId, input.actorRole);
    await touchRoom(client, input.roomId, input.status, input.phase);
    const overrideEvent = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "MANUAL_OVERRIDE",
      actorId: input.actorId,
      payload: {
        status: input.status,
        phase: input.phase,
        reason: input.reason
      }
    });
    return { ok: true as const, eventId: overrideEvent.id, seq: overrideEvent.seq, roomId: input.roomId };
  });
}

export async function listRooms() {
  const client = await getDbPool().connect();
  try {
    const result = await client.query<
      RoomRow & {
        member_count: string;
        task_count: string;
        dispute_count: string;
      }
    >(
      `
        SELECT
          rooms.*,
          (SELECT COUNT(*)::text FROM room_members WHERE room_id = rooms.id) AS member_count,
          (SELECT COUNT(*)::text FROM charter_tasks WHERE room_id = rooms.id) AS task_count,
          (SELECT COUNT(*)::text FROM dispute_cases WHERE room_id = rooms.id AND status <> 'RESOLVED') AS dispute_count
        FROM rooms
        ORDER BY created_at DESC
      `
    );

    return result.rows.map((room) => ({
      id: room.id,
      name: room.name,
      requesterId: room.requester_id,
      coordinatorId: room.coordinator_id,
      budgetTotal: numeric(room.budget_total),
      status: room.status,
      phase: room.phase,
      executionDeadlineAt: room.execution_deadline_at.toISOString(),
      memberCount: Number(room.member_count),
      taskCount: Number(room.task_count),
      disputeCount: Number(room.dispute_count),
      createdAt: room.created_at.toISOString(),
      updatedAt: room.updated_at.toISOString()
    }));
  } finally {
    client.release();
  }
}

export async function getRoomSnapshot(roomId: string) {
  const client = await getDbPool().connect();
  try {
    return getRoomSnapshotById(client, roomId);
  } finally {
    client.release();
  }
}

async function getRoomSnapshotById(client: PoolClient, roomId: string, verify = false) {
  const room = await loadRoom(client, roomId);
  const mission = await loadMission(client, roomId);
  const members = await loadMembers(client, roomId);
  const charter = await loadLatestCharter(client, roomId);
  const tasks = await loadTasks(client, roomId, charter?.id);
  const events = await fetchRoomEvents(client, roomId);
  const verification = verify ? verifyEventChain(events) : { ok: true, errors: [] };
  const projection = replayRoomEvents(events);
  const latestSettlement = await loadLatestSettlement(client, roomId);
  const disputes = await loadDisputes(client, roomId);
  const votes = latestSettlement ? await loadSettlementVotes(client, latestSettlement.id) : [];
  const artifacts = await client.query<ArtifactRow>(
    "SELECT * FROM artifacts WHERE room_id = $1 ORDER BY submitted_at DESC",
    [roomId]
  );

  return {
    room: {
      id: room.id,
      name: room.name,
      requesterId: room.requester_id,
      coordinatorId: room.coordinator_id,
      budgetTotal: numeric(room.budget_total),
      status: room.status,
      phase: room.phase,
      executionDeadlineAt: room.execution_deadline_at.toISOString(),
      createdAt: room.created_at.toISOString(),
      updatedAt: room.updated_at.toISOString()
    },
    mission: mission
      ? {
          rawInput: mission.raw_input,
          structured: parseJson<JsonValue>(mission.structured),
          confirmedAt: mission.confirmed_at?.toISOString() ?? null
        }
      : null,
    members: members.map((member) => ({
      memberId: member.member_id,
      identityRef: member.identity_ref,
      role: member.role,
      status: member.status,
      charterSigned: member.charter_signed,
      charterSignedAt: member.charter_signed_at?.toISOString() ?? null,
      stakeLocked: numeric(member.stake_locked),
      joinedAt: member.joined_at?.toISOString() ?? null
    })),
    charter: charter
      ? {
          id: charter.id,
          version: charter.version,
          status: charter.status,
          baselineSplit: charter.baseline_split,
          bonusPoolPct: numeric(charter.bonus_pool_pct),
          malusPoolPct: numeric(charter.malus_pool_pct),
          consensusConfig: charter.consensus_config,
          timeoutRules: charter.timeout_rules,
          signDeadline: charter.sign_deadline?.toISOString() ?? null
        }
      : null,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      deliverableSpec: task.deliverable_spec,
      effortEstimate: task.effort_estimate,
      weight: numeric(task.weight),
      dependencies: task.dependencies,
      assignedTo: task.assigned_to,
      status: task.status,
      claimDeadline: task.claim_deadline?.toISOString() ?? null,
      deliveryDeadline: task.delivery_deadline?.toISOString() ?? null,
      artifactId: task.artifact_id,
      reviewStatus: task.review_status,
      deliveryCount: task.delivery_count
    })),
    artifacts: artifacts.rows.map((artifact) => ({
      id: artifact.id,
      taskId: artifact.task_id,
      submittedBy: artifact.submitted_by,
      contentRef: artifact.content_ref,
      contentType: artifact.content_type,
      version: artifact.version,
      reviewNotes: artifact.review_notes,
      metadata: parseJson<JsonValue>(artifact.metadata),
      submittedAt: artifact.submitted_at.toISOString()
    })),
    settlement: latestSettlement
      ? {
          id: latestSettlement.id,
          status: latestSettlement.status,
          allocations: latestSettlement.allocations,
          computationLog: latestSettlement.computation_log,
          signaturePayload: latestSettlement.signature_payload,
          proposedAt: latestSettlement.proposed_at.toISOString(),
          finalizedAt: latestSettlement.finalized_at?.toISOString() ?? null,
          votes: votes.map((vote) => ({
            agentId: vote.agent_id,
            vote: vote.vote,
            reason: vote.reason,
            submittedAt: vote.submitted_at.toISOString()
          }))
        }
      : null,
    disputes: disputes.map((dispute) => ({
      id: dispute.id,
      category: dispute.category,
      subType: dispute.sub_type,
      claimantId: dispute.claimant_id,
      respondentId: dispute.respondent_id,
      filingStake: numeric(dispute.filing_stake),
      remedySought: dispute.remedy_sought,
      status: dispute.status,
      coolingOffExpiresAt: dispute.cooling_off_expires_at.toISOString(),
      responseDeadlineAt: dispute.response_deadline_at?.toISOString() ?? null,
      panelDeadlineAt: dispute.panel_deadline_at?.toISOString() ?? null,
      resolution: dispute.resolution,
      createdAt: dispute.created_at.toISOString()
    })),
    events,
    projection,
    verification
  };
}

export async function listDisputes() {
  const client = await getDbPool().connect();
  try {
    const result = await client.query<DisputeRow>(
      "SELECT * FROM dispute_cases ORDER BY created_at DESC LIMIT 100"
    );
    return result.rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      category: row.category,
      subType: row.sub_type,
      claimantId: row.claimant_id,
      respondentId: row.respondent_id,
      status: row.status,
      remedySought: row.remedy_sought,
      createdAt: row.created_at.toISOString()
    }));
  } finally {
    client.release();
  }
}

export async function getRoomEvents(roomId: string): Promise<RoomEvent[]> {
  const client = await getDbPool().connect();
  try {
    return fetchRoomEvents(client, roomId);
  } finally {
    client.release();
  }
}

async function updateJobStatus(
  client: PoolClient,
  jobId: string,
  status: string,
  nextRunAt?: Date,
  lastError?: string
) {
  await client.query(
    `
      UPDATE job_queue
      SET status = $2,
          run_at = COALESCE($3, run_at),
          last_error = $4,
          attempts = CASE WHEN $2 = 'DONE' THEN attempts ELSE attempts + 1 END,
          locked_at = CASE WHEN $2 = 'RUNNING' THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [jobId, status, nextRunAt?.toISOString() ?? null, lastError ?? null]
  );
}

async function handleExecutionDeadline(client: PoolClient, roomId: string, actorId: string) {
  const room = await loadRoom(client, roomId);
  if (room.status === "SETTLED" || room.status === "FAILED" || room.execution_deadline_at > now()) {
    return;
  }

  const charter = await loadLatestCharter(client, roomId);
  if (!charter) {
    return;
  }

  const tasks = await loadTasks(client, roomId, charter.id);
  let hasDeliveredWork = false;

  for (const task of tasks) {
    if (task.status === "DELIVERED") {
      hasDeliveredWork = true;
      continue;
    }

    if (!["OPEN", "REQUEUED", "CLAIMED", "REJECTED"].includes(task.status)) {
      continue;
    }

    await client.query(
      `
        UPDATE charter_tasks
        SET status = 'CANCELLED',
            assigned_to = NULL,
            claim_deadline = NULL,
            delivery_deadline = NULL,
            review_status = NULL,
            updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [roomId, task.id]
    );
    if (task.assigned_to) {
      await client.query(
        `
          UPDATE room_members
          SET stake_locked = GREATEST(stake_locked - $3, 0), updated_at = NOW()
          WHERE room_id = $1 AND member_id = $2
        `,
        [roomId, task.assigned_to, numeric(task.weight)]
      );
    }
    await appendRoomEvent(client, {
      roomId,
      eventType: "TASK_CANCELLED",
      actorId,
      payload: {
        taskId: task.id,
        reason: "execution_deadline",
        previousStatus: task.status
      }
    });
  }

  await touchRoom(client, roomId, hasDeliveredWork ? "IN_REVIEW" : "ACTIVE", hasDeliveredWork ? "3" : "2");
  await maybeGenerateSettlementIfEligible(client, roomId, actorId);
}

async function handleSettlementVoteTimeout(
  client: PoolClient,
  roomId: string,
  proposalId: string,
  actorId: string,
  extensionCount: number
) {
  const proposal = await loadLatestSettlement(client, roomId);
  if (!proposal || proposal.id !== proposalId || proposal.status === "FINAL" || proposal.status === "MANUAL_REVIEW") {
    return;
  }

  const outcome = await getSettlementVoteOutcome(client, roomId, proposalId);
  if (outcome.hasQuorum && outcome.isAccepted) {
    await finalizeSettlementProposal(client, roomId, proposal, actorId);
    return;
  }

  const charter = await loadLatestCharter(client, roomId);
  const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
  if (extensionCount < 1) {
    await enqueueJob(client, {
      type: "SETTLEMENT_VOTE_TIMEOUT",
      runAt: addHours(now(), timeoutRules.settlementVoteWindowHours),
      payload: {
        roomId,
        proposalId,
        actorId,
        extensionCount: extensionCount + 1
      }
    });
    return;
  }

  await client.query(
    `
      UPDATE settlement_proposals
      SET status = 'MANUAL_REVIEW',
          computation_log = computation_log || $2::jsonb
      WHERE id = $1
    `,
    [
      proposalId,
      JSON.stringify({
        manualReviewReason: "settlement_vote_timeout",
        settlementVoteTimeoutAt: now().toISOString()
      })
    ]
  );
  await touchRoom(client, roomId, "IN_SETTLEMENT", "4");
}

async function handleInvitationTimeout(client: PoolClient, roomId: string, actorId: string) {
  const room = await loadRoom(client, roomId);
  if (["ACTIVE", "IN_REVIEW", "IN_SETTLEMENT", "SETTLED", "FAILED", "DISPUTED"].includes(room.status)) {
    return;
  }

  const members = await loadMembers(client, roomId);
  const activeMembers = members.filter((member) => member.status === "ACTIVE");
  const pendingInvites = members.filter((member) => member.status === "INVITED");

  if (activeMembers.length <= 1) {
    await markRoomFailed(client, roomId, actorId, "invitation_window_expired");
    return;
  }

  if (pendingInvites.length === 0) {
    return;
  }

  await client.query(
    `
      UPDATE room_members
      SET status = 'DECLINED', updated_at = NOW()
      WHERE room_id = $1 AND status = 'INVITED'
    `,
    [roomId]
  );

  for (const member of pendingInvites) {
    await appendRoomEvent(client, {
      roomId,
      eventType: "MEMBER_DECLINED",
      actorId,
      payload: {
        memberId: member.member_id,
        reason: "invitation_timeout"
      }
    });
  }
}

async function handleTaskClaimTimeout(
  client: PoolClient,
  roomId: string,
  taskId: string,
  actorId: string,
  extensionCount: number
) {
  const task = await loadTask(client, roomId, taskId);
  if (!OPEN_TASK_STATUSES.has(task.status)) {
    return;
  }

  const charter = await loadLatestCharter(client, roomId);
  const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
  const tasks = await loadTasks(client, roomId, charter?.id);

  if (!areDependenciesAccepted(tasks, task)) {
    await enqueueJob(client, {
      type: "TASK_CLAIM_TIMEOUT",
      runAt: addHours(now(), timeoutRules.taskClaimWindowHours),
      payload: {
        roomId,
        taskId,
        actorId,
        extensionCount
      }
    });
    return;
  }

  if (extensionCount < 1) {
    await enqueueJob(client, {
      type: "TASK_CLAIM_TIMEOUT",
      runAt: addHours(now(), timeoutRules.taskClaimWindowHours),
      payload: {
        roomId,
        taskId,
        actorId,
        extensionCount: extensionCount + 1
      }
    });
    return;
  }

  await client.query(
    `
      UPDATE charter_tasks
      SET status = 'CANCELLED',
          assigned_to = NULL,
          claim_deadline = NULL,
          delivery_deadline = NULL,
          review_status = NULL,
          updated_at = NOW()
      WHERE room_id = $1 AND id = $2
    `,
    [roomId, taskId]
  );
  await appendRoomEvent(client, {
    roomId,
    eventType: "TASK_CANCELLED",
    actorId,
    payload: {
      taskId,
      reason: "claim_timeout",
      extensionCount
    }
  });
  await maybeGenerateSettlementIfEligible(client, roomId, actorId);
}

async function handleDisputeManualEscalation(
  client: PoolClient,
  roomId: string,
  disputeId: string,
  actorId: string,
  reason: string
) {
  const disputes = await loadDisputes(client, roomId);
  const dispute = disputes.find((item) => item.id === disputeId);
  if (dispute?.status !== "UNDER_REVIEW") {
    return;
  }

  await client.query(
    `
      UPDATE dispute_cases
      SET status = 'ESCALATED_TO_MANUAL', updated_at = NOW()
      WHERE id = $1
    `,
    [dispute.id]
  );
  await appendRoomEvent(client, {
    roomId,
    eventType: "DISPUTE_ESCALATED",
    actorId,
    payload: {
      disputeId: dispute.id,
      reason
    }
  });
}

async function handlePaymentHandoffSend(client: PoolClient, roomId: string, proposalId: string) {
  const result = await client.query<{
    id: string;
    payload: JsonValue;
  }>(
    `
      SELECT id, payload
      FROM payment_handoffs
      WHERE room_id = $1 AND proposal_id = $2 AND status = 'READY'
      ORDER BY created_at ASC
    `,
    [roomId, proposalId]
  );

  for (const handoff of result.rows) {
    await client.query(
      `
        UPDATE payment_handoffs
        SET status = 'SENT',
            response = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        handoff.id,
        JSON.stringify({
          adapterMode: handoff.payload.adapterMode ?? "stub",
          sentAt: now().toISOString(),
          result: "accepted"
        })
      ]
    );
  }
}

async function processJob(job: JobRow) {
  return withClient(async (client) => {
    switch (job.type) {
      case "INVITATION_TIMEOUT": {
        await handleInvitationTimeout(
          client,
          String(job.payload.roomId),
          String(job.payload.actorId ?? "system")
        );
        break;
      }
      case "ROOM_EXECUTION_DEADLINE": {
        await handleExecutionDeadline(
          client,
          String(job.payload.roomId),
          String(job.payload.actorId ?? "system")
        );
        break;
      }
      case "CHARTER_SIGN_TIMEOUT": {
        const charter = await loadLatestCharter(client, String(job.payload.roomId));
        if (charter?.id === String(job.payload.charterId) && charter.status === "DRAFT") {
          await client.query("UPDATE charters SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", [charter.id]);
          await touchRoom(client, String(job.payload.roomId), "PENDING_CHARTER", "1");
          await appendRoomEvent(client, {
            roomId: String(job.payload.roomId),
            eventType: "CHARTER_EXPIRED",
            actorId: String(job.payload.actorId ?? "system"),
            payload: { charterId: charter.id }
          });
          if (Number(job.payload.version ?? 0) >= 3) {
            await markRoomFailed(
              client,
              String(job.payload.roomId),
              String(job.payload.actorId ?? "system"),
              "Charter expired after maximum rounds"
            );
          }
        }
        break;
      }
      case "TASK_DELIVERY_TIMEOUT": {
        const task = await loadTask(client, String(job.payload.roomId), String(job.payload.taskId));
        if (task.status === "CLAIMED" && task.delivery_deadline && task.delivery_deadline <= now()) {
          await client.query(
            `
              UPDATE charter_tasks
              SET status = 'REQUEUED', assigned_to = NULL, claim_deadline = NULL, delivery_deadline = NULL, updated_at = NOW()
              WHERE room_id = $1 AND id = $2
            `,
            [String(job.payload.roomId), String(job.payload.taskId)]
          );
          if (task.assigned_to) {
            await client.query(
              `
                UPDATE room_members
                SET stake_locked = GREATEST(stake_locked - $3, 0), updated_at = NOW()
                WHERE room_id = $1 AND member_id = $2
              `,
              [String(job.payload.roomId), task.assigned_to, numeric(task.weight)]
            );
          }
          await appendRoomEvent(client, {
            roomId: String(job.payload.roomId),
            eventType: "TASK_REQUEUED",
            actorId: String(job.payload.actorId ?? "system"),
            payload: {
              taskId: String(job.payload.taskId),
              reason: "delivery_timeout",
              slashedStake: numeric(task.weight)
            }
          });
          const charter = await loadLatestCharter(client, String(job.payload.roomId));
          const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
          await enqueueJob(client, {
            type: "TASK_CLAIM_TIMEOUT",
            runAt: addHours(now(), timeoutRules.taskClaimWindowHours),
            payload: {
              roomId: String(job.payload.roomId),
              taskId: String(job.payload.taskId),
              actorId: String(job.payload.actorId ?? "system"),
              extensionCount: 0
            }
          });
        }
        break;
      }
      case "TASK_CLAIM_TIMEOUT": {
        await handleTaskClaimTimeout(
          client,
          String(job.payload.roomId),
          String(job.payload.taskId),
          String(job.payload.actorId ?? "system"),
          Number(job.payload.extensionCount ?? 0)
        );
        break;
      }
      case "TASK_REVIEW_TIMEOUT": {
        const task = await loadTask(client, String(job.payload.roomId), String(job.payload.taskId));
        if (task.status === "DELIVERED") {
          const artifact = task.artifact_id ? await loadArtifact(client, task.artifact_id) : null;
          const metadata = artifact?.metadata ?? {};
          const extensionCount = Number(metadata.reviewTimeoutExtensions ?? 0);
          if (extensionCount < 1) {
            const charter = await loadLatestCharter(client, String(job.payload.roomId));
            const timeoutRules = parseJson<Record<string, number>>(charter?.timeout_rules ?? defaultTimeoutRules);
            const nextReviewDeadline = addHours(now(), timeoutRules.reviewWindowHours);
            await client.query(
              `
                UPDATE artifacts
                SET metadata = $2::jsonb
                WHERE id = $1
              `,
              [
                task.artifact_id,
                JSON.stringify({
                  ...metadata,
                  reviewDeadlineAt: nextReviewDeadline.toISOString(),
                  reviewTimeoutExtensions: extensionCount + 1
                })
              ]
            );
            await enqueueJob(client, {
              type: "TASK_REVIEW_TIMEOUT",
              runAt: nextReviewDeadline,
              payload: {
                roomId: String(job.payload.roomId),
                taskId: String(job.payload.taskId),
                artifactId: task.artifact_id,
                actorId: String(job.payload.actorId ?? "system")
              }
            });
          } else {
            await finalizeTaskReview(client, {
              roomId: String(job.payload.roomId),
              taskId: String(job.payload.taskId),
              actorId: "system",
              verdict: "ACCEPTED",
              notes: "Auto-accepted by review timeout"
            });
          }
        }
        break;
      }
      case "SETTLEMENT_VOTE_TIMEOUT": {
        await handleSettlementVoteTimeout(
          client,
          String(job.payload.roomId),
          String(job.payload.proposalId),
          String(job.payload.actorId ?? "system"),
          Number(job.payload.extensionCount ?? 0)
        );
        break;
      }
      case "DISPUTE_COOLING_OFF_END": {
        const disputes = await loadDisputes(client, String(job.payload.roomId));
        const dispute = disputes.find((item) => item.id === String(job.payload.disputeId));
        if (dispute?.status === "COOLING_OFF") {
          await client.query(
            `
              UPDATE dispute_cases
              SET status = 'OPEN',
                  response_deadline_at = $2,
                  updated_at = NOW()
              WHERE id = $1
            `,
            [dispute.id, addHours(now(), 24).toISOString()]
          );
        }
        break;
      }
      case "DISPUTE_PANEL_TIMEOUT": {
        await handleDisputeManualEscalation(
          client,
          String(job.payload.roomId),
          String(job.payload.disputeId),
          String(job.payload.actorId ?? "system"),
          "panel_timeout"
        );
        break;
      }
      case "DISPUTE_RESOLUTION_TIMEOUT": {
        await handleDisputeManualEscalation(
          client,
          String(job.payload.roomId),
          String(job.payload.disputeId),
          String(job.payload.actorId ?? "system"),
          "resolution_timeout"
        );
        break;
      }
      case "PAYMENT_HANDOFF_SEND": {
        await handlePaymentHandoffSend(
          client,
          String(job.payload.roomId),
          String(job.payload.proposalId)
        );
        break;
      }
      case "LEDGER_VERIFY": {
        await verifyRoomsIntegrity(
          typeof job.payload.roomId === "string" ? job.payload.roomId : undefined
        );
        await enqueueJob(client, {
          type: "LEDGER_VERIFY",
          runAt: addHours(now(), 24),
          payload: {
            actorId: String(job.payload.actorId ?? "system")
          }
        });
        break;
      }
      default:
        throw new DomainError(`Unknown job type ${job.type}`);
    }
  });
}

const WORKER_ID = `${process.pid}`;

async function ensureLedgerVerifyJob(client: PoolClient) {
  await client.query(
    `
      INSERT INTO job_queue (id, type, status, run_at, payload, attempts, max_attempts)
      SELECT $1, 'LEDGER_VERIFY', 'PENDING', NOW(), $2::jsonb, 0, 3
      WHERE NOT EXISTS (
        SELECT 1
        FROM job_queue
        WHERE type = 'LEDGER_VERIFY'
          AND status IN ('PENDING', 'RUNNING')
      )
    `,
    [randomUUID(), JSON.stringify({ actorId: "system" })]
  );
}

export async function processDueJobs(
  limit = 25,
  options: { requestedBy?: string; actorRole?: string } = {}
) {
  if (options.requestedBy && options.actorRole !== "ADMIN") {
    throw new DomainError("ADMIN_REQUIRED", `${options.requestedBy} is not authorized to run due jobs`);
  }

  const client = await getDbPool().connect();
  try {
    await ensureLedgerVerifyJob(client);
    // Recovery: reset stuck RUNNING jobs (timeout = 10 minutes)
    await client.query(`
      UPDATE job_queue
      SET status = 'PENDING',
          locked_at = NULL,
          locked_by = NULL,
          attempts = attempts + 1
      WHERE status = 'RUNNING'
        AND locked_at < NOW() - INTERVAL '10 minutes'
        AND attempts < 3
    `);

    // Hard-stop: jobs failed 3+ times → DEAD
    await client.query(`
      UPDATE job_queue
      SET status = 'DEAD'
      WHERE status = 'RUNNING'
        AND locked_at < NOW() - INTERVAL '10 minutes'
        AND attempts >= 3
    `);

    // Atomic SELECT + lock in one statement to prevent two workers picking the same job.
    // FOR UPDATE SKIP LOCKED ensures concurrent workers each claim distinct rows.
    const result = await client.query<JobRow>(
      `
        UPDATE job_queue
        SET status = 'RUNNING', locked_at = NOW(), locked_by = $3, updated_at = NOW()
        WHERE id IN (
          SELECT id FROM job_queue
          WHERE status = $1
            AND run_at <= NOW()
          ORDER BY run_at ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
      [PENDING_JOB_STATUS, limit, WORKER_ID]
    );

    const processed: Array<{ jobId: string; status: string; error?: string }> = [];
    for (const job of result.rows) {
      try {
        await processJob({
          ...job,
          payload: parseJson<JsonValue>(job.payload)
        });
        await client.query(
          "UPDATE job_queue SET status = 'DONE', locked_at = NULL, updated_at = NOW() WHERE id = $1",
          [job.id]
        );
        processed.push({ jobId: job.id, status: "DONE" });
      } catch (error) {
        const nextRunAt = addHours(now(), 1);
        const nextAttempts = job.attempts + 1;
        const nextStatus = nextAttempts >= job.max_attempts ? "FAILED" : PENDING_JOB_STATUS;
        await client.query(
          `
            UPDATE job_queue
            SET status = $2,
                attempts = $3,
                last_error = $4,
                run_at = $5,
                locked_at = NULL,
                updated_at = NOW()
            WHERE id = $1
          `,
          [job.id, nextStatus, nextAttempts, error instanceof Error ? error.message : String(error), nextRunAt.toISOString()]
        );
        processed.push({
          jobId: job.id,
          status: nextStatus,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      count: processed.length,
      jobs: processed
    };
  } finally {
    client.release();
  }
}

export async function getOperationalMetrics() {
  const client = await getDbPool().connect();
  try {
    const rooms = await client.query<{ status: string; count: string }>(
      "SELECT status, COUNT(*)::text AS count FROM rooms GROUP BY status"
    );
    const disputes = await client.query<{ status: string; count: string }>(
      "SELECT status, COUNT(*)::text AS count FROM dispute_cases GROUP BY status"
    );
    const settlements = await client.query<{ status: string; count: string }>(
      "SELECT status, COUNT(*)::text AS count FROM settlement_proposals GROUP BY status"
    );
    const failedJobs = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM job_queue WHERE status = 'FAILED'"
    );

    return {
      rooms: Object.fromEntries(rooms.rows.map((row) => [row.status, Number(row.count)])),
      disputes: Object.fromEntries(disputes.rows.map((row) => [row.status, Number(row.count)])),
      settlements: Object.fromEntries(settlements.rows.map((row) => [row.status, Number(row.count)])),
      failedJobs: Number(failedJobs.rows[0]?.count ?? 0)
    };
  } finally {
    client.release();
  }
}

export async function listJobs(limit = 100) {
  const client = await getDbPool().connect();
  try {
    const result = await client.query<JobRow>(
      `
        SELECT *
        FROM job_queue
        ORDER BY run_at ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      runAt: job.run_at.toISOString(),
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      lastError: job.last_error,
      payload: parseJson<JsonValue>(job.payload)
    }));
  } finally {
    client.release();
  }
}

export async function verifyRoomsIntegrity(roomId?: string) {
  const client = await getDbPool().connect();
  try {
    const rooms = roomId
      ? [await loadRoom(client, roomId)]
      : (await client.query<RoomRow>("SELECT * FROM rooms ORDER BY created_at ASC")).rows;
    const results = [];
    for (const room of rooms) {
      const events = await fetchRoomEvents(client, room.id);
      const verification = verifyEventChain(events);
      results.push({
        roomId: room.id,
        ok: verification.ok,
        errors: verification.errors,
        eventCount: events.length
      });
    }
    return results;
  } finally {
    client.release();
  }
}
