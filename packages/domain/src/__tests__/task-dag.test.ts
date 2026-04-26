import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCharter, claimTask } from "@agentic-room/domain";
import { getDbPool } from "@agentic-room/db";

vi.mock("@agentic-room/db", () => ({ getDbPool: vi.fn() }));

// ─── Valid v4 UUIDs ───────────────────────────────────────────────────────────
const roomId = randomUUID();
const charterId = randomUUID();
const taskIdA = randomUUID();
const taskIdB = randomUUID();
const taskIdC = randomUUID();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSeqClient(responses: { rows: unknown[] }[]) {
  let idx = 0;
  return {
    query: vi.fn(() => {
      const resp = responses[idx] ?? { rows: [] };
      idx++;
      return Promise.resolve(resp);
    }),
    release: vi.fn()
  };
}

function mockPool(client: ReturnType<typeof makeSeqClient>) {
  vi.mocked(getDbPool).mockReturnValueOnce({
    connect: vi.fn().mockResolvedValue(client)
  } as never);
}

const MISSION_ROW = {
  room_id: roomId,
  raw_input: "build something",
  structured: {
    objective: "Build it",
    deliverables: ["deliverable"],
    constraints: [],
    successCriteria: [],
    outOfScope: []
  },
  confirmed_at: new Date(),
  created_at: new Date(),
  updated_at: new Date()
};

const ROOM_ROW_CHARTER = {
  id: roomId,
  name: "Test Room",
  requester_id: "req-1",
  coordinator_id: "coord-1",
  budget_total: "1000",
  status: "PENDING_CHARTER",
  phase: "1",
  execution_deadline_at: new Date(Date.now() + 86_400_000),
  created_at: new Date(),
  updated_at: new Date()
};

const ROOM_ROW_ACTIVE = {
  ...ROOM_ROW_CHARTER,
  status: "ACTIVE",
  phase: "2"
};

const CHARTER_ROW = {
  id: charterId,
  room_id: roomId,
  version: 1,
  baseline_split: { "agent-1": 0.5, "agent-2": 0.5 },
  bonus_pool_pct: "0.03",
  malus_pool_pct: "0.02",
  consensus_config: { settlementQuorumRatio: 0.6, settlementAcceptRatio: 0.666 },
  timeout_rules: {
    invitationWindowHours: 48,
    charterSignWindowHours: 24,
    taskClaimWindowHours: 24,
    reviewWindowHours: 24,
    settlementVoteWindowHours: 48,
    disputeCoolingOffHours: 12,
    panelReviewWindowHours: 72,
    disputeResolutionWindowHours: 120
  },
  status: "SIGNED",
  sign_deadline: null,
  created_at: new Date(),
  updated_at: new Date()
};

function charterEventRow() {
  return {
    id: randomUUID(),
    room_id: roomId,
    seq: 0,
    event_type: "CHARTER_PROPOSED",
    actor_id: "coord-1",
    payload: {},
    timestamp: new Date(),
    prev_hash: "GENESIS",
    hash: "fakehash"
  };
}

function claimEventRow() {
  return {
    id: randomUUID(),
    room_id: roomId,
    seq: 0,
    event_type: "TASK_CLAIMED",
    actor_id: "agent-1",
    payload: {},
    timestamp: new Date(),
    prev_hash: "GENESIS",
    hash: "fakehash"
  };
}

// createCharter query sequence (for N tasks):
// BEGIN · loadMission · loadRoom · loadLatestCharter · INSERT charters ·
// (INSERT charter_tasks) × N · UPDATE room_members · touchRoom ·
// appendRoomEvent(SELECT) · appendRoomEvent(INSERT) · enqueueJob · COMMIT
function createCharterResponses(taskCount: number) {
  return [
    { rows: [] },                            // BEGIN
    { rows: [MISSION_ROW] },                 // loadMission (ensureMissionConfirmed)
    { rows: [ROOM_ROW_CHARTER] },            // loadRoom
    { rows: [] },                            // loadLatestCharter — no prior charter
    { rows: [] },                            // INSERT INTO charters
    ...Array(taskCount).fill({ rows: [] }), // INSERT charter_tasks × N
    { rows: [] },                            // UPDATE room_members charter_signed
    { rows: [] },                            // touchRoom
    { rows: [] },                            // appendRoomEvent SELECT
    { rows: [charterEventRow()] },           // appendRoomEvent INSERT
    { rows: [] },                            // enqueueJob
    { rows: [] }                             // COMMIT
  ];
}

