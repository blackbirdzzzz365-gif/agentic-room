import { describe, expect, it } from "vitest";
import { verifyEventChain } from "@agentic-room/ledger";
import { makeRoomEventFixture } from "@agentic-room/testkit";

describe("ledger seq", () => {
  it("accepts sequential events", () => {
    const roomId = crypto.randomUUID();
    const event0 = makeRoomEventFixture({
      roomId,
      seq: 0,
      eventType: "ROOM_CREATED",
      payload: { name: "Room A" }
    });
    const event1 = makeRoomEventFixture({
      roomId,
      seq: 1,
      prevHash: event0.hash,
      eventType: "MISSION_CONFIRMED",
      payload: {
        rawInput: "ship something",
        structured: { objective: "ship", deliverables: ["x"], constraints: [], successCriteria: [], outOfScope: [] }
      }
    });

    const result = verifyEventChain([event0, event1]);
    expect(result.ok).toBe(true);
  });

  it("detects sequence gaps", () => {
    const roomId = crypto.randomUUID();
    const event0 = makeRoomEventFixture({ roomId, seq: 0, eventType: "ROOM_CREATED" });
    const event1 = makeRoomEventFixture({ roomId, seq: 2, prevHash: event0.hash, eventType: "MISSION_CONFIRMED" });

    const result = verifyEventChain([event0, event1]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("Sequence mismatch"))).toBe(true);
  });
});
