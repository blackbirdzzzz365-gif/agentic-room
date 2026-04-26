import { describe, expect, it } from "vitest";

import { normalizeRoomSnapshot } from "./room-adapters";

const timestamp = "2026-04-26T00:00:00.000Z";

function baseSnapshot(charter: Record<string, unknown>) {
  return {
    room: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Phase 1 Room",
      status: "PENDING_CHARTER",
      phase: 2,
      requesterId: "requester-1",
      coordinatorId: "coord-1",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    charter: {
      id: "22222222-2222-4222-8222-222222222222",
      status: "DRAFT",
      baselineSplit: {
        "coord-1": 1,
      },
      ...charter,
    },
    members: [
      {
        memberId: "coord-1",
        role: "COORDINATOR",
        status: "ACTIVE",
      },
    ],
    tasks: [],
    disputes: [],
    events: [],
  };
}

describe("normalizeRoomSnapshot charter pools", () => {
  it("normalizes canonical bonus and malus pool fields", () => {
    const snapshot = normalizeRoomSnapshot(
      baseSnapshot({
        bonusPoolPct: 0.12,
        malusPoolPct: 0.04,
      })
    );

    expect(snapshot?.charter?.bonusPoolPct).toBe(0.12);
    expect(snapshot?.charter?.malusPoolPct).toBe(0.04);
    expect(snapshot?.charter).not.toHaveProperty("discretionaryPoolPct");
  });

  it("keeps legacy discretionary pool as a read fallback only", () => {
    const snapshot = normalizeRoomSnapshot(
      baseSnapshot({
        discretionaryPoolPct: 0.1,
      })
    );

    expect(snapshot?.charter?.bonusPoolPct).toBe(0.1);
    expect(snapshot?.charter?.malusPoolPct).toBe(0);
    expect(snapshot?.charter).not.toHaveProperty("discretionaryPoolPct");
  });
});
