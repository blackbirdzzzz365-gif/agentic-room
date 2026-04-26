type AcceptedTask = {
  taskId: string;
  assignedTo: string;
  weight: number;
};

type PeerRating = {
  raterId: string;
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
  acceptedTaskShare: number;
  peerAdjustment: number;
  requesterAdjustment: number;
  taskWeightAdjustment: number;
  finalShare: number;
  amount: number;
  computationLog: Record<string, number>;
};

export type SettlementComputation = {
  allocations: Record<string, number>;
  shares: Record<string, number>;
  contributionRecords: SettlementContributionRecord[];
  bonusPoolUsed: number;
  malusPoolReclaimed: number;
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

  const peerSignalsByTarget = new Map<string, Array<{ raterId: string; signal: number }>>();
  for (const rating of input.peerRatings) {
    const current = peerSignalsByTarget.get(rating.targetId) ?? [];
    current.push({ raterId: rating.raterId, signal: rating.signal });
    peerSignalsByTarget.set(rating.targetId, current);
  }

  const requesterRatingsByTarget = new Map<string, number[]>();
  for (const rating of input.requesterRatings) {
    const current = requesterRatingsByTarget.get(rating.targetId) ?? [];
    current.push(rating.rating);
    requesterRatingsByTarget.set(rating.targetId, current);
  }

  const weightByAgent = new Map<string, number>();
  for (const task of input.acceptedTasks) {
    weightByAgent.set(task.assignedTo, (weightByAgent.get(task.assignedTo) ?? 0) + task.weight);
  }

  const positiveTaskReconciliationCap = input.bonusPoolPct * 0.5;
  const negativeTaskReconciliationCap = input.malusPoolPct * 0.5;

  const rawRecords = agentIds.map((agentId) => {
    const baselineShare = input.baselineSplit[agentId] ?? 0;
    const acceptedTaskWeight = weightByAgent.get(agentId) ?? 0;
    const acceptedTaskShare = totalAcceptedWeight > 0 ? acceptedTaskWeight / totalAcceptedWeight : 0;

    const peerSignals = peerSignalsByTarget.get(agentId) ?? [];
    const distinctPeerRaters = new Set(peerSignals.map((item) => item.raterId));
    const peerAvg =
      distinctPeerRaters.size >= 2
        ? sum(peerSignals.map((item) => item.signal)) / peerSignals.length
        : 0;
    const peerAdjustment = peerAvg * input.bonusPoolPct * 0.5;

    const requesterRatings = requesterRatingsByTarget.get(agentId) ?? [];
    const requesterAvg =
      requesterRatings.length > 0 ? sum(requesterRatings) / requesterRatings.length : 5;
    const requesterScore = (requesterAvg - 5) / 5;
    const requesterAdjustment = requesterScore * input.malusPoolPct * 0.5;

    const rawTaskWeightAdjustment = acceptedTaskShare - baselineShare;
    const taskWeightAdjustment = clamp(
      rawTaskWeightAdjustment,
      -negativeTaskReconciliationCap,
      positiveTaskReconciliationCap
    );
    const rawShare = baselineShare + peerAdjustment + requesterAdjustment + taskWeightAdjustment;
    const normalizedInputShare = Math.max(rawShare, 0);

    return {
      agentId,
      baselineShare,
      acceptedTaskWeight,
      acceptedTaskShare,
      peerAdjustment,
      requesterAdjustment,
      taskWeightAdjustment,
      normalizedInputShare,
      computationLog: {
        baselineShare: roundTo(baselineShare),
        acceptedTaskWeight: roundTo(acceptedTaskWeight),
        acceptedTaskShare: roundTo(acceptedTaskShare),
        peerAdjustment: roundTo(peerAdjustment),
        requesterAdjustment: roundTo(requesterAdjustment),
        rawTaskWeightAdjustment: roundTo(rawTaskWeightAdjustment),
        taskWeightAdjustment: roundTo(taskWeightAdjustment),
        rawShare: roundTo(rawShare),
        normalizedInputShare: roundTo(normalizedInputShare)
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
        agentId: record.agentId,
        baselineShare: record.baselineShare,
        acceptedTaskWeight: record.acceptedTaskWeight,
        acceptedTaskShare: record.acceptedTaskShare,
        peerAdjustment: record.peerAdjustment,
        requesterAdjustment: record.requesterAdjustment,
        taskWeightAdjustment: record.taskWeightAdjustment,
        finalShare: 0,
        amount: 0,
        computationLog: record.computationLog
      })),
      bonusPoolUsed: 0,
      malusPoolReclaimed: 0,
      computationLog: {
        bonusPoolAmount: roundTo(bonusPoolAmount),
        malusPoolAmount: roundTo(malusPoolAmount),
        totalAcceptedWeight: 0
      }
    };
  }

  const rawShareTotal = sum(rawRecords.map((record) => record.normalizedInputShare));
  const safeTotal = rawShareTotal > 0 ? rawShareTotal : 1;

  const contributionRecords: SettlementContributionRecord[] = rawRecords.map((record) => {
    const finalShare = record.normalizedInputShare / safeTotal;
    return {
      agentId: record.agentId,
      baselineShare: record.baselineShare,
      acceptedTaskWeight: record.acceptedTaskWeight,
      acceptedTaskShare: record.acceptedTaskShare,
      peerAdjustment: record.peerAdjustment,
      requesterAdjustment: record.requesterAdjustment,
      taskWeightAdjustment: record.taskWeightAdjustment,
      finalShare: roundTo(finalShare),
      amount: roundTo(finalShare * input.budgetTotal),
      computationLog: record.computationLog
    };
  });

  const allocations = Object.fromEntries(contributionRecords.map((record) => [record.agentId, record.amount]));
  const shares = Object.fromEntries(contributionRecords.map((record) => [record.agentId, record.finalShare]));

  const bonusPoolUsed = roundTo(
    input.budgetTotal *
      sum(
        rawRecords.map(
          (record) =>
            Math.max(record.peerAdjustment, 0) + Math.max(record.taskWeightAdjustment, 0)
        )
      )
  );
  const malusPoolReclaimed = roundTo(
    input.budgetTotal *
      sum(
        rawRecords.map(
          (record) =>
            Math.abs(Math.min(record.requesterAdjustment, 0)) +
            Math.abs(Math.min(record.taskWeightAdjustment, 0))
        )
      )
  );

  return {
    allocations,
    shares,
    contributionRecords,
    bonusPoolUsed,
    malusPoolReclaimed,
    computationLog: {
      bonusPoolAmount: roundTo(bonusPoolAmount),
      malusPoolAmount: roundTo(malusPoolAmount),
      totalAcceptedWeight: roundTo(totalAcceptedWeight)
    }
  };
}
