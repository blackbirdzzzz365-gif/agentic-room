import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignDisputePanel,
  declineCharter,
  inviteMember,
  processDueJobs,
  recordPeerRating,
  recordRequesterRating,
  reviewTask
} from "@agentic-room/domain";
import { getDbPool } from "@agentic-room/db";

vi.mock("@agentic-room/db", () => ({ getDbPool: vi.fn() }));

const roomId = randomUUID();
const taskId = randomUUID();
const proposalId = randomUUID();
const charterId = randomUUID();

function makeSeqClient(responses: Array<{ rows?: unknown[]; rowCount?: number }>) {
  let index = 0;
  return {
    query: vi.fn(() => Promise.resolve(responses[index++] ?? { rows: [] })),
    release: vi.fn()
  };
}

function mockPool(...clients: Array<ReturnType<typeof makeSeqClient>>) {
  const connect = vi.fn();
  for (const client of clients) {
    connect.mockResolvedValueOnce(client);
  }
  vi.mocked(getDbPool).mockReturnValue({
    connect
  } as never);
}

const deliveredTask = {
  id: taskId,
  charter_id: charterId,
  room_id: roomId,
  title: "Review me",
  description: "desc",
  deliverable_spec: "spec",
  effort_estimate: "M",
  weight: "10",
  dependencies: [],
  assigned_to: "agent-1",
  status: "DELIVERED",
  claim_deadline: null,
  delivery_deadline: null,
  artifact_id: randomUUID(),
  review_status: "PENDING",
  delivery_count: 1,
  created_at: new Date(),
  updated_at: new Date()
};

const roomRow = {
  id: roomId,
  name: "Pilot Room",
  requester_id: "requester-1",
  coordinator_id: "coord-1",
  budget_total: "1000",
  status: "IN_SETTLEMENT",
  phase: "4",
  execution_deadline_at: new Date(Date.now() + 60_000),
  created_at: new Date(),
  updated_at: new Date()
};

