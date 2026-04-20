import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimTask } from "@agentic-room/domain";
import { getDbPool } from "@agentic-room/db";

vi.mock("@agentic-room/db", () => ({ getDbPool: vi.fn() }));

// ─── Valid v4 UUIDs ───────────────────────────────────────────────────────────
const roomId = randomUUID();
const taskId = randomUUID();
const charterId = randomUUID();

const BASE_ROOM = {
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

const BASE_CHARTER = {
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

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: taskId,
    charter_id: charterId,
    room_id: roomId,
    title: "Task 1",
    description: "Do something",
    deliverable_spec: "Spec",
    effort_estimate: "M",
    weight: "100",
    dependencies: [],
    assigned_to: null,
    status: "OPEN",
    claim_deadline: null,
    delivery_deadline: null,
    artifact_id: null,
    review_status: null,
    delivery_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
}

const EVENT_ROW = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSeqClient(responses: { rows: unknown[] }[]) {
  let idx = 0;
  const client = {
    query: vi.fn(() => {
      const resp = responses[idx] ?? { rows: [] };
      idx++;
      return Promise.resolve(resp);
    }),
    release: vi.fn()
  };
  return client;
}

function mockPool(client: ReturnType<typeof makeSeqClient>) {
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  vi.mocked(getDbPool).mockReturnValueOnce(pool as never);
  return pool;
}

// Query sequence for a successful claimTask:
// BEGIN · assertActiveMember · ensureNoBlockingDisputes · loadRoom ·
// loadLatestCharter · loadTasks · UPDATE charter_tasks · UPDATE room_members ·
// appendRoomEvent(SELECT last) · appendRoomEvent(INSERT) · enqueueJob · COMMIT
function claimSuccessResponses(taskStatus = "OPEN", assignedTo: string | null = null) {
  return [
    { rows: [] },                                                                      // BEGIN
    { rows: [{ status: "ACTIVE" }] },                                                 // assertActiveMember
    { rows: [{ count: "0" }] },                                                       // ensureNoBlockingDisputes
    { rows: [BASE_ROOM] },                                                             // loadRoom
    { rows: [BASE_CHARTER] },                                                          // loadLatestCharter
    { rows: [makeTaskRow({ status: taskStatus, assigned_to: assignedTo })] },         // loadTasks
    { rows: [] },                                                                      // UPDATE charter_tasks
    { rows: [] },                                                                      // UPDATE room_members stake
    { rows: [] },                                                                      // appendRoomEvent SELECT
    { rows: [EVENT_ROW] },                                                             // appendRoomEvent INSERT
    { rows: [] },                                                                      // enqueueJob
    { rows: [] }                                                                       // COMMIT
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("T-01: Concurrent claim race", () => {
  beforeEach(() => {
    vi.mocked(getDbPool).mockReset();
  });

  it("agent-1 claims successfully when task is OPEN", async () => {
    mockPool(makeSeqClient(claimSuccessResponses("OPEN")));

    const result = await claimTask({
      actorId: "agent-1",
      actorRole: "CONTRIBUTOR",
      roomId,
      taskId
    });

    expect(result.ok).toBe(true);
    expect(result.roomId).toBe(roomId);
  });

  it("agent-2 is rejected when task is already CLAIMED (post-commit DB state)", async () => {
    // Simulates: agent-1 committed first; DB now shows CLAIMED
    mockPool(
      makeSeqClient([
        { rows: [] },                                                            // BEGIN
        { rows: [{ status: "ACTIVE" }] },                                       // assertActiveMember
        { rows: [{ count: "0" }] },                                             // ensureNoBlockingDisputes
        { rows: [BASE_ROOM] },                                                   // loadRoom
        { rows: [BASE_CHARTER] },                                                // loadLatestCharter
        { rows: [makeTaskRow({ status: "CLAIMED", assigned_to: "agent-1" })] }, // loadTasks — already claimed
        { rows: [] }                                                             // ROLLBACK
      ])
    );

    await expect(
      claimTask({ actorId: "agent-2", actorRole: "CONTRIBUTOR", roomId, taskId })
    ).rejects.toThrow(/not claimable/i);
  });

  it("exactly one agent wins when both race for the same task", async () => {
    // Agent-1 wins
    mockPool(makeSeqClient(claimSuccessResponses("OPEN")));
    const winner = await claimTask({
      actorId: "agent-1",
      actorRole: "CONTRIBUTOR",
      roomId,
      taskId
    });
    expect(winner.ok).toBe(true);

    // Agent-2 loses — DB reflects the committed state from agent-1
    mockPool(
      makeSeqClient([
        { rows: [] },
        { rows: [{ status: "ACTIVE" }] },
        { rows: [{ count: "0" }] },
        { rows: [BASE_ROOM] },
        { rows: [BASE_CHARTER] },
        { rows: [makeTaskRow({ status: "CLAIMED", assigned_to: "agent-1" })] },
        { rows: [] }
      ])
    );

    let loserError: Error | null = null;
    try {
      await claimTask({ actorId: "agent-2", actorRole: "CONTRIBUTOR", roomId, taskId });
    } catch (err) {
      loserError = err as Error;
    }

    expect(loserError).not.toBeNull();
    expect(loserError!.message).toMatch(/not claimable/i);
  });
});
