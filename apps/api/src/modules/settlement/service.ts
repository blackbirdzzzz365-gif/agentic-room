import type { FastifyInstance } from "fastify";
import { peerRatingCommandSchema, requesterRatingCommandSchema, settlementVoteCommandSchema } from "@agentic-room/contracts";
import { withTransaction } from "@agentic-room/db";
import { appendRoomEvent } from "@agentic-room/ledger";
import { computeSettlement } from "@agentic-room/settlement";
import { signAllocationPayload } from "@agentic-room/integrations";
import { assertInvariant, createId } from "../../lib/common.js";
import { getActiveMembers, getLatestCharter } from "../../lib/context.js";

async function getLatestProposal(client: any, roomId: string) {
  const result = await client.query(
    `
      SELECT *
      FROM settlement_proposals
      WHERE room_id = $1
      ORDER BY proposed_at DESC
      LIMIT 1
    `,
    [roomId]
  );
  return result.rows[0] ?? null;
}

export async function submitPeerRating(command: unknown) {
  const input = peerRatingCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO peer_ratings (room_id, rater_id, target_id, signal)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id, rater_id, target_id)
        DO UPDATE SET signal = EXCLUDED.signal, created_at = NOW()
      `,
      [input.roomId, input.actorId, input.targetId, input.signal]
    );
    return { roomId: input.roomId, stored: true };
  });
}

export async function submitRequesterRating(command: unknown) {
  const input = requesterRatingCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO requester_ratings (room_id, requester_id, target_id, rating)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id, requester_id, target_id)
        DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()
      `,
      [input.roomId, input.actorId, input.targetId, input.rating]
    );
    return { roomId: input.roomId, stored: true };
  });
}

export async function generateSettlementProposal(roomId: string, actorId = "SYSTEM") {
  return withTransaction(async (client) => {
    const charter = await getLatestCharter(client, roomId);
    assertInvariant(charter, "charter not found");

    const tasksResult = await client.query(
      `
        SELECT assigned_to, weight
        FROM charter_tasks
        WHERE room_id = $1
          AND status = 'ACCEPTED'
      `,
      [roomId]
    );

    const peerResult = await client.query(
      `
        SELECT target_id, signal
        FROM peer_ratings
        WHERE room_id = $1
      `,
      [roomId]
    );

    const requesterResult = await client.query(
      `
        SELECT target_id, rating
        FROM requester_ratings
        WHERE room_id = $1
      `,
      [roomId]
    );

    const computation = computeSettlement({
      baselineSplit: charter.baseline_split,
      acceptedTasks: tasksResult.rows.map((row: any) => ({ assignedTo: row.assigned_to, weight: Number(row.weight) })),
      peerRatings: peerResult.rows.map((row: any) => ({ targetId: row.target_id, signal: Number(row.signal) })),
      requesterRatings: requesterResult.rows.map((row: any) => ({ targetId: row.target_id, rating: Number(row.rating) })),
      bonusPoolPct: Number(charter.bonus_pool_pct),
      malusPoolPct: Number(charter.malus_pool_pct)
    });

    const proposalId = createId();
    await client.query(
      `
        INSERT INTO settlement_proposals (
          id, room_id, status, allocations, bonus_pool_used, malus_pool_reclaimed, computation_log
        ) VALUES ($1, $2, 'PENDING_REVIEW', $3::jsonb, 0, 0, $4::jsonb)
      `,
      [proposalId, roomId, JSON.stringify(computation.allocations), JSON.stringify(computation.records)]
    );

    for (const record of computation.records) {
      await client.query(
        `
          INSERT INTO contrib_records (
            room_id, agent_id, task_weight_sum, peer_adjustment, requester_adjustment, final_share, computation_log
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT (room_id, agent_id)
          DO UPDATE SET
            task_weight_sum = EXCLUDED.task_weight_sum,
            peer_adjustment = EXCLUDED.peer_adjustment,
            requester_adjustment = EXCLUDED.requester_adjustment,
            final_share = EXCLUDED.final_share,
            computation_log = EXCLUDED.computation_log,
            created_at = NOW()
        `,
        [
          roomId,
          record.agentId,
          record.taskWeightSum,
          record.peerAdjustment,
          record.requesterAdjustment,
          record.finalShare,
          JSON.stringify(record.computationLog)
        ]
      );
    }

    await client.query(
      `
        UPDATE rooms
        SET status = 'IN_SETTLEMENT', phase = '4', updated_at = NOW()
        WHERE id = $1
      `,
      [roomId]
    );

    await client.query(
      `
        INSERT INTO job_queue (id, type, status, run_at, payload)
        VALUES ($1, 'settlement_vote_timeout', 'PENDING', NOW() + INTERVAL '48 hours', $2::jsonb)
      `,
      [createId(), JSON.stringify({ roomId, proposalId })]
    );

    const event = await appendRoomEvent(client, {
      roomId,
      eventType: "SETTLEMENT_PROPOSED",
      actorId,
      payload: {
        proposalId,
        allocations: computation.allocations
      }
    });

    return { proposalId, event, allocations: computation.allocations };
  });
}