function draftBase() {
  return {
    bonusPoolPct: 0.05,
    malusPoolPct: 0.02,
    baselineSplit: { "agent-1": 0.5, "agent-2": 0.5 } as Record<string, number>,
    consensusConfig: { settlementQuorumRatio: 0.6, settlementAcceptRatio: 0.666 },
    timeoutRules: {
      invitationWindowHours: 48,
      charterSignWindowHours: 24,
      taskClaimWindowHours: 24,
      reviewWindowHours: 24,
      settlementVoteWindowHours: 48,
      disputeCoolingOffHours: 12,
      panelReviewWindowHours: 72,
      disputeResolutionWindowHours: 120
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// T-02: Circular DAG rejection
// NOTE: createCharter currently has NO cycle-detection logic. The two reject
// tests will FAIL until a cycle guard is added to service.ts.
// The two accept tests verify that valid graphs are not rejected.
// ─────────────────────────────────────────────────────────────────────────────
describe("T-02: Circular DAG rejection", () => {
  beforeEach(() => vi.mocked(getDbPool).mockReset());

  it("rejects a direct cycle A → B → A", async () => {
    mockPool(makeSeqClient(createCharterResponses(2)));

    await expect(
      createCharter({
        actorId: "coord-1",
        actorRole: "COORDINATOR",
        roomId,
        draft: {
          ...draftBase(),
          tasks: [
            { id: taskIdA, title: "Task A", description: "A", deliverableSpec: "spec", effortEstimate: "M", weight: 50, dependencies: [taskIdB] },
            { id: taskIdB, title: "Task B", description: "B", deliverableSpec: "spec", effortEstimate: "M", weight: 50, dependencies: [taskIdA] }
          ]
        }
      })
    ).rejects.toThrow(/cycle|dag|circular/i);
  });

  it("rejects an indirect cycle A → B → C → A", async () => {
    mockPool(makeSeqClient(createCharterResponses(3)));

    await expect(
      createCharter({
        actorId: "coord-1",
        actorRole: "COORDINATOR",
        roomId,
        draft: {
          ...draftBase(),
          baselineSplit: { "agent-1": 0.34, "agent-2": 0.33, "agent-3": 0.33 },
          tasks: [
            { id: taskIdA, title: "A", description: "A", deliverableSpec: "s", effortEstimate: "M", weight: 34, dependencies: [taskIdB] },
            { id: taskIdB, title: "B", description: "B", deliverableSpec: "s", effortEstimate: "M", weight: 33, dependencies: [taskIdC] },
            { id: taskIdC, title: "C", description: "C", deliverableSpec: "s", effortEstimate: "M", weight: 33, dependencies: [taskIdA] }
          ]
        }
      })
    ).rejects.toThrow(/cycle|dag|circular/i);
  });

  it("accepts a valid fan-out A → B, A → C", async () => {
    mockPool(makeSeqClient(createCharterResponses(3)));

    const result = await createCharter({
      actorId: "coord-1",
      actorRole: "COORDINATOR",
      roomId,
      draft: {
        ...draftBase(),
        baselineSplit: { "agent-1": 0.34, "agent-2": 0.33, "agent-3": 0.33 },
        tasks: [
          { id: taskIdA, title: "A", description: "A", deliverableSpec: "s", effortEstimate: "M", weight: 34, dependencies: [] },
          { id: taskIdB, title: "B", description: "B", deliverableSpec: "s", effortEstimate: "M", weight: 33, dependencies: [taskIdA] },
          { id: taskIdC, title: "C", description: "C", deliverableSpec: "s", effortEstimate: "M", weight: 33, dependencies: [taskIdA] }
        ]
      }
    });

    expect(result.ok).toBe(true);
  });

  it("accepts a valid chain A → B → C", async () => {
    mockPool(makeSeqClient(createCharterResponses(3)));

    const result = await createCharter({
      actorId: "coord-1",
      actorRole: "COORDINATOR",
      roomId,
      draft: {
        ...draftBase(),
        baselineSplit: { "agent-1": 0.34, "agent-2": 0.33, "agent-3": 0.33 },
        tasks: [
          { id: taskIdA, title: "A", description: "A", deliverableSpec: "s", effortEstimate: "M", weight: 34, dependencies: [] },
          { id: taskIdB, title: "B", description: "B", deliverableSpec: "s", effortEstimate: "M", weight: 33, dependencies: [taskIdA] },
          { id: taskIdC, title: "C", description: "C", deliverableSpec: "s", effortEstimate: "M", weight: 33, dependencies: [taskIdB] }
        ]
      }
    });

    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-04: Out-of-order DAG claiming
// ensureDependenciesAccepted is already implemented — these tests should PASS.
// ─────────────────────────────────────────────────────────────────────────────
describe("T-04: Out-of-order DAG claiming", () => {
  beforeEach(() => vi.mocked(getDbPool).mockReset());

  function makeTaskRowForDag(
    id: string,
    status: string,
    dependencies: string[],
    assigned_to: string | null = null
  ) {
    return {
      id,
      charter_id: charterId,
      room_id: roomId,
      title: `Task ${id.slice(-4)}`,
      description: "desc",
      deliverable_spec: "spec",
      effort_estimate: "M",
      weight: "50",
      dependencies,
      assigned_to,
      status,
      claim_deadline: null,
      delivery_deadline: null,
      artifact_id: null,
      review_status: null,
      delivery_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // claimTask query sequence
  function claimResponses(tasks: unknown[], targetTaskId = taskIdB) {
    return [
      { rows: [] },                           // BEGIN
      { rowCount: 1, rows: [{ "?column?": 1 }] },       // assertActiveMember
      { rowCount: 0, rows: [] },             // ensureNoBlockingDisputes
      { rows: [ROOM_ROW_ACTIVE] },            // loadRoom
      { rows: [CHARTER_ROW] },               // loadLatestCharter
      { rows: tasks },                        // loadTasks
      { rows: [{ status: "OPEN" }] },         // BUG-03: FOR UPDATE lock (only hit on success path)
      { rows: [] },                           // UPDATE charter_tasks
      { rows: [] },                           // UPDATE room_members stake
      { rows: [] },                           // appendRoomEvent SELECT
      { rows: [claimEventRow()] },            // appendRoomEvent INSERT
      { rows: [] },                           // enqueueJob
      { rows: [] }                            // COMMIT
    ];
  }

  it("blocks claiming Task B when dependency Task A is OPEN", async () => {
    const tasks = [
      makeTaskRowForDag(taskIdA, "OPEN", []),
      makeTaskRowForDag(taskIdB, "OPEN", [taskIdA])
    ];
    mockPool(makeSeqClient(claimResponses(tasks)));

    await expect(
      claimTask({ actorId: "agent-1", actorRole: "CONTRIBUTOR", roomId, taskId: taskIdB })
    ).rejects.toThrow(/must be accepted before/i);
  });

  it("blocks claiming Task B when dependency Task A is CLAIMED but not ACCEPTED", async () => {
    const tasks = [
      makeTaskRowForDag(taskIdA, "CLAIMED", [], "agent-2"),
      makeTaskRowForDag(taskIdB, "OPEN", [taskIdA])
    ];
    mockPool(makeSeqClient(claimResponses(tasks)));

    await expect(
      claimTask({ actorId: "agent-1", actorRole: "CONTRIBUTOR", roomId, taskId: taskIdB })
    ).rejects.toThrow(/must be accepted before/i);
  });

  it("allows claiming Task B once Task A is ACCEPTED", async () => {
    const tasks = [
      makeTaskRowForDag(taskIdA, "ACCEPTED", []),
      makeTaskRowForDag(taskIdB, "OPEN", [taskIdA])
    ];
    mockPool(makeSeqClient(claimResponses(tasks)));

    const result = await claimTask({
      actorId: "agent-1",
      actorRole: "CONTRIBUTOR",
      roomId,
      taskId: taskIdB
    });

    expect(result.ok).toBe(true);
  });

  it("allows claiming Task A with no dependencies at any time", async () => {
    const taskA = { ...makeTaskRowForDag(taskIdA, "OPEN", []), weight: "100" };
    mockPool(makeSeqClient(claimResponses([taskA], taskIdA)));

    const result = await claimTask({
      actorId: "agent-1",
      actorRole: "CONTRIBUTOR",
      roomId,
      taskId: taskIdA
    });

    expect(result.ok).toBe(true);
  });
});
