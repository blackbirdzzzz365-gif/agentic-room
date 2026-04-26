import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("api actor injection", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AGENT_API_KEYS = JSON.stringify({
      "test-key": "actor-1"
    });
  });

  afterEach(() => {
    delete process.env.AGENT_API_KEYS;
    vi.doUnmock("@agentic-room/domain");
    vi.clearAllMocks();
  });

  it("injects the authenticated actor and strips spoofed actor fields from the HTTP body", async () => {
    const createRoom = vi.fn().mockResolvedValue({
      ok: true,
      eventId: "evt-1",
      seq: 1,
      roomId: "room-1"
    });

    vi.doMock("@agentic-room/domain", async () => {
      const actual = await vi.importActual<Record<string, unknown>>("@agentic-room/domain");
      return {
        ...actual,
        createRoom
      };
    });

    const { buildServer } = await import("./index");
    const server = buildServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/rooms",
      headers: {
        "x-api-key": "test-key"
      },
      payload: {
        name: "Pilot Room",
        requesterId: "requester-1",
        coordinatorId: "coord-1",
        budgetTotal: 1000,
        executionDeadlineAt: "2026-05-01T00:00:00.000Z",
        actorId: "spoofed-user",
        actorRole: "ADMIN"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        name: "Pilot Room",
        requesterId: "requester-1",
        coordinatorId: "coord-1"
      })
    );
    expect(createRoom.mock.calls[0]?.[0]?.actorRole).toBeUndefined();

    await server.close();
  });

  it("rejects admin mutations from authenticated non-admin actors", async () => {
    process.env.AGENT_API_KEYS = JSON.stringify({
      "contributor-key": {
        actorId: "agent-1",
        actorRole: "CONTRIBUTOR"
      }
    });

    const overrideRoomStatus = vi.fn().mockResolvedValue({
      ok: true,
      eventId: "evt-1",
      seq: 1,
      roomId: "room-1"
    });

    vi.doMock("@agentic-room/domain", async () => {
      const actual = await vi.importActual<Record<string, unknown>>("@agentic-room/domain");
      return {
        ...actual,
        overrideRoomStatus
      };
    });

    const { buildServer } = await import("./index");
    const server = buildServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/admin/rooms/11111111-1111-4111-8111-111111111111/override",
      headers: {
        "x-api-key": "contributor-key"
      },
      payload: {
        status: "SETTLED",
        phase: "5",
        reason: "poc"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(overrideRoomStatus).not.toHaveBeenCalled();

    await server.close();
  });

  it("maps validation failures to HTTP 400", async () => {
    const { buildServer } = await import("./index");
    const server = buildServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/rooms",
      headers: {
        "x-api-key": "test-key"
      },
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(
      expect.objectContaining({
        code: "VALIDATION_ERROR",
        issues: expect.any(Array)
      })
    );

    await server.close();
  });
});
