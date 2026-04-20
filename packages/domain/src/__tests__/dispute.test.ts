import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimTask, deliverTask, voteSettlement, assignDisputePanel } from "@agentic-room/domain";
import { getDbPool } from "@agentic-room/db";

vi.mock("@agentic-room/db", () => ({ getDbPool: vi.fn() }));

// ─── Valid v4 UUIDs ───────────────────────────────────────────────────────────
const roomId = randomUUID();
const taskId = randomUUID();
const charterId = randomUUID();
const disputeId = randomUUID();
const proposalId = randomUUID();

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

const ROOM_ROW = {
  id: roomId,
  name: "Test Room",
  requester_id: "req-1",
  coordinator_id: "coord-1",
  budget_total: "1000",
  status: "ACTIVE",
  phase: "2",
  execution_deadline_at: new Date(Date.now() + 86_400_000),
  created_at: new Date(),
  updated_at: new Date()
};

const CHARTER_ROW = {
  id: charterId,
  room_id: roomId,
  version: 1,
  baseline_split: { "agent-1": 0.5, "agent-2": 0.5 },
  discretionary_pool_pct: "0.05",
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

function makeDisputeRow(status: string) {
  return {
    id: disputeId,
    room_id: roomId,
    category: "OPERATIONAL",
    sub_type: "DELIVERY_REJECTION_CONTESTED",
    claimant_id: "agent-1",
    respondent_id: "agent-2",
    filing_stake: "30",
    remedy_sought: "re-deliver",
    status,
    cooling_off_expires_at: new Date(Date.now() + 3_600_000),
    response_deadline_at: null,
    panel_deadline_at: null,
    resolution: null,
    created_at: new Date(),
    updated_at: new Date()
  };
}

function makeMemberRow(id: string, role = "CONTRIBUTOR") {
  return {
    room_id: roomId,
    member_id: id,
    identity_ref: id,
    role,
    status: "ACTIVE",
    charter_signed: true,
    charter_signed_at: new Date(),
    stake_locked: "0",
    joined_at: new Date(),
    created_at: new Date(),
    updated_at: new Date()
  };
}

const TASK_ROW = {
  id: taskId,
  charter_id: charterId,
  room_id: roomId,
  title: "Task 1",
  description: "desc",
  deliverable_spec: "spec",
  effort_estimate: "M",
  weight: "100",
  dependencies: [],
  assigned_to: "agent-1",
  status: "CLAIMED",
  claim_deadline: null,
  delivery_deadline: new Date(Date.now() + 86_400_000),
  artifact_id: null,
  review_status: null,
  delivery_count: 0,
  created_at: new Date(),
  updated_at: new Date()
};

function makeEventRow(eventType: string) {
  return {
    id: randomUUID(),
    room_id: roomId,
    seq: 0,
    event_type: eventType,
    actor_id: "agent-1",
    payload: {},
    timestamp: new Date(),
    prev_hash: "GENESIS",
    hash: "fakehash"
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// T-03: Panel assignment with < 3 eligible members
// NOTE: assignDisputePanel currently only asserts candidatePanel.length > 0.
// The "rejects when only 2 eligible" test will FAIL (missing feature: require >= 3).
// The "rejects when all members are parties" test PASSES (length === 0 is caught).
// ─────────────────────────────────────────────────────────────────────────────
describe("T-03: Panel assignment < 3 eligible members", () => {
  beforeEach(() => vi.mocked(getDbPool).mockReset());

  // assignDisputePanel query sequence:
  // BEGIN · loadDisputes · loadLatestCharter · loadMembers ·
  // DELETE dispute_panel_members · (INSERT panel member) × panelCount ·
  // UPDATE dispute_cases · appendRoomEvent(SELECT) · appendRoomEvent(INSERT) ·
  // enqueueJob · COMMIT
  function panelResponses(allMembers: ReturnType<typeof makeMemberRow>[], panelCount: number) {
    return [
      { rows: [] },                                  // BEGIN
      { rows: [makeDisputeRow("OPEN")] },            // loadDisputes
      { rows: [CHARTER_ROW] },                       // loadLatestCharter
      { rows: allMembers },                          // loadMembers
      { rows: [] },                                  // DELETE dispute_panel_members
      ...Array(panelCount).fill({ rows: [] }),       // INSERT panel members × panelCount
      { rows: [] },                                  // UPDATE dispute_cases
      { rows: [] },                                  // appendRoomEvent SELECT
      { rows: [makeEventRow("DISPUTE_PANELED")] },   // appendRoomEvent INSERT
      { rows: [] },                                  // enqueueJob
      { rows: [] }                                   // COMMIT
    ];
  }

  it("rejects panel assignment when only 2 eligible members exist (< 3 required)", async () => {
    // 4 members total: claimant (agent-1) + respondent (agent-2) + 2 eligible
    const allMembers = [
      makeMemberRow("agent-1"),
      makeMemberRow("agent-2"),
      makeMemberRow("agent-3"),
      makeMemberRow("agent-4")
    ];
    // Only 2 eligible; code picks 2 — expected to fail per spec, currently passes
    mockPool(makeSeqClient(panelResponses(allMembers, 2)));

    await expect(
      assignDisputePanel({ roomId, disputeId, actorId: "coord-1" })
    ).rejects.toThrow(/insufficient.*panel|panel.*candidates|at least.*3|minimum.*3/i);
  });

  it("rejects when all members are parties to the dispute (0 eligible)", async () => {
    // Only claimant + respondent — 0 eligible → current code throws "At least one panelist"
    const allMembers = [makeMemberRow("agent-1"), makeMemberRow("agent-2")];
    mockPool(makeSeqClient(panelResponses(allMembers, 0)));

    await expect(
      assignDisputePanel({ roomId, disputeId, actorId: "coord-1" })
    ).rejects.toThrow(/panelist|panel|insufficient/i);
  });

  it("succeeds when >= 3 eligible members are available", async () => {
    // 5 members: 2 parties + 3 eligible
    const allMembers = [
      makeMemberRow("agent-1"),
      makeMemberRow("agent-2"),
      makeMemberRow("agent-3"),
      makeMemberRow("agent-4"),
      makeMemberRow("agent-5")
    ];
    mockPool(makeSeqClient(panelResponses(allMembers, 3)));

    const result = await assignDisputePanel({ roomId, disputeId, actorId: "coord-1" });
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-05: Cooling-off D-06 guard
// All D-06 guards are implemented; these tests should PASS.
// ─────────────────────────────────────────────────────────────────────────────
describe("T-05: Cooling-off D-06 guard", () => {
  beforeEach(() => vi.mocked(getDbPool).mockReset());

  // claimTask blocked early: BEGIN · assertActiveMember · ensureNoBlockingDisputes(count>0) · ROLLBACK
  function claimBlockedResponses() {
    return [
      { rows: [] },
      { rows: [{ status: "ACTIVE" }] },
      { rows: [{ count: "1" }] },   // blocking dispute found
      { rows: [] }                  // ROLLBACK
    ];
  }

  // claimTask succeeds past dispute check (ESCALATED_TO_MANUAL not in blocking set)
  function claimNotBlockedResponses() {
    return [
      { rows: [] },                                                            // BEGIN
      { rows: [{ status: "ACTIVE" }] },                                       // assertActiveMember
      { rows: [{ count: "0" }] },                                             // ensureNoBlockingDisputes — clear
      { rows: [ROOM_ROW] },                                                    // loadRoom
      { rows: [CHARTER_ROW] },                                                // loadLatestCharter
      { rows: [{ ...TASK_ROW, status: "OPEN", assigned_to: null }] },        // loadTasks
      { rows: [] },                                                            // UPDATE charter_tasks
      { rows: [] },                                                            // UPDATE room_members stake
      { rows: [] },                                                            // appendRoomEvent SELECT
      { rows: [makeEventRow("TASK_CLAIMED")] },                               // appendRoomEvent INSERT
      { rows: [] },                                                            // enqueueJob
      { rows: [] }                                                             // COMMIT
    ];
  }

  // deliverTask blocked: BEGIN · assertActiveMember · ensureNoBlockingDisputes · ROLLBACK
  function deliverBlockedResponses() {
    return [
      { rows: [] },
      { rows: [{ status: "ACTIVE" }] },
      { rows: [{ count: "1" }] },
      { rows: [] }
    ];
  }

  // voteSettlement blocked: BEGIN · assertActiveMember · ensureNoOpenDisputes · ROLLBACK
  function voteBlockedResponses() {
    return [
      { rows: [] },
      { rows: [{ status: "ACTIVE" }] },
      { rows: [{ count: "1" }] },
      { rows: [] }
    ];
  }

  it("claimTask is blocked when a COOLING_OFF dispute exists", async () => {
    mockPool(makeSeqClient(claimBlockedResponses()));

    await expect(
      claimTask({ actorId: "agent-1", actorRole: "CONTRIBUTOR", roomId, taskId })
    ).rejects.toThrow(/active dispute blocks/i);
  });

  it("claimTask is blocked when an OPEN dispute exists", async () => {
    mockPool(makeSeqClient(claimBlockedResponses()));

    await expect(
      claimTask({ actorId: "agent-1", actorRole: "CONTRIBUTOR", roomId, taskId })
    ).rejects.toThrow(/active dispute blocks/i);
  });

  it("claimTask proceeds when dispute is ESCALATED_TO_MANUAL (not in blocking set)", async () => {
    // ESCALATED_TO_MANUAL is excluded from EXECUTION_BLOCKING_DISPUTE_STATUSES,
    // so the SQL COUNT returns 0 and execution continues.
    mockPool(makeSeqClient(claimNotBlockedResponses()));

    const result = await claimTask({
      actorId: "agent-1",
      actorRole: "CONTRIBUTOR",
      roomId,
      taskId
    });

    expect(result.ok).toBe(true);
  });

  it("deliverTask is blocked when a COOLING_OFF dispute exists", async () => {
    mockPool(makeSeqClient(deliverBlockedResponses()));

    await expect(
      deliverTask({
        actorId: "agent-1",
        actorRole: "CONTRIBUTOR",
        roomId,
        taskId,
        contentRef: "ipfs://abc",
        contentType: "text/plain"
      })
    ).rejects.toThrow(/active dispute blocks/i);
  });

  it("voteSettlement is blocked by ESCALATED_TO_MANUAL (ensureNoOpenDisputes blocks all non-RESOLVED)", async () => {
    mockPool(makeSeqClient(voteBlockedResponses()));

    await expect(
      voteSettlement({
        actorId: "agent-1",
        actorRole: "CONTRIBUTOR",
        roomId,
        proposalId,
        vote: "ACCEPT"
      })
    ).rejects.toThrow(/open disputes block/i);
  });

  it("voteSettlement is blocked when a COOLING_OFF dispute exists", async () => {
    mockPool(makeSeqClient(voteBlockedResponses()));

    await expect(
      voteSettlement({
        actorId: "agent-1",
        actorRole: "CONTRIBUTOR",
        roomId,
        proposalId,
        vote: "ACCEPT"
      })
    ).rejects.toThrow(/open disputes block/i);
  });
});
