import type { FastifyInstance } from "fastify";
import { createRoomCommandSchema, draftMissionCommandSchema, confirmMissionCommandSchema, inviteMemberCommandSchema, memberDecisionCommandSchema, createCharterCommandSchema, signCharterCommandSchema, declineCharterCommandSchema } from "@agentic-room/contracts";
import { withTransaction, getDbPool } from "@agentic-room/db";
import { appendRoomEvent } from "@agentic-room/ledger";
import { assertInvariant, addHours, createId } from "../../lib/common.js";
import { getActiveMembers, getLatestCharter, getRoomProjection } from "../../lib/context.js";

export async function createRoom(command: unknown) {
  const input = createRoomCommandSchema.parse(command);
  return withTransaction(async (client) => {
    const roomId = createId();

    await client.query(
      `
        INSERT INTO rooms (
          id, name, requester_id, coordinator_id, budget_total, status, phase, execution_deadline_at
        )
        VALUES ($1, $2, $3, $4, $5, 'FORMING', '0', $6)
      `,
      [roomId, input.name, input.requesterId, input.coordinatorId, input.budgetTotal, input.executionDeadlineAt]
    );

    await client.query(
      `
        INSERT INTO room_members (
          room_id, member_id, identity_ref, role, status, joined_at
        ) VALUES ($1, $2, $3, 'COORDINATOR', 'ACTIVE', NOW())
        ON CONFLICT (room_id, member_id) DO NOTHING
      `,
      [roomId, input.coordinatorId, input.coordinatorId]
    );

    if (input.requesterId !== input.coordinatorId) {
      await client.query(
        `
          INSERT INTO room_members (
            room_id, member_id, identity_ref, role, status, joined_at
          ) VALUES ($1, $2, $3, 'OBSERVER', 'ACTIVE', NOW())
          ON CONFLICT (room_id, member_id) DO NOTHING
        `,
        [roomId, input.requesterId, input.requesterId]
      );
    }

    const event = await appendRoomEvent(client, {
      roomId,
      eventType: "ROOM_CREATED",
      actorId: input.actorId,
      payload: {
        name: input.name,
        requesterId: input.requesterId,
        coordinatorId: input.coordinatorId,
        budgetTotal: input.budgetTotal,
        executionDeadlineAt: input.executionDeadlineAt
      }
    });

    return { roomId, event };
  });
}

export async function draftMission(command: unknown) {
  const input = draftMissionCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO missions (room_id, raw_input, structured)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (room_id)
        DO UPDATE SET raw_input = EXCLUDED.raw_input, structured = EXCLUDED.structured, updated_at = NOW()
      `,
      [input.roomId, input.rawInput, JSON.stringify(input.structured)]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "MISSION_DRAFTED",
      actorId: input.actorId,
      payload: {
        rawInput: input.rawInput,
        structured: input.structured
      }
    });

    return { roomId: input.roomId, event };
  });
}

export async function confirmMission(command: unknown) {
  const input = confirmMissionCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO missions (room_id, raw_input, structured, confirmed_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (room_id)
        DO UPDATE SET raw_input = EXCLUDED.raw_input, structured = EXCLUDED.structured, confirmed_at = NOW(), updated_at = NOW()
      `,
      [input.roomId, input.rawInput, JSON.stringify(input.structured)]
    );

    await client.query(
      `
        UPDATE rooms
        SET status = 'PENDING_CHARTER', phase = '1', updated_at = NOW()
        WHERE id = $1
      `,
      [input.roomId]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "MISSION_CONFIRMED",
      actorId: input.actorId,
      payload: {
        rawInput: input.rawInput,
        structured: input.structured
      }
    });

    return { roomId: input.roomId, event };
  });
}

export async function inviteMember(command: unknown) {
  const input = inviteMemberCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO room_members (
          room_id, member_id, identity_ref, role, status
        ) VALUES ($1, $2, $3, $4, 'INVITED')
        ON CONFLICT (room_id, member_id)
        DO UPDATE SET identity_ref = EXCLUDED.identity_ref, role = EXCLUDED.role, status = 'INVITED', updated_at = NOW()
      `,
      [input.roomId, input.memberId, input.identityRef, input.role]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "MEMBER_INVITED",
      actorId: input.actorId,
      payload: {
        memberId: input.memberId,
        identityRef: input.identityRef,
        role: input.role
      }
    });

    return { roomId: input.roomId, event };
  });
}

export async function acceptInvitation(command: unknown) {
  const input = memberDecisionCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        UPDATE room_members
        SET status = 'ACTIVE', joined_at = NOW(), updated_at = NOW()
        WHERE room_id = $1 AND member_id = $2
      `,
      [input.roomId, input.memberId]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "MEMBER_JOINED",
      actorId: input.actorId,
      payload: { memberId: input.memberId }
    });

    return { roomId: input.roomId, event };
  });
}

