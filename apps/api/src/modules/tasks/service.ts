import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { claimTaskCommandSchema, deliverTaskCommandSchema, reviewTaskCommandSchema } from "@agentic-room/contracts";
import { withTransaction } from "@agentic-room/db";
import { appendRoomEvent } from "@agentic-room/ledger";
import { assertInvariant, addHours, createId } from "../../lib/common.js";

async function getTask(client: PoolClient, roomId: string, taskId: string) {
  const result = await client.query(
    `
      SELECT *
      FROM charter_tasks
      WHERE room_id = $1 AND id = $2
      LIMIT 1
    `,
    [roomId, taskId]
  );
  return result.rows[0] ?? null;
}

export async function claimTask(command: unknown) {
  const input = claimTaskCommandSchema.parse(command);
  return withTransaction(async (client) => {
    const task = await getTask(client, input.roomId, input.taskId);
    assertInvariant(task, "task not found");
    assertInvariant(["OPEN", "REQUEUED"].includes(task.status), "task is not claimable");

    await client.query(
      `
        UPDATE charter_tasks
        SET status = 'CLAIMED',
            assigned_to = $3,
            delivery_deadline = COALESCE(delivery_deadline, $4),
            updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [input.roomId, input.taskId, input.actorId, addHours(new Date(), 48).toISOString()]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_CLAIMED",
      actorId: input.actorId,
      payload: {
        taskId: input.taskId,
        assignedTo: input.actorId
      }
    });

    return { roomId: input.roomId, event };
  });
}

export async function unclaimTask(command: unknown) {
  const input = claimTaskCommandSchema.parse(command);
  return withTransaction(async (client) => {
    const task = await getTask(client, input.roomId, input.taskId);
    assertInvariant(task?.assigned_to === input.actorId, "only assignee can unclaim");

    await client.query(
      `
        UPDATE charter_tasks
        SET status = 'REQUEUED', assigned_to = NULL, updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [input.roomId, input.taskId]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_UNCLAIMED",
      actorId: input.actorId,
      payload: { taskId: input.taskId, reason: "VOLUNTARY_UNCLAIM" }
    });

    await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_REQUEUED",
      actorId: input.actorId,
      payload: { taskId: input.taskId, reason: "VOLUNTARY_UNCLAIM" }
    });

    return { roomId: input.roomId, event };
  });
}

export async function deliverTask(command: unknown) {
  const input = deliverTaskCommandSchema.parse(command);
  return withTransaction(async (client) => {
    const task = await getTask(client, input.roomId, input.taskId);
    assertInvariant(task?.assigned_to === input.actorId, "only assignee can deliver");

    const artifactId = createId();
    const version = Number(task.delivery_count ?? 0) + 1;

    await client.query(
      `
        INSERT INTO artifacts (
          id, room_id, task_id, submitted_by, content_ref, content_type, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [artifactId, input.roomId, input.taskId, input.actorId, input.contentRef, input.contentType, version]
    );

    await client.query(
      `
        UPDATE charter_tasks
        SET status = 'DELIVERED',
            artifact_id = $3,
            review_status = 'PENDING',
            delivery_count = $4,
            updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [input.roomId, input.taskId, artifactId, version]
    );

    await client.query(
      `
        INSERT INTO job_queue (id, type, status, run_at, payload)
        VALUES ($1, 'review_timeout', 'PENDING', $2, $3::jsonb)
      `,
      [
        createId(),
        addHours(new Date(), 24).toISOString(),
        JSON.stringify({ roomId: input.roomId, taskId: input.taskId, attempts: 0 })
      ]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_DELIVERED",
      actorId: input.actorId,
      payload: {
        taskId: input.taskId,
        artifactId
      }
    });

    return { roomId: input.roomId, artifactId, event };
  });
}

export async function reviewTask(command: unknown) {
  const input = reviewTaskCommandSchema.parse(command);
  return withTransaction(async (client) => {
    const task = await getTask(client, input.roomId, input.taskId);
    assertInvariant(task, "task not found");
    assertInvariant(task.assigned_to !== input.actorId, "reviewer cannot review own task");
    assertInvariant(task.status === "DELIVERED" || task.status === "REJECTED", "task is not in reviewable state");

    await client.query(
      `
        INSERT INTO task_reviews (id, room_id, task_id, reviewer_id, verdict, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [createId(), input.roomId, input.taskId, input.actorId, input.verdict, input.notes]
    );

    if (input.verdict === "ACCEPTED") {
      await client.query(
        `
          UPDATE charter_tasks
          SET status = 'ACCEPTED', review_status = 'ACCEPTED', updated_at = NOW()
          WHERE room_id = $1 AND id = $2
        `,
        [input.roomId, input.taskId]
      );

      const event = await appendRoomEvent(client, {
        roomId: input.roomId,
        eventType: "TASK_ACCEPTED",
        actorId: input.actorId,
        payload: { taskId: input.taskId, notes: input.notes }
      });

      return { roomId: input.roomId, event };
    }

    const nextStatus = Number(task.delivery_count ?? 0) >= 2 ? "REQUEUED" : "REJECTED";
    await client.query(
      `
        UPDATE charter_tasks
        SET status = $3, review_status = 'REJECTED', updated_at = NOW()
        WHERE room_id = $1 AND id = $2
      `,
      [input.roomId, input.taskId, nextStatus]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "TASK_REJECTED",
      actorId: input.actorId,
      payload: { taskId: input.taskId, notes: input.notes }
    });

    if (nextStatus === "REQUEUED") {
      await appendRoomEvent(client, {
        roomId: input.roomId,
        eventType: "TASK_REQUEUED",
        actorId: input.actorId,
        payload: { taskId: input.taskId, reason: "FINAL_REJECTION" }
      });
    }

    return { roomId: input.roomId, event };
  });
}

export function registerTaskRoutes(app: FastifyInstance) {
  app.post("/api/rooms/:roomId/tasks/:taskId/claim", async (request) =>
    claimTask({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      taskId: (request.params as { taskId: string }).taskId
    })
  );
  app.post("/api/rooms/:roomId/tasks/:taskId/unclaim", async (request) =>
    unclaimTask({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      taskId: (request.params as { taskId: string }).taskId
    })
  );
  app.post("/api/rooms/:roomId/tasks/:taskId/deliver", async (request) =>
    deliverTask({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      taskId: (request.params as { taskId: string }).taskId
    })
  );
  app.post("/api/rooms/:roomId/tasks/:taskId/review", async (request) =>
    reviewTask({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      taskId: (request.params as { taskId: string }).taskId
    })
  );
}
