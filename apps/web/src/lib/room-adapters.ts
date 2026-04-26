import type {
  Allocation,
  Charter,
  CharterSignature,
  ConsensusConfig,
  Dispute,
  DisputeEvidence,
  IntegritySummary,
  Member,
  Mission,
  RoomEvent,
  RoomSnapshot,
  RoomSummary,
  SettlementProposal,
  SettlementVote,
  SettlementVoteRecord,
  Task,
  TaskDefinition,
  TimeoutRules,
} from "@/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isoValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  return asArray(value).flatMap((item) =>
    typeof item === "string" && item.trim().length > 0 ? [item] : []
  );
}

function recordOfNumbers(value: unknown): Record<string, number> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).flatMap(([key, raw]) => {
      const parsed = numberValue(raw);
      return parsed === undefined ? [] : [[key, parsed]];
    })
  );
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  return record ?? undefined;
}

function normalizeMission(rawMission: unknown): Mission | undefined {
  const mission = asRecord(rawMission);
  if (!mission) {
    return undefined;
  }

  const structured = asRecord(mission.structured) ?? mission;
  const objective = stringValue(structured.objective);
  if (!objective) {
    return undefined;
  }

  const confirmedAt = isoValue(mission.confirmedAt ?? mission.confirmed_at);

  return {
    objective,
    rawInput: stringValue(mission.rawInput ?? mission.raw_input),
    deliverables: stringArray(structured.deliverables),
    successCriteria: stringArray(
      structured.successCriteria ?? structured.success_criteria
    ),
    constraints: stringArray(structured.constraints),
    outOfScope: stringArray(structured.outOfScope ?? structured.out_of_scope),
    confirmedAt,
    status: confirmedAt ? "CONFIRMED" : "DRAFT",
  };
}

function normalizeMembers(rawMembers: unknown): Member[] {
  return asArray(rawMembers)
    .map((entry) => asRecord(entry))
    .flatMap((member) => {
      if (!member) {
        return [];
      }

      const memberId =
        stringValue(member.memberId ?? member.member_id ?? member.id) ?? "";
      if (!memberId) {
        return [];
      }

      return [
        {
          id: memberId,
          memberId,
          identityRef: stringValue(member.identityRef ?? member.identity_ref),
          name: stringValue(member.name),
          role: (stringValue(member.role) ?? "CONTRIBUTOR") as Member["role"],
          status: (stringValue(member.status) ?? "INVITED") as Member["status"],
          joinedAt: isoValue(member.joinedAt ?? member.joined_at),
          charterSigned:
            booleanValue(member.charterSigned ?? member.charter_signed) ?? false,
          charterSignedAt: isoValue(
            member.charterSignedAt ?? member.charter_signed_at
          ),
          stakeLocked: numberValue(member.stakeLocked ?? member.stake_locked),
        },
      ];
    });
}

function normalizeArtifacts(rawArtifacts: unknown): Map<string, JsonRecord> {
  const entries = asArray(rawArtifacts)
    .map((entry) => asRecord(entry))
    .flatMap((artifact) => {
      if (!artifact) {
        return [];
      }

      const taskId = stringValue(artifact.taskId ?? artifact.task_id);
      if (!taskId) {
        return [];
      }

      return [[taskId, artifact] as const];
    });

  return new Map(entries);
}

