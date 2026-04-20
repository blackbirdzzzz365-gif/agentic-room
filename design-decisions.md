# Design Decisions — Agentic Room Network

**Date:** April 2026  
**Author:** System Architect  
**Scope:** Phase 1 — post-implementation review of spec deviations and quality issues

---

## Group 1: Spec Deviations

---

### [1A] Settlement Formula: task-weight-based vs flat ±5%

**Decision:** Align with spec. Remove `taskWeightAdjustment`. Fix peer/requester bounds to flat ±5%.

**Rationale:** The current code computes three adjustments:
1. `peerAdjustment` bounded by `bonusPoolPct` (variable, up to 20%)
2. `requesterAdjustment` bounded by `malusPoolPct` (variable, up to 10%)
3. `taskWeightAdjustment = clamp(taskWeightShare - baselineShare, -0.2, 0.2)` — not in spec

The `taskWeightAdjustment` term is the most dangerous deviation. It allows a 20% swing based purely on task weight claimed, which effectively lets agents game settlement by sand-bagging during charter alignment and then claiming high-weight tasks at execution time. The spec's whole point is to lock baseline splits pre-execution so that post-hoc adjustments are bounded. The task-weight term defeats that invariant.

The `bonusPoolPct`/`malusPoolPct` as bounds are also problematic: they make the adjustment ceiling configurable, so a room can set `bonusPoolPct=0.2` and give peers up to ±20% sway. The spec hard-codes ±5% for both peer and requester. Fixed bounds are less gameable — there's no incentive to negotiate high pool percentages during charter.

The existing peer signal schema (`-1/0/+1` integer) is fine as a UX simplification; it maps cleanly to the ±5% spec range.

**Implementation:**

```ts
// peer_adjustment(i) = mean of signals received × 0.05
// signal is -1 | 0 | +1 → maps to -5% | 0% | +5%
const peerSignals = receivedPeerRatings.get(agentId) ?? [];
const peerAverage = peerSignals.length > 0 ? sum(peerSignals) / peerSignals.length : 0;
const peerAdjustment = clamp(peerAverage * 0.05, -0.05, 0.05);

// requester_adjustment(i) = ((rating - 5) / 5) × 0.05
// rating is 0–10, midpoint 5 → maps to -5% | 0% | +5%
const requesterSignals = requesterRatings.get(agentId) ?? [];
const requesterAverage = requesterSignals.length > 0 ? sum(requesterSignals) / requesterSignals.length : 5;
const requesterAdjustment = clamp(((requesterAverage - 5) / 5) * 0.05, -0.05, 0.05);

// NO taskWeightAdjustment term.
const rawShare = baselineShare + peerAdjustment + requesterAdjustment;

// Constraint pass (per spec §4):
// 1. Clamp each rawShare to [0, 2 × baselineShare]
// 2. Normalize so shares sum to 1.0
const clampedShare = clamp(rawShare, 0, 2 * baselineShare);
// ... normalize across all agents
```

`bonusPoolPct` and `malusPoolPct` fields on the charter no longer drive settlement computation. Either repurpose them as `discretionaryPoolPct` (per spec §4 Step 5) or remove. Recommend renaming to `discretionaryPoolPct: number (max 0.2)` and removing `malusPoolPct` entirely — the spec has only one discretionary pool.

---

### [1B] Filing Stake: 1% budget_total vs 3% agent earnings

**Decision:** Use spec formula: `3% of agent's projected earnings` (= `0.03 × baselineSplit[agentId] × budgetTotal`). Fallback to `0.03 × (budgetTotal / activeMemberCount)` if agent has no baseline entry.

**Rationale:**

Current code: `room.budget_total * 0.01`

Example — room with $100k budget, 10 agents, one agent with 5% baseline (projected earnings $5k):
- Code formula: stake = $1,000 = 20% of that agent's expected payout → prohibitively high deterrent for small contributors
- Spec formula: stake = $150 = 3% of $5k → proportional and recoverable if upheld

The code formula creates a chilling effect for low-baseline agents who are the most likely targets of unfair settlement. An agent with 3% baseline ($3k earnings) faces a $1k stake — 33% of their payout. Spec formula charges that same agent $90.

For large-baseline agents, the spec formula is also more meaningful: an agent expecting $30k puts up $900, which is a real deterrent against frivolous filing, not a trivial sum.

