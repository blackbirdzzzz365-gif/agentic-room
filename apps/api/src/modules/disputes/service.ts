import type { FastifyInstance } from "fastify";
import { createDisputeCommandSchema } from "@agentic-room/contracts";
import { withTransaction, getDbPool } from "@agentic-room/db";
import { appendRoomEvent } from "@agentic-room/ledger";
import { assertInvariant, addHours, createId } from "../../lib/common.js";

export async function fileDispute(command: unknown) {
  const input = createDisputeCommandSchema.parse(command);
  return withTransaction(async (client) => {
    assertInvariant(input.evidence.length > 0, "dispute requires evidence");
    const disputeId = createId();
    const coolingOffExpiresAt = addHours(new Date(), 12);

    await client.query(
      `
        INSERT INTO dispute_cases (
          id, room_id, category, sub_type, claimant_id, respondent_id, filing_stake,
          remedy_sought, status, cooling_off_expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 0.03, $7, 'COOLING_OFF', $8)
      `,
      [
        disputeId,
        input.roomId,
        input.category,
        input.subType,
        input.actorId,
        input.respondentId,
        input.remedySought,
        coolingOffExpiresAt.toISOString()
      ]
    );

    for (const evidence of input.evidence) {
      await client.query(
        `
          INSERT INTO dispute_evidence (id, dispute_id, type, ledger_ref, submitted_by)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [createId(), disputeId, evidence.type, evidence.ledgerRef, input.actorId]
      );
    }

    await client.query(
      `
        INSERT INTO job_queue (id, type, status, run_at, payload)
        VALUES ($1, 'dispute_cooling_off', 'PENDING', $2, $3::jsonb)
      `,
      [createId(), coolingOffExpiresAt.toISOString(), JSON.stringify({ roomId: input.roomId, disputeId })]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "DISPUTE_FILED",
      actorId: input.actorId,
      payload: {
        disputeId,
        category: input.category,
        subType: input.subType,
        respondentId: input.respondentId
      }
    });

    return { disputeId, event };
  });
}

export async function assignPanel(roomId: string, disputeId: string, actorId: string, memberIds: string[]) {
  return withTransaction(async (client) => {
    for (const memberId of memberIds.slice(0, 3)) {
      await client.query(
        `
          INSERT INTO dispute_panel_members (dispute_id, member_id)
          VALUES ($1, $2)
          ON CONFLICT (dispute_id, member_id) DO NOTHING
        `,
        [disputeId, memberId]
      );
    }

    await client.query(
      `
        UPDATE dispute_cases
        SET status = 'PANEL_ASSIGNED',
            panel_deadline_at = NOW() + INTERVAL '72 hours',
            updated_at = NOW()
        WHERE id = $1 AND room_id = $2
      `,
      [disputeId, roomId]
    );

    await client.query(
      `
        INSERT INTO job_queue (id, type, status, run_at, payload)
        VALUES ($1, 'dispute_panel_timeout', 'PENDING', NOW() + INTERVAL '72 hours', $2::jsonb)
      `,
      [createId(), JSON.stringify({ roomId, disputeId })]
    );

    const event = await appendRoomEvent(client, {
      roomId,
      eventType: "DISPUTE_PANELED",
      actorId,
      payload: { disputeId, memberIds: memberIds.slice(0, 3) }
    });

    return { disputeId, event };
  });
}

export async function resolveDispute(roomId: string, disputeId: string, actorId: string, outcome: string, resolution: string) {
  return withTransaction(async (client) => {
    await client.query(
      `
        UPDATE dispute_cases
        SET status = 'RESOLVED',
            resolution = $3::jsonb,
            updated_at = NOW()
        WHERE id = $1 AND room_id = $2
      `,
      [disputeId, roomId, JSON.stringify({ outcome, resolution, resolvedAt: new Date().toISOString() })]
    );

    const event = await appendRoomEvent(client, {
      roomId,
      eventType: "DISPUTE_RESOLVED",
      actorId,
      payload: { disputeId, outcome, resolution }
    });

    return { disputeId, event };
  });
}

export async function listDisputes() {
  const result = await getDbPool().query(
    `
      SELECT *
      FROM dispute_cases
      ORDER BY created_at DESC
    `
  );
  return result.rows;
}

export function registerDisputeRoutes(app: FastifyInstance) {
  app.get("/api/disputes", async () => listDisputes());
  app.post("/api/rooms/:roomId/disputes", async (request) =>
    fileDispute({ ...(request.body as object), roomId: (request.params as { roomId: string }).roomId })
  );
  app.post("/api/rooms/:roomId/disputes/:disputeId/panel", async (request) =>
    assignPanel(
      (request.params as { roomId: string }).roomId,
      (request.params as { disputeId: string }).disputeId,
      (request.body as any).actorId,
      (request.body as any).memberIds
    )
  );
  app.post("/api/rooms/:roomId/disputes/:disputeId/resolve", async (request) =>
    resolveDispute(
      (request.params as { roomId: string }).roomId,
      (request.params as { disputeId: string }).disputeId,
      (request.body as any).actorId,
      (request.body as any).outcome,
      (request.body as any).resolution
    )
  );
}