function normalizeTasks(rawTasks: unknown, rawArtifacts: unknown, fallbackTimestamp: string): Task[] {
  const artifactsByTaskId = normalizeArtifacts(rawArtifacts);

  return asArray(rawTasks)
    .map((entry) => asRecord(entry))
    .flatMap((task) => {
      if (!task) {
        return [];
      }

      const id = stringValue(task.id);
      const title = stringValue(task.title);
      if (!id || !title) {
        return [];
      }

      const artifact = artifactsByTaskId.get(id);

      return [
        {
          id,
          title,
          description:
            stringValue(task.description) ??
            stringValue(task.deliverableSpec ?? task.deliverable_spec) ??
            "No description provided.",
          deliverableSpec: stringValue(
            task.deliverableSpec ?? task.deliverable_spec
          ),
          status: (stringValue(task.status) ?? "OPEN") as Task["status"],
          effortEstimate: (
            stringValue(task.effortEstimate ?? task.effort_estimate) ?? "M"
          ) as Task["effortEstimate"],
          weight: numberValue(task.weight) ?? 0,
          dependencies: stringArray(task.dependencies),
          assigneeId: stringValue(task.assignedTo ?? task.assigned_to),
          deliverableUrl: stringValue(
            artifact?.contentRef ??
              artifact?.content_ref ??
              task.deliverableUrl ??
              task.contentRef
          ),
          deliverableContentType: stringValue(
            artifact?.contentType ?? artifact?.content_type ?? task.contentType
          ),
          artifactId: stringValue(artifact?.id ?? task.artifactId ?? task.artifact_id),
          notes: stringValue(
            artifact?.reviewNotes ?? artifact?.review_notes ?? task.notes
          ),
          claimDeadline: isoValue(task.claimDeadline ?? task.claim_deadline),
          deliveryDeadline: isoValue(
            task.deliveryDeadline ?? task.delivery_deadline
          ),
          reviewStatus: stringValue(task.reviewStatus ?? task.review_status),
          deliveryCount: numberValue(task.deliveryCount ?? task.delivery_count),
          createdAt: isoValue(task.createdAt ?? task.created_at) ?? fallbackTimestamp,
          updatedAt: isoValue(task.updatedAt ?? task.updated_at) ?? fallbackTimestamp,
        },
      ];
    });
}

function deriveTaskDefinitions(tasks: Task[]): TaskDefinition[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    deliverableSpec: task.deliverableSpec,
    effortEstimate: task.effortEstimate ?? "M",
    weight: task.weight ?? 0,
    dependencies: task.dependencies,
  }));
}

function normalizeCharter(
  rawCharter: unknown,
  members: Member[],
  tasks: Task[],
  fallbackCreatedAt: string
): Charter | undefined {
  const charter = asRecord(rawCharter);
  if (!charter) {
    return undefined;
  }

  const id = stringValue(charter.id);
  if (!id) {
    return undefined;
  }

  const signatures: Record<string, CharterSignature> = {};
  for (const member of members) {
    if (member.charterSignedAt) {
      signatures[member.memberId] = {
        status: "SIGNED",
        signedAt: member.charterSignedAt,
      };
    }
  }

  return {
    id,
    version: numberValue(charter.version),
    tasks: deriveTaskDefinitions(tasks),
    baselineSplit: recordOfNumbers(charter.baselineSplit ?? charter.baseline_split),
    bonusPoolPct:
      numberValue(
        charter.bonusPoolPct ??
          charter.bonus_pool_pct ??
          charter.discretionaryPoolPct ??
          charter.discretionary_pool_pct
      ) ?? 0,
    malusPoolPct:
      numberValue(charter.malusPoolPct ?? charter.malus_pool_pct) ?? 0,
    consensusConfig: objectValue(
      charter.consensusConfig ?? charter.consensus_config
    ) as ConsensusConfig | undefined,
    timeoutRules: objectValue(
      charter.timeoutRules ?? charter.timeout_rules
    ) as TimeoutRules | undefined,
    status: (stringValue(charter.status) ?? "DRAFT") as Charter["status"],
    signatures,
    createdAt:
      isoValue(charter.createdAt ?? charter.created_at) ?? fallbackCreatedAt,
    signDeadline: isoValue(charter.signDeadline ?? charter.sign_deadline),
  };
}

function normalizeAllocations(rawAllocations: unknown): Allocation[] {
  if (Array.isArray(rawAllocations)) {
    return rawAllocations
      .map((entry) => asRecord(entry))
      .flatMap((entry) => {
        if (!entry) {
          return [];
        }

        const memberId = stringValue(entry.memberId ?? entry.member_id);
        const amount = numberValue(entry.amount);
        if (!memberId || amount === undefined) {
          return [];
        }

        return [{ memberId, amount }];
      });
  }

  const allocationsRecord = asRecord(rawAllocations);
  if (!allocationsRecord) {
    return [];
  }

  return Object.entries(allocationsRecord).flatMap(([memberId, rawAmount]) => {
    const amount = numberValue(rawAmount);
    return amount === undefined ? [] : [{ memberId, amount }];
  });
}