The one complication: at filing time for OPERATIONAL disputes, settlement hasn't been proposed yet, so "earnings" are projected from baseline. This is fine — baseline is locked at charter sign-off and is the canonical pre-agreed expectation.

**Implementation:**

```ts
// In fileDispute():
const charter = await loadLatestCharter(client, command.roomId);
const baselineSplit = charter?.baseline_split ?? {};
const budgetTotal = numeric(room.budget_total);
const agentBaseline = baselineSplit[command.actorId];

const filingStake = agentBaseline != null
  ? 0.03 * agentBaseline * budgetTotal
  : (() => {
      const members = await loadMembers(client, command.roomId);
      const activeCount = Math.max(members.filter(m => m.status === 'ACTIVE').length, 1);
      return 0.03 * (budgetTotal / activeCount);
    })();
```

---

### [1C] Auth: stub vs real validation

**Decision:** Two-layer minimal auth — API key → actorId at transport, active-member assertion at domain. Do not implement JWT or external IdP in Phase 1.

**Rationale:** Phase 1 scope is allowlist-only federation. All agents are known. The primary abuse vector is not impersonation by unknown actors but by known actors spoofing another member's actorId (e.g., agent A sends `actorId=agentB` to claim agent B's task). This is addressable cheaply.

`packages/auth/src/index.ts` is a stub (`authCheckpoint = "cp0-environment-bootstrap"`). It needs to become real, but it doesn't need to be complex.

**Implementation:**

Transport layer (Fastify middleware):
```ts
// Simple API key table: env var or DB table api_keys(key_hash, actor_id, created_at)
fastify.addHook('preHandler', async (req, reply) => {
  const key = req.headers['x-api-key'];
  if (!key) throw new UnauthorizedError('Missing X-Api-Key');
  const actorId = await lookupActorByKey(key);  // hash key, query table
  if (!actorId) throw new UnauthorizedError('Invalid API key');
  req.actorId = actorId;  // inject; body.actorId must match or be absent
});
```

Domain layer — add authorization assertions where actorId must be an active room member for room-scoped mutations. Example in `claimTask`:
```ts
const member = members.find(m => m.member_id === command.actorId && m.status === 'ACTIVE');
assert(member, `Actor ${command.actorId} is not an active member of room ${command.roomId}`);
```

This is not over-engineered for Phase 1. Upgrade path: swap `lookupActorByKey` for JWT verification in Phase 2 when external federation is in scope (Phase 3 per spec §1).

---

## Group 2: Design & Quality

---

### [2A] getRoomSnapshotById: 10+ queries + chain verify on every mutation

**Decision:** Split write-path response from read-path snapshot. Mutations return a lightweight `MutationResult`. Full snapshot is on-demand only. Move `verifyEventChain` out of the hot path.

**Rationale:** Every write — including `claimTask`, `signCharter`, `recordPeerRating` — currently triggers `getRoomSnapshotById`, which does: loadRoom + loadMission + loadMembers + loadLatestCharter + loadTasks + fetchRoomEvents + `verifyEventChain` (O(n) over all events) + replayRoomEvents + loadLatestSettlement + loadDisputes + loadSettlementVotes + loadArtifacts = 11+ sequential queries.

`verifyEventChain` is correctness audit code — it hashes every event in sequence. Running it after every mutation conflates operational consistency (did the write succeed?) with integrity auditing (has any event been tampered with?). These have different cadences.

**Write-path response:**
```ts
type MutationResult = {
  ok: true;
  roomId: string;
  eventId: string;      // the event just appended
  seq: number;          // monotonic position in event log
  timestamp: string;
};
```

All service functions return `MutationResult` instead of calling `getRoomSnapshotById`. The API route decides whether to do a follow-up read.

**Read-path snapshot:** `GET /rooms/:id/snapshot` calls `getRoomSnapshotById` explicitly. This path is explicitly labeled expensive and can be rate-limited or cached.

**Integrity check:** Move `verifyEventChain` to a dedicated `GET /rooms/:id/integrity` endpoint and to the existing `verifyRoomsIntegrity` background job. Remove it from snapshot path entirely.

This change cuts per-mutation DB load by ~90% and makes the critical path (claim, deliver, review) fast.

---

### [2B] Job Queue: stuck RUNNING jobs don't recover

**Decision:** Add a recovery sweep at the start of `processDueJobs`. Threshold: 10 minutes. Increment attempt counter on recovery; fail permanently after max_attempts.

