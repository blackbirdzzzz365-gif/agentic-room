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
});