function normalizeVotes(rawVotes: unknown): Record<string, SettlementVoteRecord> {
  const votesArray = Array.isArray(rawVotes)
    ? rawVotes
    : Object.entries(asRecord(rawVotes) ?? {}).map(([agentId, value]) => ({
        agentId,
        ...(asRecord(value) ?? {}),
      }));

  return Object.fromEntries(
    votesArray.flatMap((entry) => {
      const voteRecord = asRecord(entry);
      if (!voteRecord) {
        return [];
      }

      const agentId =
        stringValue(voteRecord.agentId ?? voteRecord.agent_id) ?? "";
      const vote = stringValue(voteRecord.vote);
      if (!agentId || !vote) {
        return [];
      }

      return [
        [
          agentId,
          {
            vote: vote as SettlementVote,
            reason: stringValue(voteRecord.reason ?? voteRecord.rationale),
            submittedAt: isoValue(
              voteRecord.submittedAt ?? voteRecord.submitted_at
            ),
          },
        ],
      ];
    })
  );
}

function normalizeSettlement(rawSettlement: unknown): SettlementProposal | undefined {
  const settlement = asRecord(rawSettlement);
  if (!settlement) {
    return undefined;
  }

  const id = stringValue(settlement.id);
  if (!id) {
    return undefined;
  }

  return {
    id,
    status: (stringValue(settlement.status) ?? "PENDING_REVIEW") as SettlementProposal["status"],
    allocations: normalizeAllocations(settlement.allocations),
    votes: normalizeVotes(settlement.votes),
    proposedAt:
      isoValue(settlement.proposedAt ?? settlement.proposed_at) ??
      new Date(0).toISOString(),
    finalizedAt: isoValue(settlement.finalizedAt ?? settlement.finalized_at),
    computationLog: settlement.computationLog ?? settlement.computation_log,
    signaturePayload: settlement.signaturePayload ?? settlement.signature_payload,
  };
}

function normalizeDisputes(rawDisputes: unknown): Dispute[] {
  return asArray(rawDisputes)
    .map((entry) => asRecord(entry))
    .flatMap((dispute) => {
      if (!dispute) {
        return [];
      }

      const id = stringValue(dispute.id);
      const respondentId = stringValue(
        dispute.respondentId ?? dispute.respondent_id
      );
      if (!id || !respondentId) {
        return [];
      }

      const evidence = asArray(dispute.evidence)
        .map((item) => asRecord(item))
        .flatMap((item) => {
          if (!item) {
            return [];
          }

          const type = stringValue(item.type);
          const ledgerRef = stringValue(item.ledgerRef ?? item.ledger_ref);
          return type && ledgerRef ? [{ type, ledgerRef }] : [];
        });

      return [
        {
          id,
          category: (stringValue(dispute.category) ?? "OPERATIONAL") as Dispute["category"],
          subType: stringValue(dispute.subType ?? dispute.sub_type),
          claimantId: stringValue(dispute.claimantId ?? dispute.claimant_id),
          respondentId,
          remedySought: stringValue(dispute.remedySought ?? dispute.remedy_sought),
          evidence: evidence as DisputeEvidence[],
          evidenceCount: evidence.length,
          status: (stringValue(dispute.status) ?? "OPEN") as Dispute["status"],
          panelIds: stringArray(dispute.panelIds ?? dispute.panel_ids),
          resolution: dispute.resolution,
          filedAt:
            isoValue(dispute.filedAt ?? dispute.createdAt ?? dispute.created_at) ??
            new Date(0).toISOString(),
          updatedAt:
            isoValue(dispute.updatedAt ?? dispute.updated_at ?? dispute.createdAt) ??
            new Date(0).toISOString(),
          coolingOffExpiresAt: isoValue(
            dispute.coolingOffExpiresAt ?? dispute.cooling_off_expires_at
          ),
          responseDeadlineAt: isoValue(
            dispute.responseDeadlineAt ?? dispute.response_deadline_at
          ),
          panelDeadlineAt: isoValue(
            dispute.panelDeadlineAt ?? dispute.panel_deadline_at
          ),
        },
      ];
    });
}

function normalizeEvents(rawEvents: unknown): RoomEvent[] {
  return asArray(rawEvents)
    .map((entry) => asRecord(entry))
    .flatMap((event, index) => {
      if (!event) {
        return [];
      }

      const type = stringValue(event.type ?? event.eventType ?? event.event_type);
      const createdAt = isoValue(
        event.createdAt ?? event.timestamp ?? event.created_at
      );
      if (!type || !createdAt) {
        return [];
      }

      return [
        {
          id:
            stringValue(event.id) ??
            stringValue(event.seq) ??
            `${type}-${createdAt}-${index}`,
          type,
          actorId: stringValue(event.actorId ?? event.actor_id),
          payload: objectValue(event.payload),
          createdAt,
        },
      ];
    });
}