**Rationale:** `locked_at` is set in `updateJobStatus` when status = 'RUNNING' but never read for recovery. If a worker process crashes mid-job, the row stays `status='RUNNING'` indefinitely. The queue drains of new work as more jobs get stuck.

10 minutes is the right threshold: jobs are mostly DB operations + event appends that complete in milliseconds. 10 minutes is generous enough to not false-recover slow jobs (e.g., dispute panel timeout that does multiple writes) while catching real crashes.

**Implementation (prepend to processDueJobs):**

```ts
// Step 0: recover stuck RUNNING jobs
await client.query(`
  UPDATE job_queue
  SET
    status = CASE
      WHEN attempts + 1 >= max_attempts THEN 'FAILED'
      ELSE 'PENDING'
    END,
    locked_at = NULL,
    locked_by = NULL,
    attempts = attempts + 1,
    last_error = 'recovered: stuck in RUNNING state',
    run_at = CASE
      WHEN attempts + 1 >= max_attempts THEN run_at
      ELSE NOW() + INTERVAL '5 minutes'  -- back-off before retry
    END,
    updated_at = NOW()
  WHERE status = 'RUNNING'
    AND locked_at < NOW() - INTERVAL '10 minutes'
`);
```

Run this before the job-selection query so recovered jobs are eligible for immediate pickup.

---

### [2C] `ensureNoOpenDisputes` does not block `ESCALATED_TO_MANUAL`

**Decision:** Keep `ESCALATED_TO_MANUAL` as a non-blocking status for `claimTask` and `deliverTask`. It IS blocking for `proposeSettlement` and `voteSettlement` (current behavior is correct for settlement). Also: add dispute gating to `claimTask` — currently it has none.

**Rationale:** The current `ensureNoOpenDisputes` query:
```sql
WHERE status NOT IN ('RESOLVED')
```
...actually does block ESCALATED_TO_MANUAL (it's not RESOLVED, so it gets counted). The problem is elsewhere: `claimTask` and `deliverTask` don't call `ensureNoOpenDisputes` at all. Agents can continue claiming and delivering tasks regardless of active disputes.

For settlement functions, blocking on ESCALATED_TO_MANUAL is correct — a dispute in manual escalation has undefined resolution timeline and settlement shouldn't proceed until it clears.

For execution functions (`claimTask`, `deliverTask`): blocking on ESCALATED_TO_MANUAL would deadlock the room indefinitely if manual resolution is slow. Active disputes (COOLING_OFF through UNDER_REVIEW) should block claiming; escalated-to-manual should not.

**Implementation:**

```ts
// New guard for execution path (not settlement path):
async function ensureNoActiveDisputes(client: PoolClient, roomId: string) {
  const result = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count FROM dispute_cases
    WHERE room_id = $1
      AND status IN ('COOLING_OFF', 'OPEN', 'PANEL_ASSIGNED', 'UNDER_REVIEW')
  `, [roomId]);
  assert(Number(result.rows[0]?.count ?? 0) === 0, 'Active disputes block task execution');
}

