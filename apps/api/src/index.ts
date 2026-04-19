import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
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
  listJobs,
  listDisputes,
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

const server = Fastify({ logger: false });

server.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    reply.code(204).send();
  }
});

server.setErrorHandler((error, _request, reply) => {
  const statusCode = error instanceof DomainError ? 400 : 500;
  reply.code(statusCode).send({
    error: error.name,
    code: error instanceof DomainError ? error.code : "INTERNAL_ERROR",
    message: error.message
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

server.post("/api/rooms", async (request) => createRoom(request.body));
server.get("/api/rooms/:roomId", async (request) => getRoomSnapshot((request.params as { roomId: string }).roomId));
server.get("/api/rooms/:roomId/events", async (request) => ({
  events: await getRoomEvents((request.params as { roomId: string }).roomId)
}));

server.post("/api/rooms/:roomId/mission/draft", async (request) =>
  draftMission({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
);

server.post("/api/rooms/:roomId/mission/confirm", async (request) =>
  confirmMission({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
);

server.post("/api/rooms/:roomId/members/invite", async (request) =>
  inviteMember({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
);

server.post("/api/rooms/:roomId/members/:memberId/accept", async (request) =>
  acceptMemberInvitation({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; memberId: string }).roomId,
    memberId: (request.params as { roomId: string; memberId: string }).memberId
  })
);

server.post("/api/rooms/:roomId/members/:memberId/decline", async (request) =>
  declineMemberInvitation({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; memberId: string }).roomId,
    memberId: (request.params as { roomId: string; memberId: string }).memberId
  })
);

server.post("/api/rooms/:roomId/charters", async (request) =>
  createCharter({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
);

server.post("/api/rooms/:roomId/charters/:charterId/sign", async (request) =>
  signCharter({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; charterId: string }).roomId,
    charterId: (request.params as { roomId: string; charterId: string }).charterId
  })
);

server.post("/api/rooms/:roomId/charters/:charterId/decline", async (request) =>
  declineCharter({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; charterId: string }).roomId,
    charterId: (request.params as { roomId: string; charterId: string }).charterId
  })
);

server.post("/api/rooms/:roomId/tasks/:taskId/claim", async (request) =>
  claimTask({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; taskId: string }).roomId,
    taskId: (request.params as { roomId: string; taskId: string }).taskId
  })
);

server.post("/api/rooms/:roomId/tasks/:taskId/unclaim", async (request) =>
  unclaimTask({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; taskId: string }).roomId,
    taskId: (request.params as { roomId: string; taskId: string }).taskId
  } as { roomId: string; taskId: string; actorId: string })
);

server.post("/api/rooms/:roomId/tasks/:taskId/deliver", async (request) =>
  deliverTask({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; taskId: string }).roomId,
    taskId: (request.params as { roomId: string; taskId: string }).taskId
  })
);

server.post("/api/rooms/:roomId/tasks/:taskId/review", async (request) =>
  reviewTask({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; taskId: string }).roomId,
    taskId: (request.params as { roomId: string; taskId: string }).taskId
  })
);

server.post("/api/rooms/:roomId/ratings/peer", async (request) =>
  recordPeerRating({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
);

server.post("/api/rooms/:roomId/ratings/requester", async (request) =>
  recordRequesterRating({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
);

server.post("/api/rooms/:roomId/settlement/propose", async (request) =>
  proposeSettlement({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  } as { roomId: string; actorId: string })
);

server.post("/api/rooms/:roomId/settlement/votes", async (request) =>
  voteSettlement({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
);

server.post("/api/rooms/:roomId/disputes", async (request) =>
  fileDispute({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  })
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

server.post("/api/admin/jobs/run-due", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return processDueJobs(body.limit ?? 25);
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

server.post("/api/admin/rooms/:roomId/override", async (request) =>
  overrideRoomStatus({
    ...(request.body as object),
    roomId: (request.params as { roomId: string }).roomId
  } as { roomId: string; actorId: string; status: "ACTIVE" | "FAILED" | "SETTLED" | "DISPUTED"; phase: string; reason: string })
);

server.post("/api/admin/rooms/:roomId/disputes/:disputeId/panel", async (request) =>
  assignDisputePanel({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; disputeId: string }).roomId,
    disputeId: (request.params as { roomId: string; disputeId: string }).disputeId
  } as { roomId: string; disputeId: string; actorId: string; panelists?: string[] })
);

server.post("/api/admin/rooms/:roomId/disputes/:disputeId/resolve", async (request) =>
  resolveDispute({
    ...(request.body as object),
    roomId: (request.params as { roomId: string; disputeId: string }).roomId,
    disputeId: (request.params as { roomId: string; disputeId: string }).disputeId
  } as {
    roomId: string;
    disputeId: string;
    actorId: string;
    resolution: Record<string, unknown>;
    nextRoomStatus?: "ACTIVE" | "IN_SETTLEMENT" | "DISPUTED" | "FAILED" | "SETTLED";
  })
);

const port = Number(process.env.API_PORT ?? 4000);

server
  .listen({ host: "0.0.0.0", port })
  .then(() => logger.info(`API listening on ${port}`))
  .catch((error) => {
    logger.error("API failed to start", error);
    process.exit(1);
  });