const charterRow = {
  id: charterId,
  room_id: roomId,
  version: 1,
  baseline_split: { "agent-1": 0.5, "agent-2": 0.5 },
  bonus_pool_pct: "0.1",
  malus_pool_pct: "0.05",
  consensus_config: { settlementQuorumRatio: 0.6, settlementAcceptRatio: 0.6666666667 },
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

describe("phase 1 hardening", () => {
  beforeEach(() => vi.mocked(getDbPool).mockReset());

  it("rejects member invites from non-coordinator actors", async () => {
    const client = makeSeqClient([
      { rows: [] },
      {
        rows: [
          {
            room_id: roomId,
            raw_input: "mission",
            structured: {},
            confirmed_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      },
      { rows: [roomRow] },
      { rows: [] },
      { rows: [] }
    ]);
    mockPool(client);

    await expect(
      inviteMember({
        roomId,
        actorId: "agent-1",
        memberId: "intruder-1",
        identityRef: "intruder-1",
        role: "COORDINATOR"
      })
    ).rejects.toThrow(/not authorized|UNAUTHORIZED/i);
  });

  it("rejects charter decline from actors outside the room", async () => {
    const client = makeSeqClient([
      { rows: [] },
      { rows: [roomRow] },
      { rows: [] },
      { rows: [] }
    ]);
    mockPool(client);

    await expect(
      declineCharter({
        roomId,
        charterId,
        actorId: "intruder-1",
        reason: "griefing"
      })
    ).rejects.toThrow(/not an active member|NOT_A_MEMBER|UNAUTHORIZED/i);
  });

  it("rejects explicit dispute panelists who are not eligible", async () => {
    const disputeId = randomUUID();
    const client = makeSeqClient([
      { rows: [] },
      { rows: [roomRow] },
      {
        rows: [
          {
            id: disputeId,
            room_id: roomId,
            category: "OPERATIONAL",
            sub_type: "delivery_quality",
            claimant_id: "agent-1",
            respondent_id: "agent-2",
            filing_stake: "10",
            remedy_sought: "review",
            status: "OPEN",
            cooling_off_expires_at: new Date(),
            response_deadline_at: null,
            panel_deadline_at: null,
            resolution: null,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      },
      { rows: [charterRow] },
      {
        rows: [
          { member_id: "agent-1", status: "ACTIVE", role: "CONTRIBUTOR" },
          { member_id: "agent-2", status: "ACTIVE", role: "CONTRIBUTOR" },
          { member_id: "agent-3", status: "ACTIVE", role: "CONTRIBUTOR" },
          { member_id: "agent-4", status: "ACTIVE", role: "CONTRIBUTOR" },
          { member_id: "agent-5", status: "ACTIVE", role: "CONTRIBUTOR" }
        ]
      },
      { rows: [] }
    ]);
    mockPool(client);

    await expect(
      assignDisputePanel({
        roomId,
        disputeId,
        actorId: "coord-1",
        panelists: ["agent-1", "agent-3", "agent-4"]
      })
    ).rejects.toThrow(/PANEL_INELIGIBLE|not eligible/i);
  });

  it("rejects manual job execution from non-admin actors", async () => {
    await expect(
      processDueJobs(25, {
        requestedBy: "agent-1",
        actorRole: "CONTRIBUTOR"
      })
    ).rejects.toThrow(/ADMIN_REQUIRED|not authorized/i);
  });

  it("rejects task review from an active contributor without reviewer authority", async () => {
    const client = makeSeqClient([
      { rows: [] },
      { rows: [deliveredTask] },
      { rows: [roomRow] },
      {
        rows: [
          {
            room_id: roomId,
            member_id: "agent-2",
            identity_ref: "agent-2",
            role: "CONTRIBUTOR",
            status: "ACTIVE",
            charter_signed: true,
            charter_signed_at: new Date(),
            stake_locked: "0",
            joined_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      },
      { rows: [] }
    ]);
    mockPool(client);

    await expect(
      reviewTask({
        roomId,
        taskId,
        actorId: "agent-2",
        verdict: "ACCEPTED",
        notes: "looks good"
      })
    ).rejects.toThrow(/not allowed to review|UNAUTHORIZED/i);
  });

  it("rejects peer self-rating even from an active member", async () => {
    const client = makeSeqClient([
      { rows: [] },
      { rowCount: 1, rows: [{ ok: 1 }] },
      {
        rows: [
          {
            room_id: roomId,
            member_id: "agent-1",
            identity_ref: "agent-1",
            role: "CONTRIBUTOR",
            status: "ACTIVE",
            charter_signed: true,
            charter_signed_at: new Date(),
            stake_locked: "0",
            joined_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      },
      { rows: [] }
    ]);
    mockPool(client);

    await expect(
      recordPeerRating({
        roomId,
        actorId: "agent-1",
        targetId: "agent-1",
        signal: 1
      })
    ).rejects.toThrow(/Self-rating is not allowed/i);
  });

  it("rejects requester rating from a non-requester actor", async () => {
    const client = makeSeqClient([
      { rows: [] },
      { rows: [roomRow] },
      { rows: [] }
    ]);
    mockPool(client);

    await expect(
      recordRequesterRating({
        roomId,
        actorId: "agent-1",
        targetId: "agent-2",
        rating: 8
      })
    ).rejects.toThrow(/not the requester|UNAUTHORIZED/i);
  });

  it("moves settlement to manual review after the vote timeout extension is exhausted", async () => {
    const outerClient = makeSeqClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      {
        rows: [
          {
            id: randomUUID(),
            type: "SETTLEMENT_VOTE_TIMEOUT",
            status: "RUNNING",
            run_at: new Date(),
            payload: {
              roomId,
              proposalId,
              actorId: "system",
              extensionCount: 1
            },
            attempts: 0,
            max_attempts: 10,
            last_error: null,
            locked_by: "worker-1"
          }
        ]
      },
      { rows: [] }
    ]);
    const innerClient = makeSeqClient([
      { rows: [] },
      {
        rows: [
          {
            id: proposalId,
            room_id: roomId,
            status: "PENDING_REVIEW",
            allocations: { "agent-1": 500, "agent-2": 500 },
            bonus_pool_used: "100",
            malus_pool_reclaimed: "25",
            computation_log: {},
            signature_payload: null,
            proposed_at: new Date(),
            finalized_at: null
          }
        ]
      },
      { rows: [] },
      {
        rows: [
          {
            room_id: roomId,
            member_id: "agent-1",
            identity_ref: "agent-1",
            role: "CONTRIBUTOR",
            status: "ACTIVE",
            charter_signed: true,
            charter_signed_at: new Date(),
            stake_locked: "0",
            joined_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            room_id: roomId,
            member_id: "agent-2",
            identity_ref: "agent-2",
            role: "CONTRIBUTOR",
            status: "ACTIVE",
            charter_signed: true,
            charter_signed_at: new Date(),
            stake_locked: "0",
            joined_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      },
      { rows: [charterRow] },
      { rows: [] },
      { rows: [] },
      { rows: [] }
    ]);
    mockPool(outerClient, innerClient);

    const result = await processDueJobs(10);

    expect(result.count).toBe(1);
    expect(
      innerClient.query.mock.calls.some(
        ([sql]) =>
          typeof sql === "string" &&
          sql.includes("UPDATE settlement_proposals") &&
          sql.includes("MANUAL_REVIEW")
      )
    ).toBe(true);
  });
});
