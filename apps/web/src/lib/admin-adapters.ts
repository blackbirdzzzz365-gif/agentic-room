import type {
  AdminDispute,
  AdminRoom,
  IntegritySummary,
  Job,
  Metrics,
} from "@/types";
import { normalizeRoomSummaryList } from "@/lib/room-adapters";

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
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return asArray(value).flatMap((item) =>
    typeof item === "string" && item.trim().length > 0 ? [item] : []
  );
}

function countValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

function countExcept(record: Record<string, number>, excludedKey: string): number {
  return Object.entries(record).reduce(
    (sum, [key, value]) => (key === excludedKey ? sum : sum + value),
    0
  );
}

function normalizeNumericRecord(value: unknown): Record<string, number> {
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

export function normalizeAdminRooms(payload: unknown): AdminRoom[] {
  return normalizeRoomSummaryList(payload);
}

export function normalizeJobs(payload: unknown): Job[] {
  return asArray(asRecord(payload)?.jobs ?? payload)
    .map((entry) => asRecord(entry))
    .flatMap((job) => {
      if (!job) {
        return [];
      }

      const id = stringValue(job.id);
      const type = stringValue(job.type);
      const status = stringValue(job.status);
      const runAt = isoValue(job.runAt ?? job.run_at);
      if (!id || !type || !status || !runAt) {
        return [];
      }

      const payloadRecord = asRecord(job.payload);

      return [
        {
          id,
          type,
          status,
          runAt,
          roomId:
            stringValue(job.roomId ?? job.room_id) ??
            stringValue(payloadRecord?.roomId ?? payloadRecord?.room_id),
          attempts: numberValue(job.attempts),
          maxAttempts: numberValue(job.maxAttempts ?? job.max_attempts),
          lastError: stringValue(job.lastError ?? job.last_error),
          payload: payloadRecord ?? undefined,
        },
      ];
    });
}

export function normalizeAdminDisputes(payload: unknown): AdminDispute[] {
  return asArray(asRecord(payload)?.disputes ?? payload)
    .map((entry) => asRecord(entry))
    .flatMap((dispute) => {
      if (!dispute) {
        return [];
      }

      const id = stringValue(dispute.id);
      const roomId = stringValue(dispute.roomId ?? dispute.room_id);
      const respondentId = stringValue(
        dispute.respondentId ?? dispute.respondent_id
      );
      const createdAt = isoValue(
        dispute.filedAt ?? dispute.createdAt ?? dispute.created_at
      );
      if (!id || !roomId || !respondentId || !createdAt) {
        return [];
      }

      return [
        {
          id,
          roomId,
          category: (stringValue(dispute.category) ?? "OPERATIONAL") as AdminDispute["category"],
          subType: stringValue(dispute.subType ?? dispute.sub_type),
          claimantId: stringValue(dispute.claimantId ?? dispute.claimant_id),
          respondentId,
          remedySought: stringValue(dispute.remedySought ?? dispute.remedy_sought),
          evidence: asArray(dispute.evidence).flatMap((item) => {
            const evidence = asRecord(item);
            const type = stringValue(evidence?.type);
            const ledgerRef = stringValue(evidence?.ledgerRef ?? evidence?.ledger_ref);
            return type && ledgerRef ? [{ type, ledgerRef }] : [];
          }),
          evidenceCount: numberValue(dispute.evidenceCount ?? dispute.evidence_count) ?? 0,
          status: (stringValue(dispute.status) ?? "OPEN") as AdminDispute["status"],
          panelIds: stringArray(dispute.panelIds ?? dispute.panel_ids),
          resolution: dispute.resolution,
          filedAt: createdAt,
          updatedAt:
            isoValue(dispute.updatedAt ?? dispute.updated_at) ?? createdAt,
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

export function normalizeMetrics(payload: unknown): Metrics | null {
  const metrics = asRecord(payload);
  if (!metrics) {
    return null;
  }

  const roomStatuses = normalizeNumericRecord(metrics.rooms ?? metrics.roomStatuses);
  const disputeStatuses = normalizeNumericRecord(
    metrics.disputes ?? metrics.disputeStatuses
  );
  const settlementStatuses = normalizeNumericRecord(
    metrics.settlements ?? metrics.settlementStatuses
  );

  if (
    Object.keys(roomStatuses).length === 0 &&
    Object.keys(disputeStatuses).length === 0 &&
    Object.keys(settlementStatuses).length === 0 &&
    numberValue(metrics.failedJobs) === undefined
  ) {
    return null;
  }

  return {
    roomsTotal: countValues(roomStatuses),
    roomsActive: roomStatuses.ACTIVE ?? 0,
    disputesOpen: countExcept(disputeStatuses, "RESOLVED"),
    settlementsPending: countExcept(settlementStatuses, "FINAL"),
    failedJobs: numberValue(metrics.failedJobs) ?? 0,
    roomStatuses,
    disputeStatuses,
    settlementStatuses,
  };
}

export function normalizeIntegrity(payload: unknown): IntegritySummary | null {
  const integrity = asRecord(payload);
  if (!integrity) {
    return null;
  }

  const results = asArray(integrity.results)
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

  if (results.length > 0) {
    return {
      valid: results.every((result) => result.ok),
      checkedRoomCount: results.length,
      invalidRoomCount: results.filter((result) => !result.ok).length,
      totalEvents: results.reduce((sum, result) => sum + result.eventCount, 0),
      results,
    };
  }

  if (booleanValue(integrity.valid) !== undefined) {
    const valid = booleanValue(integrity.valid) ?? false;
    return {
      valid,
      checkedRoomCount: 0,
      invalidRoomCount: valid ? 0 : 1,
      totalEvents: numberValue(integrity.chainLength) ?? 0,
      results: [],
    };
  }

  return null;
}
