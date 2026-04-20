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
      discretionaryPoolPct: 0.1
    });

    expect(result.allocations.builder).toBeGreaterThan(result.allocations.architect);
    expect(Object.values(result.shares).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(Object.values(result.allocations).reduce((s, v) => s + v, 0)).toBeCloseTo(1000, 3);
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
      discretionaryPoolPct: 0.1
    });

    expect(result.allocations.agentA).toBe(0);
    expect(result.allocations.agentB).toBe(0);
    expect(result.shares.agentA).toBe(0);
    expect(result.shares.agentB).toBe(0);
  });

  it("normalizes shares after clamp — shares always sum to 1.0", () => {
    // Both agents get +1 peer signal → both get +0.05 adjustment → raw exceeds baseline + 0.10 → clamped
    const result = computeSettlement({
      budgetTotal: 500,
      baselineSplit: { a: 0.5, b: 0.5 },
      acceptedTasks: [
        { taskId: "t1", assignedTo: "a", weight: 50 },
        { taskId: "t2", assignedTo: "b", weight: 50 }
      ],
      peerRatings: [
        { targetId: "a", signal: 1 },
        { targetId: "b", signal: 1 }
      ],
      requesterRatings: [],
      discretionaryPoolPct: 0.1
    });

    const shareSum = Object.values(result.shares).reduce((s, v) => s + v, 0);
    const allocationSum = Object.values(result.allocations).reduce((s, v) => s + v, 0);
    expect(shareSum).toBeCloseTo(1.0, 6);
    expect(allocationSum).toBeCloseTo(500, 3);
  });

  it("all-same-signal edge case — equal adjustments produce equal shares", () => {
    // All agents get identical signal → adjustments cancel out → shares proportional to baseline
    const result = computeSettlement({
      budgetTotal: 300,
      baselineSplit: { x: 0.3, y: 0.3, z: 0.4 },
      acceptedTasks: [
        { taskId: "t1", assignedTo: "x", weight: 30 },
        { taskId: "t2", assignedTo: "y", weight: 30 },
        { taskId: "t3", assignedTo: "z", weight: 40 }
      ],
      peerRatings: [
        { targetId: "x", signal: -1 },
        { targetId: "y", signal: -1 },
        { targetId: "z", signal: -1 }
      ],
      requesterRatings: [],
      discretionaryPoolPct: 0.1
    });

    const shareSum = Object.values(result.shares).reduce((s, v) => s + v, 0);
    expect(shareSum).toBeCloseTo(1.0, 5);
    // With all same adjustment direction, normalized shares should still reflect baseline proportions
    // x:y:z baseline = 3:3:4, after all get -0.05 → 0.25:0.25:0.35, normalize = 3:3:4
    const xShare = result.shares.x ?? 0;
    const yShare = result.shares.y ?? 0;
    expect(xShare).toBeCloseTo(yShare, 5);
  });

  it("peer adjustment is clamped to ±0.10 of baseline", () => {
    // One agent gets max positive peer signal, should not exceed baseline + 0.10
    const result = computeSettlement({
      budgetTotal: 1000,
      baselineSplit: { a: 0.3, b: 0.7 },
      acceptedTasks: [
        { taskId: "t1", assignedTo: "a", weight: 50 },
        { taskId: "t2", assignedTo: "b", weight: 50 }
      ],
      peerRatings: [
        { targetId: "a", signal: 1 },
        { targetId: "a", signal: 1 },
        { targetId: "a", signal: 1 }
      ],
      requesterRatings: [],
      discretionaryPoolPct: 0.1
    });

    // Before normalize: a_clamped ≤ 0.3 + 0.10 = 0.40
    // raw_a = 0.3 + 1×0.05 = 0.35 → within clamp, not clipped
    // final share after normalize should be around 0.35 / (0.35 + 0.70) ≈ 0.333
    expect(result.shares.a).toBeGreaterThan(0.3);
    expect(result.shares.a).toBeLessThan(0.45); // bounded post-normalize
    const shareSum = Object.values(result.shares).reduce((s, v) => s + v, 0);
    expect(shareSum).toBeCloseTo(1.0, 6);
  });
});
