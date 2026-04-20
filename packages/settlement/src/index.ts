type AcceptedTask = {
  taskId: string;
  assignedTo: string;
  weight: number;
};

type PeerRating = {
  targetId: string;
  signal: number;
};

type RequesterRating = {
  targetId: string;
  rating: number;
};

type SettlementInput = {
  budgetTotal: number;
  baselineSplit: Record<string, number>;
  discretionaryPoolPct: number;
  acceptedTasks: AcceptedTask[];
  peerRatings: PeerRating[];
  requesterRatings: RequesterRating[];
};

export type SettlementContributionRecord = {
  agentId: string;
  baselineShare: number;
  acceptedTaskWeight: number;
  peerAdjustment: number;
  requesterAdjustment: number;
  finalShare: number;
  amount: number;
  computationLog: Record<string, number>;
};

export type SettlementComputation = {
  allocations: Record<string, number>;
  shares: Record<string, number>;
  contributionRecords: SettlementContributionRecord[];
  computationLog: {
    discretionaryPoolAmount: number;
    totalAcceptedWeight: number;
  };
};

function roundTo(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function computeSettlement(input: SettlementInput): SettlementComputation {
  const agentIds = Object.keys(input.baselineSplit);
  if (agentIds.length === 0) {
    throw new Error("baseline split must not be empty");
  }

  const baselineTotal = sum(Object.values(input.baselineSplit));
  if (Math.abs(baselineTotal - 1) > 0.0001) {
    throw new Error(`baseline split must sum to 1.0, received ${baselineTotal}`);
  }

  const totalAcceptedWeight = sum(input.acceptedTasks.map((task) => task.weight));
  const discretionaryPoolAmount = input.budgetTotal * input.discretionaryPoolPct;

  const receivedPeerSignals = new Map<string, number[]>();
  for (const rating of input.peerRatings) {
    const current = receivedPeerSignals.get(rating.targetId) ?? [];
    current.push(rating.signal);
    receivedPeerSignals.set(rating.targetId, current);
  }

  const receivedRequesterRatings = new Map<string, number[]>();
  for (const rating of input.requesterRatings) {
    const current = receivedRequesterRatings.get(rating.targetId) ?? [];
    current.push(rating.rating);
    receivedRequesterRatings.set(rating.targetId, current);
  }

  const weightByAgent = new Map<string, number>();
  for (const task of input.acceptedTasks) {
    weightByAgent.set(task.assignedTo, (weightByAgent.get(task.assignedTo) ?? 0) + task.weight);
  }

  const clampedRecords = agentIds.map((agentId) => {
    const baselineShare = input.baselineSplit[agentId] ?? 0;
    const acceptedTaskWeight = weightByAgent.get(agentId) ?? 0;

    const peerSignals = receivedPeerSignals.get(agentId) ?? [];
    const peerAvg = peerSignals.length > 0 ? sum(peerSignals) / peerSignals.length : 0;
    const peerAdjustment = peerAvg * 0.05;

    const reqRatings = receivedRequesterRatings.get(agentId) ?? [];
    const reqAvg = reqRatings.length > 0 ? sum(reqRatings) / reqRatings.length : 5;
    // Convert 0-10 scale to [-1, +1], multiply by 0.05
    const requesterAdjustment = ((reqAvg - 5) / 5) * 0.05;

    const raw = baselineShare + peerAdjustment + requesterAdjustment;
    const clamped = clamp(raw, baselineShare - 0.10, baselineShare + 0.10);

    return {
      agentId,
      baselineShare,
      acceptedTaskWeight,
      peerAdjustment,
      requesterAdjustment,
      clamped,
      computationLog: {
        baselineShare: roundTo(baselineShare),
        acceptedTaskWeight: roundTo(acceptedTaskWeight),
        peerAdjustment: roundTo(peerAdjustment),
        requesterAdjustment: roundTo(requesterAdjustment),
        rawShare: roundTo(raw),
        clampedShare: roundTo(clamped)
      }
    };
  });

  if (totalAcceptedWeight <= 0) {
    const zeroAllocations = Object.fromEntries(agentIds.map((agentId) => [agentId, 0]));
    const zeroShares = Object.fromEntries(agentIds.map((agentId) => [agentId, 0]));
    return {
      allocations: zeroAllocations,
      shares: zeroShares,
      contributionRecords: clampedRecords.map((record) => ({
        agentId: record.agentId,
        baselineShare: record.baselineShare,
        acceptedTaskWeight: record.acceptedTaskWeight,
        peerAdjustment: record.peerAdjustment,
        requesterAdjustment: record.requesterAdjustment,
        finalShare: 0,
        amount: 0,
        computationLog: record.computationLog
      })),
      computationLog: {
        discretionaryPoolAmount: roundTo(discretionaryPoolAmount),
        totalAcceptedWeight: 0
      }
    };
  }

  // Normalize so sum = 1.0
  const clampedTotal = sum(clampedRecords.map((r) => Math.max(r.clamped, 0)));
  const safeTotal = clampedTotal > 0 ? clampedTotal : 1;

  const contributionRecords: SettlementContributionRecord[] = clampedRecords.map((record) => {
    const normalizedShare = Math.max(record.clamped, 0) / safeTotal;
    return {
      agentId: record.agentId,
      baselineShare: record.baselineShare,
      acceptedTaskWeight: record.acceptedTaskWeight,
      peerAdjustment: record.peerAdjustment,
      requesterAdjustment: record.requesterAdjustment,
      finalShare: roundTo(normalizedShare),
      amount: roundTo(normalizedShare * input.budgetTotal),
      computationLog: record.computationLog
    };
  });

  const allocations = Object.fromEntries(contributionRecords.map((r) => [r.agentId, r.amount]));
  const shares = Object.fromEntries(contributionRecords.map((r) => [r.agentId, r.finalShare]));

  return {
    allocations,
    shares,
    contributionRecords,
    computationLog: {
      discretionaryPoolAmount: roundTo(discretionaryPoolAmount),
      totalAcceptedWeight: roundTo(totalAcceptedWeight)
    }
  };
}