export async function voteOnSettlement(command: unknown) {
  const input = settlementVoteCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO settlement_votes (id, proposal_id, room_id, agent_id, vote, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (proposal_id, agent_id)
        DO UPDATE SET vote = EXCLUDED.vote, reason = EXCLUDED.reason, submitted_at = NOW()
      `,
      [createId(), input.proposalId, input.roomId, input.actorId, input.vote, input.reason ?? null]
    );

    await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "SETTLEMENT_VOTE",
      actorId: input.actorId,
      payload: {
        proposalId: input.proposalId,
        vote: input.vote,
        reason: input.reason ?? null
      }
    });

    const activeMembers = await getActiveMembers(client, input.roomId);
    const votesResult = await client.query(
      `
        SELECT vote
        FROM settlement_votes
        WHERE proposal_id = $1
      `,
      [input.proposalId]
    );
    const votes = votesResult.rows.map((row: any) => row.vote);
    const quorumReached = votes.length >= Math.ceil(activeMembers.length * 0.6);
    const acceptVotes = votes.filter((vote: string) => vote === "ACCEPT").length;
    const acceptRatio = votes.length > 0 ? acceptVotes / votes.length : 0;

    if (quorumReached && acceptRatio >= 2 / 3) {
      const finalized = await finalizeSettlementInternal(client, input.roomId, input.proposalId);
      return { roomId: input.roomId, finalized: true, ...finalized };
    }

    return { roomId: input.roomId, finalized: false };
  });
}

async function finalizeSettlementInternal(client: any, roomId: string, proposalId: string) {
  const proposal = await getLatestProposal(client, roomId);
  assertInvariant(proposal?.id === proposalId, "proposal not found");

  const payload = JSON.stringify({
    roomId,
    proposalId,
    allocations: proposal.allocations
  });
  const signaturePayload = signAllocationPayload(payload);

  await client.query(
    `
      UPDATE settlement_proposals
      SET status = 'FINAL',
          finalized_at = NOW(),
          signature_payload = $3::jsonb
      WHERE id = $1 AND room_id = $2
    `,
    [proposalId, roomId, JSON.stringify(signaturePayload)]
  );

  await client.query(
    `
      INSERT INTO payment_handoffs (id, room_id, proposal_id, status, payload)
      VALUES ($1, $2, $3, 'PENDING', $4::jsonb)
    `,
    [createId(), roomId, proposalId, JSON.stringify({ allocations: proposal.allocations, signaturePayload })]
  );

  await client.query(
    `
      UPDATE rooms
      SET status = 'SETTLED', phase = '5', updated_at = NOW()
      WHERE id = $1
    `,
    [roomId]
  );

  await appendRoomEvent(client, {
    roomId,
    eventType: "SETTLEMENT_FINAL",
    actorId: "SYSTEM",
    payload: {
      proposalId,
      allocations: proposal.allocations,
      signaturePayload
    }
  });

  await appendRoomEvent(client, {
    roomId,
    eventType: "ROOM_SETTLED",
    actorId: "SYSTEM",
    payload: {
      proposalId
    }
  });

  return { proposalId, signaturePayload };
}

export function registerSettlementRoutes(app: FastifyInstance) {
  app.post("/api/rooms/:roomId/ratings/peer", async (request) =>
    submitPeerRating({ ...(request.body as object), roomId: (request.params as { roomId: string }).roomId })
  );
  app.post("/api/rooms/:roomId/ratings/requester", async (request) =>
    submitRequesterRating({ ...(request.body as object), roomId: (request.params as { roomId: string }).roomId })
  );
  app.post("/api/rooms/:roomId/settlement/propose", async (request) =>
    generateSettlementProposal((request.params as { roomId: string }).roomId, (request.body as any)?.actorId ?? "SYSTEM")
  );
  app.post("/api/rooms/:roomId/settlement/:proposalId/vote", async (request) =>
    voteOnSettlement({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      proposalId: (request.params as { proposalId: string }).proposalId
    })
  );
}
