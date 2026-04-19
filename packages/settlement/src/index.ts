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
  bonusPoolPct: number;
  malusPoolPct: number;
  acceptedTasks: AcceptedTask[];
  peerRatings: PeerRating[];
  requesterRatings: RequesterRating[];
};

export type SettlementContributionRecord = {
  agentId: string;
  baselineShare: number;
  acceptedTaskWeight: number;
  taskWeightShare: number;
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
    bonusPoolAmount: number;
    malusPoolAmount: number;
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
  const bonusPoolAmount = input.budgetTotal * input.bonusPoolPct;
  const malusPoolAmount = input.budgetTotal * input.malusPoolPct;
  const receivedPeerRatings = new Map<string, number[]>();
  const requesterRatings = new Map<string, number[]>();

  for (const rating of input.peerRatings) {
    const current = receivedPeerRatings.get(rating.targetId) ?? [];
    current.push(rating.signal);
    receivedPeerRatings.set(rating.targetId, current);
  }

  for (const rating of input.requesterRatings) {
    const current = requesterRatings.get(rating.targetId) ?? [];
    current.push(rating.rating);
    requesterRatings.set(rating.targetId, current);
  }

  const weightByAgent = new Map<string, number>();
  for (const task of input.acceptedTasks) {
    weightByAgent.set(task.assignedTo, (weightByAgent.get(task.assignedTo) ?? 0) + task.weight);
  }

  const rawRecords: SettlementContributionRecord[] = agentIds.map((agentId) => {
    const baselineShare = input.baselineSplit[agentId] ?? 0;
    const acceptedTaskWeight = weightByAgent.get(agentId) ?? 0;
    const taskWeightShare = totalAcceptedWeight > 0 ? acceptedTaskWeight / totalAcceptedWeight : baselineShare;
    const peerSignals = receivedPeerRatings.get(agentId) ?? [];
    const peerAverage = peerSignals.length > 0 ? sum(peerSignals) / peerSignals.length : 0;
    const peerAdjustment = clamp(peerAverage * input.bonusPoolPct * 0.25, -input.bonusPoolPct, input.bonusPoolPct);
    const requesterSignals = requesterRatings.get(agentId) ?? [];
    const requesterAverage = requesterSignals.length > 0 ? sum(requesterSignals) / requesterSignals.length : 5;
    const requesterAdjustment = clamp(
      ((requesterAverage - 5) / 5) * input.malusPoolPct * 0.25,
      -input.malusPoolPct,
      input.malusPoolPct
    );
    const taskWeightAdjustment = clamp(taskWeightShare - baselineShare, -0.2, 0.2);
    const rawShare = baselineShare + peerAdjustment + requesterAdjustment + taskWeightAdjustment;

    return {
      agentId,
      baselineShare,
      acceptedTaskWeight,
      taskWeightShare,
      peerAdjustment,
      requesterAdjustment,
      finalShare: rawShare,
      amount: 0,
      computationLog: {
        baselineShare: roundTo(baselineShare),
        acceptedTaskWeight: roundTo(acceptedTaskWeight),
        taskWeightShare: roundTo(taskWeightShare),
        peerAdjustment: roundTo(peerAdjustment),
        requesterAdjustment: roundTo(requesterAdjustment),
        taskWeightAdjustment: roundTo(taskWeightAdjustment)
      }
    };
  });

  if (totalAcceptedWeight <= 0) {
    const zeroAllocations = Object.fromEntries(agentIds.map((agentId) => [agentId, 0]));
    const zeroShares = Object.fromEntries(agentIds.map((agentId) => [agentId, 0]));
    return {
      allocations: zeroAllocations,
      shares: zeroShares,
      contributionRecords: rawRecords.map((record) => ({
        ...record,
        finalShare: 0,
        amount: 0
      })),
      computationLog: {
        bonusPoolAmount: roundTo(bonusPoolAmount),
        malusPoolAmount: roundTo(malusPoolAmount),
        totalAcceptedWeight: 0
      }
    };
  }

  const rawShareTotal = sum(rawRecords.map((record) => Math.max(record.finalShare, 0.000001)));
  const contributionRecords = rawRecords.map((record) => {
    const normalizedShare = Math.max(record.finalShare, 0.000001) / rawShareTotal;
    return {
      ...record,
      finalShare: roundTo(normalizedShare),
      amount: roundTo(normalizedShare * input.budgetTotal)
    };
  });

  const allocations = Object.fromEntries(contributionRecords.map((record) => [record.agentId, record.amount]));
  const shares = Object.fromEntries(contributionRecords.map((record) => [record.agentId, record.finalShare]));

  return {
    allocations,
    shares,
    contributionRecords,
    computationLog: {
      bonusPoolAmount: roundTo(bonusPoolAmount),
      malusPoolAmount: roundTo(malusPoolAmount),
      totalAcceptedWeight: roundTo(totalAcceptedWeight)
    }
  };
}