function normalizeIntegrity(rawVerification: unknown): IntegritySummary | undefined {
  const verification = asRecord(rawVerification);
  if (!verification) {
    return undefined;
  }

  const results = asArray(verification.results)
    .map((entry) => asRecord(entry))
    .flatMap((entry) => {
      if (!entry) {
        return [];
      }

      const roomId = stringValue(entry.roomId ?? entry.room_id);
      if (!roomId) {
        return [];
      }

      return [
        {
          roomId,
          ok: booleanValue(entry.ok) ?? false,
          errors: stringArray(entry.errors),
          eventCount: numberValue(entry.eventCount ?? entry.event_count) ?? 0,
        },
      ];
    });

  if (results.length === 0) {
    return undefined;
  }

  return {
    valid: results.every((result) => result.ok),
    checkedRoomCount: results.length,
    invalidRoomCount: results.filter((result) => !result.ok).length,
    totalEvents: results.reduce((sum, result) => sum + result.eventCount, 0),
    results,
  };
}

export function normalizeRoomSummaryList(payload: unknown): RoomSummary[] {
  const source = asArray(asRecord(payload)?.rooms ?? payload);

  return source
    .map((entry) => asRecord(entry))
    .flatMap((room) => {
      if (!room) {
        return [];
      }

      const id = stringValue(room.id);
      const name = stringValue(room.name);
      if (!id || !name) {
        return [];
      }

      const createdAt =
        isoValue(room.createdAt ?? room.created_at) ?? new Date(0).toISOString();
      const updatedAt =
        isoValue(room.updatedAt ?? room.updated_at) ?? createdAt;

      return [
        {
          id,
          name,
          status: (stringValue(room.status) ?? "FORMING") as RoomSummary["status"],
          phase: numberValue(room.phase) ?? 0,
          requesterId: stringValue(room.requesterId ?? room.requester_id),
          coordinatorId: stringValue(room.coordinatorId ?? room.coordinator_id),
          memberCount: numberValue(room.memberCount ?? room.member_count) ?? 0,
          taskCount: numberValue(room.taskCount ?? room.task_count) ?? 0,
          disputeCount: numberValue(room.disputeCount ?? room.dispute_count) ?? 0,
          budgetTotal: numberValue(room.budgetTotal ?? room.budget_total),
          executionDeadlineAt: isoValue(
            room.executionDeadlineAt ?? room.execution_deadline_at
          ),
          createdAt,
          updatedAt,
        },
      ];
    });
}

export function normalizeRoomSnapshot(payload: unknown): RoomSnapshot | null {
  const snapshot = asRecord(payload);
  const room = asRecord(snapshot?.room ?? payload);
  if (!snapshot || !room) {
    return null;
  }

  const id = stringValue(room.id);
  const name = stringValue(room.name);
  if (!id || !name) {
    return null;
  }

  const createdAt =
    isoValue(room.createdAt ?? room.created_at) ?? new Date(0).toISOString();
  const updatedAt =
    isoValue(room.updatedAt ?? room.updated_at) ?? createdAt;
  const members = normalizeMembers(snapshot.members);
  const tasks = normalizeTasks(snapshot.tasks, snapshot.artifacts, updatedAt);

  return {
    id,
    name,
    status: (stringValue(room.status) ?? "FORMING") as RoomSnapshot["status"],
    phase: numberValue(room.phase) ?? 0,
    requesterId: stringValue(room.requesterId ?? room.requester_id),
    coordinatorId: stringValue(room.coordinatorId ?? room.coordinator_id),
    budgetTotal: numberValue(room.budgetTotal ?? room.budget_total),
    executionDeadlineAt: isoValue(
      room.executionDeadlineAt ?? room.execution_deadline_at
    ),
    mission: normalizeMission(snapshot.mission),
    charter: normalizeCharter(snapshot.charter, members, tasks, updatedAt),
    members,
    tasks,
    settlement: normalizeSettlement(snapshot.settlement),
    disputes: normalizeDisputes(snapshot.disputes),
    events: normalizeEvents(snapshot.events),
    integrity: normalizeIntegrity(snapshot.verification),
    createdAt,
    updatedAt,
  };
}
