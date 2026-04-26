import { describe, expect, it } from "vitest";
import { replayRoomEvents } from "@agentic-room/domain";
import { makeRoomEventFixture } from "@agentic-room/testkit";

describe("ledger replay", () => {
  it("rebuilds a basic room snapshot", () => {
    const roomId = crypto.randomUUID();
    const roomCreated = makeRoomEventFixture({
      roomId,
      seq: 0,
      eventType: "ROOM_CREATED",
      payload: {
        name: "Pilot Room",
        requesterId: "requester-1",
        coordinatorId: "coord-1",
        budgetTotal: 1000,
        executionDeadlineAt: new Date().toISOString()
      }
    });
    const missionConfirmed = makeRoomEventFixture({
      roomId,
      seq: 1,
      prevHash: roomCreated.hash,
      eventType: "MISSION_CONFIRMED",
      payload: {
        rawInput: "Build protocol MVP",
        structured: {
          objective: "Build MVP",
          deliverables: ["API", "Docs"],
          constraints: ["3 months"],
          successCriteria: ["pilot ready"],
          outOfScope: ["federation"]
        }
      }
    });

    const projection = replayRoomEvents([roomCreated, missionConfirmed]);
    expect(projection.roomId).toBe(roomId);
    expect(projection.status).toBe("PENDING_CHARTER");
    expect(projection.mission.structured?.objective).toBe("Build MVP");
  });

  it("restores the post-dispute room state from the resolved event payload", () => {
    const roomId = crypto.randomUUID();
    const roomCreated = makeRoomEventFixture({
      roomId,
      seq: 0,
      eventType: "ROOM_CREATED",
      payload: {
        name: "Pilot Room",
        requesterId: "requester-1",
        coordinatorId: "coord-1",
        budgetTotal: 1000,
        executionDeadlineAt: new Date().toISOString()
      }
    });
    const disputeFiled = makeRoomEventFixture({
      roomId,
      seq: 1,
      prevHash: roomCreated.hash,
      eventType: "DISPUTE_FILED",
      payload: {
        disputeId: "dispute-1",
        category: "OPERATIONAL",
        subType: "DELIVERY_REJECTION_CONTESTED"
      }
    });
    const disputeResolved = makeRoomEventFixture({
      roomId,
      seq: 2,
      prevHash: disputeFiled.hash,
      eventType: "DISPUTE_RESOLVED",
      payload: {
        disputeId: "dispute-1",
        resolution: { summary: "resolved" },
        nextRoomStatus: "IN_SETTLEMENT",
        nextRoomPhase: "4"
      }
    });

    const projection = replayRoomEvents([roomCreated, disputeFiled, disputeResolved]);
    expect(projection.disputes["dispute-1"]?.status).toBe("RESOLVED");
    expect(projection.status).toBe("IN_SETTLEMENT");
    expect(projection.phase).toBe("4");
  });
});
