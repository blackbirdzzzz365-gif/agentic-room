import type { FastifyInstance } from "fastify";
import { getDbPool, withTransaction } from "@agentic-room/db";
import { appendRoomEvent, fetchRoomEvents, verifyEventChain } from "@agentic-room/ledger";
import { replayRoomEvents } from "@agentic-room/domain";

export async function listAdminRooms() {
  const result = await getDbPool().query(
    `
      SELECT id, name, status, phase, execution_deadline_at, updated_at
      FROM rooms
      ORDER BY updated_at DESC
    `
  );
  return result.rows;
}

export async function listPendingJobs() {
  const result = await getDbPool().query(
    `
      SELECT *
      FROM job_queue
      WHERE status = 'PENDING'
      ORDER BY run_at ASC
    `
  );
  return result.rows;
}

export async function replayRoom(roomId: string) {
  const pool = getDbPool();
  const events = await fetchRoomEvents(pool, roomId);
  return replayRoomEvents(events);
}

export async function verifyRoomIntegrity(roomId: string) {
  const pool = getDbPool();
  const events = await fetchRoomEvents(pool, roomId);
  return verifyEventChain(events);
}

export async function manualOverride(roomId: string, actorId: string, action: string, details: Record<string, unknown>) {
  return withTransaction(async (client) => {
    const event = await appendRoomEvent(client, {
      roomId,
      eventType: "MANUAL_OVERRIDE",
      actorId,
      payload: {
        action,
        details
      }
    });

    return { roomId, event };
  });
}

export function registerAdminRoutes(app: FastifyInstance) {
  app.get("/api/admin/rooms", async () => listAdminRooms());
  app.get("/api/admin/jobs", async () => listPendingJobs());
  app.get("/api/admin/rooms/:roomId/replay", async (request) =>
    replayRoom((request.params as { roomId: string }).roomId)
  );
  app.get("/api/admin/rooms/:roomId/integrity", async (request) =>
    verifyRoomIntegrity((request.params as { roomId: string }).roomId)
  );
  app.post("/api/admin/rooms/:roomId/override", async (request) =>
    manualOverride(
      (request.params as { roomId: string }).roomId,
      (request.body as any).actorId,
      (request.body as any).action,
      (request.body as any).details ?? {}
    )
  );
}
