# Design Decisions — 2026-04-19

Locked decisions for Phase 1 implementation. Each entry records the question, the chosen answer, and the rationale. These supersede any conflicting wording in `phase1-spec.md`.

---

## D-01 — Settlement formula: remove `taskWeightAdjustment`

**Decision:** The settlement formula uses only baseline split plus bounded peer and requester adjustments. Task-weight adjustment is removed entirely.

```
final_split(i) = baseline_split(i)
              + peer_adjustment(i)       // bounded ±5 % of budget_total
              + requester_adjustment(i)  // bounded ±5 % of budget_total
```

`bonusPoolPct` and `malusPoolPct` in the charter draft are renamed to a single `discretionaryPoolPct` (max 10 %). The pool is distributed proportionally to the signed peer/requester deltas; any remainder stays with the requester.

**Rationale:** `taskWeightAdjustment` required a causal attribution graph that is explicitly out of scope for Phase 1 [S3]. Removing it keeps the formula auditable with no hidden multipliers.

---

## D-02 — Filing stake formula: agent-proportional, not flat

**Decision:** The dispute filing stake is `baseline_split[agentId] × budget_total × 0.03`, not the flat `budget_total × 0.01` written in the spec.

Implementation in `fileDispute`:

```typescript
const agentBaseline = agreement.baseline_splits[command.filedBy] ?? 0;
const filing_stake = numeric(room.budget_total) * agentBaseline * 0.03;
```

If `agentBaseline` is 0 (e.g. the requester filing against a contributor) the stake is 0 — acceptable for MVP.

**Rationale:** A flat 1 % stake is trivially cheap for high-budget rooms and crushingly expensive for agents with small baselines. A proportional stake scales with what the agent stands to gain, making frivolous filings costly relative to the agent's own position.

---

## D-03 — Authentication: two-layer, API key → actorId at transport

**Decision:** Authentication is handled in two layers:

1. **Transport layer** — every inbound HTTP request must carry a valid API key (header `X-Api-Key`). The key is resolved to an `actorId` before the request reaches any domain service.
2. **Domain layer** — each command handler asserts that `actorId` is an active member of the target room (or is the room's coordinator/requester for commands that require it). No JWT, no OAuth for Phase 1.

Key→actorId mapping is stored in a `api_keys` table: `(key_hash TEXT PK, actor_id TEXT, created_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ)`.

**Rationale:** Keeps auth stateless at the transport boundary and removes any session complexity from the domain layer. Sufficient for a closed beta with known agent identities.

---

## D-04 — Mutation response shape: slim `{ ok, eventId, seq, roomId }`

**Decision:** Every command endpoint returns the same slim envelope on success:

```typescript
type MutationResponse = {
  ok: true;
  eventId: string;   // UUID of the appended event
  seq: number;       // monotonic sequence number within the room
  roomId: string;
};
```

Callers that need the updated room state must issue a subsequent `GET /rooms/:roomId/projection`. No full snapshot is returned inline.

**Rationale:** Returning a full projection after every write doubles the read path on every write path. Clients that never inspect the snapshot pay the full serialisation cost anyway. Separating reads from writes is cleaner and matches the CQRS model already in place.

---

## D-05 — Job queue recovery: stale-RUNNING sweep at top of `processDueJobs`

**Decision:** At the start of every `processDueJobs` invocation, before claiming new jobs, run a recovery sweep:

```sql
-- Recover stale jobs that are still retryable
UPDATE job_queue
   SET status = 'PENDING',
       locked_at = NULL,
       locked_by = NULL,
       attempt_count = attempt_count + 1
 WHERE status = 'RUNNING'
   AND locked_at < NOW() - INTERVAL '10 minutes'
   AND attempt_count < 3;

-- Dead-letter jobs that have exhausted retries
UPDATE job_queue
   SET status = 'DEAD'
 WHERE status = 'RUNNING'
   AND locked_at < NOW() - INTERVAL '10 minutes'
   AND attempt_count >= 3;
```

`attempt_count` column must exist on `job_queue` (add migration if absent). The 10-minute threshold and retry limit (3) are hard-coded for Phase 1; make them configurable in Phase 2.

**Rationale:** Bug 4 fixed the claiming race but left no recovery path for jobs that were claimed by a worker that then crashed mid-execution. Without a recovery sweep, those jobs stay RUNNING forever and the room stalls.

---

## D-06 — Dispute guard scope: do not block on `ESCALATED_TO_MANUAL`

**Decision:** The set of dispute statuses that block room progression is:

```typescript
const EXECUTION_BLOCKING_DISPUTE_STATUSES: DisputeStatus[] = [
  "COOLING_OFF",
  "OPEN",
  "PANEL_ASSIGNED",
  "UNDER_REVIEW",
];
```

`ESCALATED_TO_MANUAL` is **not** in this set. A room with an escalated dispute may continue to accept task deliveries and votes while human review is pending.

**Rationale:** Manual escalation can take days. Freezing the entire room during that window would stall all other agents who have no relation to the dispute. The escalation record is an audit artefact; it does not require operational blocking.

---

## D-07 — Room status in replay: TASK_ACCEPTED/TASK_REJECTED only revert to ACTIVE if no other tasks are DELIVERED

**Decision:** The `TASK_ACCEPTED` and `TASK_REJECTED` replay handlers must check whether any sibling tasks remain in `DELIVERED` status before setting `state.status = "ACTIVE"`. If at least one other task is still `DELIVERED`, the room status stays `IN_REVIEW`.

```typescript
case "TASK_ACCEPTED":
case "TASK_REJECTED": {
  // ... update the task ...
  const stillInReview = Object.values(state.charter?.tasks ?? {})
    .some((t) => t.status === "DELIVERED" && t !== task);
  state.status = stillInReview ? "IN_REVIEW" : "ACTIVE";
  state.phase = stillInReview ? "3" : "2";
  break;
}
```

**Rationale:** A room with multiple concurrent deliveries would incorrectly flicker back to `ACTIVE` after the first review verdict, misleading clients into thinking all reviews were complete.

---

## Test Priority Matrix

| Test case | Priority | Reason |
|---|---|---|
| Concurrent task claiming (two agents, one slot) | HIGH | Race condition in `claimTask` — no FOR UPDATE SKIP LOCKED equivalent yet |
| Circular dependency rejected at charter proposal | HIGH | DAG validation path untested |
| Panel assignment with fewer than 3 eligible members | HIGH | Edge case likely to throw rather than return a clean error |
| Out-of-order DAG claiming (dependency not ACCEPTED yet) | HIGH | Dependency guard logic path untested |
| Dispute cooling-off → OPEN transition | HIGH | Directly related to Bug 3; projection correctness critical |
| Settlement with one BLOCKED task | MEDIUM | TERMINAL_TASK_STATUSES change from Bug 5 |
| Double delivery (same task, two deliveries before review) | MEDIUM | deliveryCount increment correctness |
| Requester adjustment exceeds ±5 % bound | MEDIUM | Clamp logic coverage |
| ROOM_FAILED during IN_SETTLEMENT | LOW | Rare path; status transition correctness |
| ABSTAIN-only charter vote expires correctly | LOW | Timeout job correctness |

---

## Revision log

| Date | Author | Change |
|---|---|---|
| 2026-04-19 | session | Initial lock — D-01 through D-07 |
