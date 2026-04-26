import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { type ApiKeyMap, resolveActorIdentityFromKey } from "@agentic-room/auth";
import {
  DomainError,
  acceptMemberInvitation,
  assignDisputePanel,
  claimTask,
  confirmMission,
  createCharter,
  createRoom,
  declineCharter,
  declineMemberInvitation,
  deliverTask,
  draftMission,
  fileDispute,
  getOperationalMetrics,
  getRoomEvents,
  getRoomSnapshot,
  inviteMember,
  listDisputes,
  listJobs,
  listRooms,
  overrideRoomStatus,
  processDueJobs,
  proposeSettlement,
  recordPeerRating,
  recordRequesterRating,
  resolveDispute,
  reviewTask,
  signCharter,
  unclaimTask,
  verifyRoomsIntegrity,
  voteSettlement
} from "@agentic-room/domain";
import { logger } from "@agentic-room/observability";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "../../../.env") });

const apiKeyMap: ApiKeyMap = JSON.parse(process.env.AGENT_API_KEYS ?? "{}");
const defaultWebOrigin = `http://localhost:${process.env.WEB_PORT ?? 3000}`;
const allowedCorsOrigins = new Set(
  (process.env.CORS_ORIGINS ?? defaultWebOrigin)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

type AuthedRequest = FastifyRequest & { actorId: string; actorRole?: string };
type JsonObject = Record<string, unknown>;

function requireApiKey(req: FastifyRequest, res: FastifyReply, done: () => void) {
  const key = req.headers["x-api-key"] as string | undefined;
  const identity = key ? resolveActorIdentityFromKey(key, apiKeyMap) : undefined;
  if (!identity?.actorId) {
    res.code(401).send({ error: "UNAUTHORIZED" });
    return;
  }

  (req as AuthedRequest).actorId = identity.actorId;
  (req as AuthedRequest).actorRole = identity.actorRole;
  done();
}

function requireAdmin(req: FastifyRequest, res: FastifyReply, done: () => void) {
  requireApiKey(req, res, () => {
    if ((req as AuthedRequest).actorRole !== "ADMIN") {
      res.code(403).send({ error: "FORBIDDEN", code: "ADMIN_REQUIRED" });
      return;
    }
    done();
  });
}

function getActorId(request: FastifyRequest) {
  return (request as AuthedRequest).actorId;
}

function sanitizeBody(body: unknown): JsonObject {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  const { actorId: _actorId, actorRole: _actorRole, ...rest } = body as JsonObject;
  return rest;
}

function withActor(request: FastifyRequest, extra: JsonObject = {}) {
  return {
    ...sanitizeBody(request.body),
    ...extra,
    actorId: getActorId(request),
    actorRole: (request as AuthedRequest).actorRole
  };
}

function isValidationError(error: Error): error is Error & { issues: unknown[] } {
  return error.name === "ZodError" && Array.isArray((error as { issues?: unknown }).issues);
}

export function buildServer() {
  const server = Fastify({ logger: false });

  server.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (process.env.ALLOW_PUBLIC_CORS === "true") {
      reply.header("Access-Control-Allow-Origin", "*");
    } else if (origin && allowedCorsOrigins.has(origin)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
    }

    if (origin) {
      reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      reply.header("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    }

    if (request.method === "OPTIONS") {
      reply.code(204).send();
    }
  });

  server.setErrorHandler((error, _request, reply) => {
    const isValidation = isValidationError(error);
    const statusCode = error instanceof DomainError || isValidation ? 400 : 500;
    reply.code(statusCode).send({
      error: error.name,
      code: error instanceof DomainError ? error.code : isValidation ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
      message: error.message,
      ...(isValidation ? { issues: error.issues } : {})
    });
  });

  server.get("/health", async () => ({
    status: "ok",
    app: "agentic-room-api"
  }));

  server.get("/api/meta", async () => ({
    name: "agentic-room-api",
    phase: "phase-1",
    ready: true
  }));

  server.get("/api/rooms", async () => ({
    rooms: await listRooms()
  }));

  server.post("/api/rooms", { preHandler: requireApiKey }, async (request) => createRoom(withActor(request)));
  server.get("/api/rooms/:roomId", async (request) => getRoomSnapshot((request.params as { roomId: string }).roomId));
  server.get("/api/rooms/:roomId/events", async (request) => ({
    events: await getRoomEvents((request.params as { roomId: string }).roomId)
  }));

  server.post("/api/rooms/:roomId/mission/draft", { preHandler: requireApiKey }, async (request) =>
    draftMission(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.post("/api/rooms/:roomId/mission/confirm", { preHandler: requireApiKey }, async (request) =>
    confirmMission(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.post("/api/rooms/:roomId/members/invite", { preHandler: requireApiKey }, async (request) =>
    inviteMember(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.post("/api/rooms/:roomId/members/:memberId/accept", { preHandler: requireApiKey }, async (request) =>
    acceptMemberInvitation(
      withActor(request, {
        roomId: (request.params as { roomId: string; memberId: string }).roomId,
        memberId: (request.params as { roomId: string; memberId: string }).memberId
      })
    )
  );

  server.post("/api/rooms/:roomId/members/:memberId/decline", { preHandler: requireApiKey }, async (request) =>
    declineMemberInvitation(
      withActor(request, {
        roomId: (request.params as { roomId: string; memberId: string }).roomId,
        memberId: (request.params as { roomId: string; memberId: string }).memberId
      })
    )
  );

  server.post("/api/rooms/:roomId/charters", { preHandler: requireApiKey }, async (request) =>
    createCharter(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.post("/api/rooms/:roomId/charters/:charterId/sign", { preHandler: requireApiKey }, async (request) =>
    signCharter(
      withActor(request, {
        roomId: (request.params as { roomId: string; charterId: string }).roomId,
        charterId: (request.params as { roomId: string; charterId: string }).charterId
      })
    )
  );

  server.post("/api/rooms/:roomId/charters/:charterId/decline", { preHandler: requireApiKey }, async (request) =>
    declineCharter(
      withActor(request, {
        roomId: (request.params as { roomId: string; charterId: string }).roomId,
        charterId: (request.params as { roomId: string; charterId: string }).charterId
      })
    )
  );

  server.post("/api/rooms/:roomId/tasks/:taskId/claim", { preHandler: requireApiKey }, async (request) =>
    claimTask(
      withActor(request, {
        roomId: (request.params as { roomId: string; taskId: string }).roomId,
        taskId: (request.params as { roomId: string; taskId: string }).taskId
      })
    )
  );

  server.post("/api/rooms/:roomId/tasks/:taskId/unclaim", { preHandler: requireApiKey }, async (request) =>
    unclaimTask(
      withActor(request, {
        roomId: (request.params as { roomId: string; taskId: string }).roomId,
        taskId: (request.params as { roomId: string; taskId: string }).taskId
      }) as { roomId: string; taskId: string; actorId: string }
    )
  );

  server.post("/api/rooms/:roomId/tasks/:taskId/deliver", { preHandler: requireApiKey }, async (request) =>
    deliverTask(
      withActor(request, {
        roomId: (request.params as { roomId: string; taskId: string }).roomId,
        taskId: (request.params as { roomId: string; taskId: string }).taskId
      })
    )
  );

  server.post("/api/rooms/:roomId/tasks/:taskId/review", { preHandler: requireApiKey }, async (request) =>
    reviewTask(
      withActor(request, {
        roomId: (request.params as { roomId: string; taskId: string }).roomId,
        taskId: (request.params as { roomId: string; taskId: string }).taskId
      })
    )
  );

  server.post("/api/rooms/:roomId/ratings/peer", { preHandler: requireApiKey }, async (request) =>
    recordPeerRating(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.post("/api/rooms/:roomId/ratings/requester", { preHandler: requireApiKey }, async (request) =>
    recordRequesterRating(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.post("/api/rooms/:roomId/settlement/propose", { preHandler: requireApiKey }, async (request) =>
    proposeSettlement(
      withActor(request, { roomId: (request.params as { roomId: string }).roomId }) as {
        roomId: string;
        actorId: string;
      }
    )
  );

  server.post("/api/rooms/:roomId/settlement/votes", { preHandler: requireApiKey }, async (request) =>
    voteSettlement(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.post("/api/rooms/:roomId/disputes", { preHandler: requireApiKey }, async (request) =>
    fileDispute(withActor(request, { roomId: (request.params as { roomId: string }).roomId }))
  );

  server.get("/api/admin/rooms", async () => ({
    rooms: await listRooms()
  }));

  server.get("/api/admin/disputes", async () => ({
    disputes: await listDisputes()
  }));

  server.get("/api/admin/jobs", async (request) => {
    const limit = Number((request.query as { limit?: string }).limit ?? "100");
    return {
      jobs: await listJobs(limit)
    };
  });

  server.get("/api/admin/metrics", async () => getOperationalMetrics());

  server.post("/api/admin/jobs/run-due", { preHandler: requireAdmin }, async (request) => {
    const body = sanitizeBody(request.body) as { limit?: number };
    return processDueJobs(body.limit ?? 25, {
      requestedBy: getActorId(request),
      actorRole: (request as AuthedRequest).actorRole
    });
  });

  server.get("/api/admin/integrity", async (request) => {
    const roomId = (request.query as { roomId?: string }).roomId;
    return {
      results: await verifyRoomsIntegrity(roomId)
    };
  });

  server.get("/api/admin/rooms/:roomId/replay", async (request) =>
    getRoomSnapshot((request.params as { roomId: string }).roomId)
  );

  server.post("/api/admin/rooms/:roomId/override", { preHandler: requireAdmin }, async (request) =>
    overrideRoomStatus(
      withActor(request, { roomId: (request.params as { roomId: string }).roomId }) as {
        roomId: string;
        actorId: string;
        status: "ACTIVE" | "FAILED" | "SETTLED" | "DISPUTED";
        phase: string;
        reason: string;
      }
    )
  );

  server.post("/api/admin/rooms/:roomId/disputes/:disputeId/panel", { preHandler: requireAdmin }, async (request) =>
    assignDisputePanel(
      withActor(request, {
        roomId: (request.params as { roomId: string; disputeId: string }).roomId,
        disputeId: (request.params as { roomId: string; disputeId: string }).disputeId
      }) as { roomId: string; disputeId: string; actorId: string; actorRole?: string; panelists?: string[] }
    )
  );

  server.post("/api/admin/rooms/:roomId/disputes/:disputeId/resolve", { preHandler: requireAdmin }, async (request) =>
    resolveDispute(
      withActor(request, {
        roomId: (request.params as { roomId: string; disputeId: string }).roomId,
        disputeId: (request.params as { roomId: string; disputeId: string }).disputeId
      }) as {
        roomId: string;
        disputeId: string;
        actorId: string;
        actorRole?: string;
        resolution: Record<string, unknown>;
        nextRoomStatus?: "ACTIVE" | "IN_SETTLEMENT" | "DISPUTED" | "FAILED" | "SETTLED";
      }
    )
  );

  return server;
}

const port = Number(process.env.API_PORT ?? 4000);

async function start() {
  const server = buildServer();
  await server.listen({ host: "0.0.0.0", port });
  logger.info(`API listening on ${port}`);
}

const executedAsEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (executedAsEntryPoint) {
  start().catch((error) => {
    logger.error("API failed to start", error);
    process.exit(1);
  });
}