export async function declineInvitation(command: unknown) {
  const input = memberDecisionCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        UPDATE room_members
        SET status = 'DECLINED', updated_at = NOW()
        WHERE room_id = $1 AND member_id = $2
      `,
      [input.roomId, input.memberId]
    );

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "MEMBER_DECLINED",
      actorId: input.actorId,
      payload: { memberId: input.memberId }
    });

    return { roomId: input.roomId, event };
  });
}

export async function createCharter(command: unknown) {
  const input = createCharterCommandSchema.parse(command);
  return withTransaction(async (client) => {
    const projection = await getRoomProjection(client, input.roomId);
    assertInvariant(projection.mission.confirmedAt, "mission must be confirmed before charter creation");
    assertInvariant(projection.status === "PENDING_CHARTER" || projection.status === "FORMING", "room is not ready for charter");

    const weightTotal = input.draft.tasks.reduce((sum, task) => sum + task.weight, 0);
    assertInvariant(Math.abs(weightTotal - 100) < 0.0001, "task weights must sum to 100");

    const baselineTotal = Object.values(input.draft.baselineSplit).reduce((sum, value) => sum + value, 0);
    assertInvariant(Math.abs(baselineTotal - 1) < 0.0001, "baseline split must sum to 1");

    const latest = await getLatestCharter(client, input.roomId);
    const charterId = createId();
    const version = Number(latest?.version ?? 0) + 1;
    const signDeadline = addHours(new Date(), input.draft.timeoutRules.charterSignWindowHours);

    await client.query(
      `
        INSERT INTO charters (
          id, room_id, version, baseline_split, bonus_pool_pct, malus_pool_pct,
          consensus_config, timeout_rules, status, sign_deadline
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, 'DRAFT', $9)
      `,
      [
        charterId,
        input.roomId,
        version,
        JSON.stringify(input.draft.baselineSplit),
        input.draft.bonusPoolPct,
        input.draft.malusPoolPct,
        JSON.stringify(input.draft.consensusConfig),
        JSON.stringify(input.draft.timeoutRules),
        signDeadline.toISOString()
      ]
    );

    const tasksWithIds = input.draft.tasks.map((task) => ({
      ...task,
      id: task.id ?? createId()
    }));

    for (const rawTask of tasksWithIds) {
      const taskId = rawTask.id;
      await client.query(
        `
          INSERT INTO charter_tasks (
            id, charter_id, room_id, title, description, deliverable_spec,
            effort_estimate, weight, dependencies, status, claim_deadline
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'OPEN', $10)
        `,
        [
          taskId,
          charterId,
          input.roomId,
          rawTask.title,
          rawTask.description,
          rawTask.deliverableSpec,
          rawTask.effortEstimate,
          rawTask.weight,
          JSON.stringify(rawTask.dependencies),
          addHours(new Date(), input.draft.timeoutRules.taskClaimWindowHours).toISOString()
        ]
      );

    await client.query(
      `
        INSERT INTO job_queue (id, type, status, run_at, payload)
        VALUES ($1, 'charter_sign_timeout', 'PENDING', $2, $3::jsonb)
      `,
      [createId(), signDeadline.toISOString(), JSON.stringify({ roomId: input.roomId, charterId })]
    );
    }

    const activeMembers = await getActiveMembers(client, input.roomId);
    for (const member of activeMembers) {
      await client.query(
        `
          UPDATE room_members
          SET charter_signed = FALSE, charter_signed_at = NULL, updated_at = NOW()
          WHERE room_id = $1 AND member_id = $2
        `,
        [input.roomId, member.member_id]
      );
    }

    const event = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "CHARTER_PROPOSED",
      actorId: input.actorId,
      payload: {
        charterId,
        version,
        tasks: tasksWithIds,
        baselineSplit: input.draft.baselineSplit,
        bonusPoolPct: input.draft.bonusPoolPct,
        malusPoolPct: input.draft.malusPoolPct,
        consensusConfig: input.draft.consensusConfig,
        timeoutRules: input.draft.timeoutRules,
        signDeadline: signDeadline.toISOString()
      }
    });

    return { roomId: input.roomId, charterId, event };
  });
}

export async function signCharter(command: unknown) {
  const input = signCharterCommandSchema.parse(command);
  return withTransaction(async (client) => {
    const charter = await getLatestCharter(client, input.roomId);
    assertInvariant(charter?.id === input.charterId, "charter not found");

    await client.query(
      `
        UPDATE room_members
        SET charter_signed = TRUE, charter_signed_at = NOW(), updated_at = NOW()
        WHERE room_id = $1 AND member_id = $2
      `,
      [input.roomId, input.actorId]
    );

    const recorded = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "CHARTER_SIGNATURE_RECORDED",
      actorId: input.actorId,
      payload: {
        charterId: input.charterId,
        memberId: input.actorId
      }
    });

    const activeMembers = await getActiveMembers(client, input.roomId);
    const allSigned = activeMembers.every((member) => member.charter_signed || member.member_id === input.actorId);

    if (allSigned) {
      await client.query(
        `
          UPDATE charters
          SET status = 'SIGNED', updated_at = NOW()
          WHERE id = $1
        `,
        [input.charterId]
      );

      await client.query(
        `
          UPDATE rooms
          SET status = 'ACTIVE', phase = '2', updated_at = NOW()
          WHERE id = $1
        `,
        [input.roomId]
      );

      await appendRoomEvent(client, {
        roomId: input.roomId,
        eventType: "CHARTER_SIGNED",
        actorId: input.actorId,
        payload: {
          charterId: input.charterId
        }
      });

      await appendRoomEvent(client, {
        roomId: input.roomId,
        eventType: "ROOM_ACTIVATED",
        actorId: input.actorId,
        payload: {
          charterId: input.charterId
        }
      });
    }

    return { roomId: input.roomId, event: recorded, activated: allSigned };
  });
}

export async function declineCharter(command: unknown) {
  const input = declineCharterCommandSchema.parse(command);
  return withTransaction(async (client) => {
    await client.query(
      `
        UPDATE charters
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE id = $1
      `,
      [input.charterId]
    );

    await client.query(
      `
        UPDATE rooms
        SET status = 'PENDING_CHARTER', phase = '1', updated_at = NOW()
        WHERE id = $1
      `,
      [input.roomId]
    );

    const declined = await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "CHARTER_DECLINED",
      actorId: input.actorId,
      payload: {
        charterId: input.charterId,
        reason: input.reason
      }
    });

    await appendRoomEvent(client, {
      roomId: input.roomId,
      eventType: "CHARTER_EXPIRED",
      actorId: input.actorId,
      payload: {
        charterId: input.charterId,
        reason: input.reason
      }
    });

    return { roomId: input.roomId, event: declined };
  });
}

export async function listRooms() {
  const result = await getDbPool().query(
    `
      SELECT id, name, requester_id, coordinator_id, budget_total, status, phase, execution_deadline_at, created_at
      FROM rooms
      ORDER BY created_at DESC
    `
  );
  return result.rows;
}

export async function getRoomDetail(roomId: string) {
  const pool = getDbPool();
  const [roomResult, missionResult, membersResult, charterResult, tasksResult, proposalsResult] = await Promise.all([
    pool.query(`SELECT * FROM rooms WHERE id = $1 LIMIT 1`, [roomId]),
    pool.query(`SELECT * FROM missions WHERE room_id = $1 LIMIT 1`, [roomId]),
    pool.query(`SELECT * FROM room_members WHERE room_id = $1 ORDER BY created_at ASC`, [roomId]),
    pool.query(`SELECT * FROM charters WHERE room_id = $1 ORDER BY version DESC LIMIT 1`, [roomId]),
    pool.query(`SELECT * FROM charter_tasks WHERE room_id = $1 ORDER BY created_at ASC`, [roomId]),
    pool.query(`SELECT * FROM settlement_proposals WHERE room_id = $1 ORDER BY proposed_at DESC LIMIT 1`, [roomId])
  ]);

  return {
    room: roomResult.rows[0] ?? null,
    mission: missionResult.rows[0] ?? null,
    members: membersResult.rows,
    charter: charterResult.rows[0] ?? null,
    tasks: tasksResult.rows,
    settlement: proposalsResult.rows[0] ?? null
  };
}

export function registerRoomRoutes(app: FastifyInstance) {
  app.get("/api/rooms", async () => listRooms());
  app.get("/api/rooms/:roomId", async (request) =>
    getRoomDetail((request.params as { roomId: string }).roomId)
  );
  app.post("/api/rooms", async (request) => createRoom(request.body));
  app.post("/api/rooms/:roomId/mission/draft", async (request) =>
    draftMission({ ...(request.body as object), roomId: (request.params as { roomId: string }).roomId })
  );
  app.post("/api/rooms/:roomId/mission/confirm", async (request) =>
    confirmMission({ ...(request.body as object), roomId: (request.params as { roomId: string }).roomId })
  );
  app.post("/api/rooms/:roomId/members/invite", async (request) =>
    inviteMember({ ...(request.body as object), roomId: (request.params as { roomId: string }).roomId })
  );
  app.post("/api/rooms/:roomId/members/:memberId/accept", async (request) =>
    acceptInvitation({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      memberId: (request.params as { memberId: string }).memberId
    })
  );
  app.post("/api/rooms/:roomId/members/:memberId/decline", async (request) =>
    declineInvitation({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      memberId: (request.params as { memberId: string }).memberId
    })
  );
  app.post("/api/rooms/:roomId/charters", async (request) =>
    createCharter({ ...(request.body as object), roomId: (request.params as { roomId: string }).roomId })
  );
  app.post("/api/rooms/:roomId/charters/:charterId/sign", async (request) =>
    signCharter({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      charterId: (request.params as { charterId: string }).charterId
    })
  );
  app.post("/api/rooms/:roomId/charters/:charterId/decline", async (request) =>
    declineCharter({
      ...(request.body as object),
      roomId: (request.params as { roomId: string }).roomId,
      charterId: (request.params as { charterId: string }).charterId
    })
  );
}