// Apply in claimTask() and deliverTask() — not in proposeSettlement/voteSettlement.
// proposeSettlement/voteSettlement keep the existing ensureNoOpenDisputes (blocks ESCALATED_TO_MANUAL too).
```

---

### [2D] `TASK_ACCEPTED` in replay sets room to ACTIVE unconditionally

**Decision:** Fix replay to check remaining DELIVERED tasks before transitioning room status. Same fix needed for `TASK_REJECTED`.

**Rationale:** In `replay.ts`, when `TASK_ACCEPTED` fires:
```ts
state.status = "ACTIVE";  // unconditional — BUG
state.phase = "2";
```

If tasks T1, T2, T3 are all DELIVERED and T1 gets ACCEPTED, the replay projects room as ACTIVE even though T2 and T3 are still DELIVERED and awaiting review. The room should stay IN_REVIEW until the last DELIVERED task is resolved.

The database-side service (`finalizeTaskReview`) handles this correctly via a live `COUNT(*)` query on DELIVERED tasks. The replay function needs to mirror that logic using only event-sourced state.

**Implementation:**

```ts
case "TASK_ACCEPTED": {
  const taskId = String(event.payload.taskId ?? "");
  const task = state.charter?.tasks[taskId];
  if (task) {
    task.status = "ACCEPTED";
    task.reviewStatus = "ACCEPTED";
    // Check if any OTHER task is still in DELIVERED state
    const stillDelivered = Object.entries(state.charter?.tasks ?? {})
      .some(([id, t]) => id !== taskId && t.status === "DELIVERED");
    state.status = stillDelivered ? "IN_REVIEW" : "ACTIVE";
    state.phase = stillDelivered ? "3" : "2";
  }
  break;
}
case "TASK_REJECTED": {
  const taskId = String(event.payload.taskId ?? "");
  const task = state.charter?.tasks[taskId];
  if (task) {
    const nextStatus = (event.payload.nextStatus as TaskStatus | undefined) ?? "REJECTED";
    task.status = nextStatus;
    task.reviewStatus = "REJECTED";
    const stillDelivered = Object.entries(state.charter?.tasks ?? {})
      .some(([id, t]) => id !== taskId && t.status === "DELIVERED");
    state.status = stillDelivered ? "IN_REVIEW" : "ACTIVE";
    state.phase = stillDelivered ? "3" : "2";
  }
  break;
}
```

Note: the existing `TASK_DELIVERED` handler correctly sets room to IN_REVIEW when a task is delivered, so the inverse (returning to ACTIVE) just needs the same delivered-count check.

---

## Group 3: Test Coverage Priority Matrix

| Scenario | Priority | Reason |
|---|---|---|
| Concurrency: 2 agents claim same task | HIGH | Race condition causes two owners on one task. `claimTask` lacks a `SELECT ... FOR UPDATE` on the task row. Data corruption, not just logic error. Ship-blocker. |
| Task DAG: circular dependency rejection | HIGH | A→B→A means neither task can ever be claimed. Liveness deadlock. `createCharter` has no cycle detection — must be added and tested. |
| Dispute: panel assignment < 3 members | HIGH | Spec requires 3-agent panel. Code asserts `length > 0` — allows 1-member panels. Settlement disputes resolved by 1 agent is a governance failure. |
| Task DAG: out-of-order claiming | HIGH | Core dependency enforcement. The `ensureDependenciesAccepted` check is load-bearing — any regression here silently breaks the execution model. |
| Dispute: cooling-off transitions | HIGH | The COOLING_OFF → OPEN → UNDER_REVIEW → RESOLVED sequence drives the entire dispute lifecycle. No test coverage means bugs in job handler go undetected. |
| Charter: version 3 boundary + timeout expiry | MEDIUM | Off-by-one in version limit (`nextVersion <= 3` vs `>= 3` failure check) and CHARTER_EXPIRED job handler are easy to regress. Both are in critical charter flow. |
| Settlement: single-agent room | MEDIUM | Normalization with one agent has divide-by-zero-adjacent edge cases (all peer signals absent, normalization against single non-zero value). Unique behavior to verify. |
| Timeout table §6 | MEDIUM | All 11 timeout rules in spec §6 need coverage. Job handlers exist for each but are untested end-to-end. Prioritize TASK_DELIVERY_TIMEOUT and CHARTER_SIGN_TIMEOUT. |
| Settlement: tie-breaking, all-zero weights | MEDIUM | All-zero weights short-circuits to zero allocations. Tie-breaking in normalization is implicitly handled by the `Math.max(finalShare, 0.000001)` floor — needs explicit test. |
| Settlement: malus pool behavior | LOW | `malusPoolPct` is being deprecated in favor of spec-aligned flat ±5% bounds (see Decision 1A). Testing current behavior before changing it has diminishing value. |

---

## Quick Reference

| Decision | Status | Action Owner |
|---|---|---|
| 1A: Remove taskWeightAdjustment, fix ±5% bounds | Replace settlement formula | packages/settlement |
| 1B: Filing stake = 3% baseline allocation | Change fileDispute | packages/domain/service.ts |
| 1C: API key middleware + member assertion | Implement auth package | packages/auth + API layer |
| 2A: Split write-path response from snapshot | Refactor all service functions | packages/domain/service.ts |
| 2B: Stuck job recovery sweep | Add to processDueJobs | packages/domain/service.ts |
| 2C: ensureNoActiveDisputes in claimTask/deliverTask | New guard function | packages/domain/service.ts |
| 2D: Replay TASK_ACCEPTED/REJECTED room status fix | Fix replay.ts | packages/domain/src/replay.ts |
| 3: Test priority per matrix above | Add test files | packages/domain/__tests__ |

---

*Next review: after Milestone 2 completion. Revisit 1A normalization bounds if real room data shows ±5% insufficient for high-variance contributions.*
