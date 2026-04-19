# Bug Fixes Report — 2026-04-19

## Summary

5 bugs fixed across 4 packages. All tests pass (5/5).

---

## Bug 1 — `canonicalizePayload` only sorted top-level keys

**File:** [`packages/ledger/src/hash.ts`](packages/ledger/src/hash.ts)

**Root cause:**
`JSON.stringify(payload, replacerArray)` only applies the key-whitelist to the top level; nested object keys retain insertion order. Two identical payloads with differently-ordered nested keys produced different hashes, breaking replay hash verification.

**Fix applied:**
Replaced with a recursive implementation that walks the entire object tree, sorting keys at every depth before serialising. Arrays are preserved in their original order.

```typescript
// Before
export function canonicalizePayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

// After
export function canonicalizePayload(payload: unknown): string {
  if (Array.isArray(payload)) {
    return "[" + (payload as unknown[]).map(canonicalizePayload).join(",") + "]";
  }
  if (payload !== null && typeof payload === "object") {
    const sorted = Object.keys(payload as object).sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalizePayload((payload as Record<string, unknown>)[k]))
      .join(",");
    return "{" + sorted + "}";
  }
  return JSON.stringify(payload);
}
```

**Impact if unpatched:**
Any event whose payload contained nested objects could produce a hash mismatch during replay verification. `verifyEventChain` would flag legitimate chains as tampered, making the audit trail untrustworthy.

---

## Bug 2 — `signAllocationPayload` used base64 encoding instead of SHA-256

**File:** [`packages/integrations/src/index.ts:31`](packages/integrations/src/index.ts)

**Root cause:**
`Buffer.from(payload).toString("base64")` is a reversible encoding, not a cryptographic hash. The `payloadHash` field in `SignedPayload` is supposed to be a cryptographic commitment to the payload, but base64 can be decoded, defeating its purpose.

**Fix applied:**
Added `import { sha256Hex } from "@agentic-room/ledger"` and replaced the base64 line.

```typescript
// Before
const payloadHash = Buffer.from(payload).toString("base64");

// After
const payloadHash = sha256Hex(payload);
```

**Impact if unpatched:**
Settlement signatures stored in `payment_handoffs.payload.payloadHash` were not integrity proofs. Allocation amounts could be altered without changing the "hash", allowing fraudulent payouts to pass signature verification.

---

## Bug 3 — `DISPUTE_FILED` set projection status `OPEN` instead of `COOLING_OFF`

**File:** [`packages/domain/src/replay.ts:293`](packages/domain/src/replay.ts)

**Root cause:**
The `else` branch of the dispute event handler unconditionally set `current.status = "OPEN"`. Newly filed disputes must start in `COOLING_OFF` to match the DB insert (`status = 'COOLING_OFF'`).

**Fix applied:**

```typescript
// Before
} else {
  current.status = "OPEN";
}

// After
} else {
  current.status = "COOLING_OFF";
}
```

**Impact if unpatched:**
The in-memory projection diverged from the database immediately after `DISPUTE_FILED`. Clients reading `projection.disputes[id].status` would see `OPEN` while the DB held `COOLING_OFF`, breaking cooling-off enforcement logic and causing incorrect UI state.

---

## Bug 4 — Job queue race condition in `processDueJobs`

**File:** [`packages/domain/src/service.ts:1827`](packages/domain/src/service.ts)

**Root cause:**
The original code issued a plain `SELECT` followed by a separate `UPDATE … SET status = 'RUNNING'` in two independent non-transactional statements. Two concurrent workers could both SELECT the same pending rows and both UPDATE them to RUNNING, processing each job twice. The `locked_by` schema column existed but was never written.

**Fix applied:**
Replaced the two-statement pattern with a single atomic `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *`. Concurrent workers each claim a disjoint set of rows. `locked_by` is now populated with the worker's PID.

```sql
-- Before: two separate non-transactional statements
SELECT * FROM job_queue WHERE status = 'PENDING' ...;
UPDATE job_queue SET status = 'RUNNING' WHERE id = $1;

-- After: single atomic claim
UPDATE job_queue
  SET status = 'RUNNING', locked_at = NOW(), locked_by = $3, updated_at = NOW()
WHERE id IN (
  SELECT id FROM job_queue
  WHERE status = 'PENDING' AND run_at <= NOW()
  ORDER BY run_at ASC LIMIT $2
  FOR UPDATE SKIP LOCKED
)
RETURNING *
```

Also added `locked_by: string | null` to the `JobRow` TypeScript type.

**Impact if unpatched:**
Under any load with ≥2 worker pods, settlement-finalisation and timeout jobs could fire multiple times per event. Double settlement execution corrupts allocation totals; double charter-sign timeouts expire valid charters prematurely.

---

## Bug 5 — `finalizeTaskReview` off-by-one + wrong status name

**File:** [`packages/domain/src/service.ts:999`](packages/domain/src/service.ts)

**Root cause (off-by-one):**
`deliverTask` increments `delivery_count` *before* `finalizeTaskReview` is called. The old check `delivery_count >= 2` triggered after the *second* delivery (count=2), blocking after only **one rejection** instead of two.

**Root cause (wrong status name):**
The spec requires `BLOCKED` for max-rejection tasks (assignee retains ownership; coordinator must intervene). The old code used `REQUEUED`, which drops `assigned_to` and re-opens the task for any claimant — incorrect flow.

**Fix applied:**

| Item | Before | After |
|------|--------|-------|
| Threshold | `delivery_count >= 2` | `delivery_count > 2` |
| Max-rejection status | `"REQUEUED"` | `"BLOCKED"` |
| SQL CASE | `$3 = 'REQUEUED' THEN NULL` | `$3 = 'BLOCKED' THEN NULL` |
| Follow-up event | `TASK_REQUEUED` | `TASK_BLOCKED` |
| `TERMINAL_TASK_STATUSES` | `ACCEPTED, CANCELLED` | `ACCEPTED, CANCELLED, BLOCKED` |

`packages/contracts/src/index.ts` updated to add `"BLOCKED"` to `taskStatusSchema` and `"TASK_BLOCKED"` to the event-type enum.

**Impact if unpatched:**
Agents could only attempt a task once before it was incorrectly re-queued and unassigned. Settlement computation was also broken: REQUEUED tasks were not in `TERMINAL_TASK_STATUSES`, so `proposeSettlement` could be blocked indefinitely by tasks that should have been considered terminal.

---

## Test Results

```
 ✓ packages/settlement/src/index.test.ts  (2 tests)
 ✓ packages/ledger/src/verify.test.ts     (2 tests)
 ✓ packages/domain/src/replay.test.ts     (1 test)

 Test Files  3 passed (3)
      Tests  5 passed (5)
   Duration  332ms
```

All existing tests pass. No regressions detected.
