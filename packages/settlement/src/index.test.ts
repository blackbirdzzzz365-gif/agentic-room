import { describe, expect, it } from "vitest";
import { computeSettlement } from "@agentic-room/settlement";

describe("settlement math", () => {
  it("computes normalized final allocations", () => {
    const result = computeSettlement({
      budgetTotal: 1000,
      baselineSplit: {
        architect: 0.4,
        builder: 0.6
      },
      acceptedTasks: [
        { taskId: "t1", assignedTo: "architect", weight: 20 },
        { taskId: "t2", assignedTo: "builder", weight: 80 }
      ],
      peerRatings: [{ targetId: "builder", signal: 1 }],
      requesterRatings: [{ targetId: "builder", rating: 9 }],
      bonusPoolPct: 0.1,
      malusPoolPct: 0.1
    });

    expect(result.allocations.builder).toBeGreaterThan(result.allocations.architect);
    expect(Object.values(result.shares).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
    expect(Object.values(result.allocations).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1000, 3);
  });

  it("returns zero payouts when no task is accepted", () => {
    const result = computeSettlement({
      budgetTotal: 1000,
      baselineSplit: {
        agentA: 0.5,
        agentB: 0.5
      },
      acceptedTasks: [],
      peerRatings: [],
      requesterRatings: [],
      bonusPoolPct: 0.1,
      malusPoolPct: 0.1
    });

    expect(result.allocations.agentA).toBe(0);
    expect(result.allocations.agentB).toBe(0);
    expect(result.shares.agentA).toBe(0);
    expect(result.shares.agentB).toBe(0);
  });
});
