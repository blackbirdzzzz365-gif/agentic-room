# Codebase Review — 2026-04-19

## Scope

Review target: current Phase 1 codebase in `/Users/nguyenquocthong/project/agentic-room`.

What I checked:

- `pnpm build` -> passed
- `pnpm test -- --runInBand` -> passed
- `pnpm db:migrate` -> failed because local Postgres was not reachable at `127.0.0.1:55432`

This means the findings below are based on:

- static code review of the current runtime paths
- comparison against the locked Phase 1 docs
- consistency checking across contracts, schema, worker, and replay logic

## Findings

### [high] Charter persistence model does not match the migrated schema or the locked docs

**Files**

- `packages/db/src/sql/002_phase1_core.sql:38-50`
- `packages/domain/src/service.ts:85-97`
- `packages/domain/src/service.ts:675-692`
- `packages/domain/src/service.ts:1153-1157`
- `packages/domain/src/service.ts:1201`
- `packages/domain/src/service.ts:1624-1630`
- `docs/phase1/02-user-stories.md:84`
- `docs/phase1/04-system-design.md:213-220`

**Problem**

The current DB schema stores charter pools as `bonus_pool_pct` and `malus_pool_pct`, but the active domain service reads and writes a single `discretionary_pool_pct`. The Phase 1 docs also describe separate bonus/malus pools, not a single discretionary pool.

That means the current live code path is internally inconsistent:

- `createCharter()` inserts into `discretionary_pool_pct`
- `proposeSettlement()` reads `charter.discretionary_pool_pct`
- `getRoomSnapshot()` exposes `discretionaryPoolPct`
- the actual schema has no such column

**Impact**

With a real migrated database, the charter and settlement path will fail at runtime or read the wrong data shape. This is a release-blocking mismatch because it sits on the core room-to-settlement lifecycle.

### [high] Settlement math does not implement the Phase 1 economic contract

**Files**

- `packages/settlement/src/index.ts:65-181`
- `docs/phase1/02-user-stories.md:191-194`
- `docs/phase1/04-system-design.md:204-244`

**Problem**

The settlement engine currently normalizes:

`baselineShare + peerAdjustment + requesterAdjustment`

Accepted task weights are only logged and used as a zero-work guard. They do not actually change the final allocation.

But the locked Phase 1 design says settlement must be driven by:

- accepted task weights
- baseline split
- bounded peer adjustment
- bounded requester adjustment
- bounded task-weight reconciliation

The current implementation therefore produces a materially different payout model from the one documented for Phase 1.

**Impact**

Two rooms with very different accepted task distributions can still end up with nearly the same payout if their baseline split is the same. That breaks the fairness story that the product is supposed to prove in Phase 1.

### [high] Review and rating commands are missing critical authorization and anti-abuse checks

**Files**

- `packages/domain/src/service.ts:1088-1093`
- `packages/domain/src/service.ts:984-1085`
- `packages/domain/src/service.ts:1097-1128`
- `docs/phase1/02-user-stories.md:148-152`
- `docs/phase1/04-system-design.md:333`

**Problem**

The active review path does not verify:

- reviewer is an active room member
- reviewer is not the assignee of the task

The rating paths also do not verify:

- actor is an active member
- requester rating is actually submitted by the room requester
- peer rating excludes self-rating
- rating collection only happens after execution closes

The docs explicitly require that permissions be explicit, and the user stories explicitly forbid self-review.

**Impact**

An arbitrary caller can:

- approve their own delivered task
- submit peer or requester ratings without proper authority
- manipulate settlement outcomes

This is a trust failure in the exact area the product is trying to make auditable.

### [high] Settlement can get stuck forever because vote-window timeout handling is missing

**Files**

- `packages/domain/src/service.ts:1189-1221`
- `packages/domain/src/service.ts:1753-1864`
- `docs/phase1/04-system-design.md:309-310`
- `docs/phase1/04-system-design.md:325`

**Problem**

`proposeSettlement()` creates a proposal and moves the room into `IN_SETTLEMENT`, but it does not enqueue any settlement quorum or vote-deadline job.

The worker also has no `SETTLEMENT_VOTE_TIMEOUT` or manual-review fallback branch.

So the room only progresses if enough members actively vote `ACCEPT`. If quorum is missed, people abstain, or the vote stalls, nothing moves the room forward.

**Impact**

Rooms can remain in `IN_SETTLEMENT` indefinitely. That is operationally worse than a hard failure because it creates stuck economic state with no automated exit path.

### [high] Execution-deadline and delivery-timeout behavior do not preserve the intended room economics

**Files**

- `packages/domain/src/service.ts:1756-1760`
- `packages/domain/src/service.ts:1785-1805`
- `packages/domain/src/service.ts:824-873`
- `docs/phase1/04-system-design.md:323`
- `docs/phase1/04-system-design.md:327`

**Problem**

There are two separate logic issues here:

1. When the room execution deadline is reached, the worker marks the room `FAILED` immediately.
2. When a task delivery deadline is missed, the worker requeues the task but does not slash or release the participant's locked stake.

The Phase 1 docs say execution hard-wall handling should preserve accepted work and force the room into settlement, not discard the room as failed. They also say delivery timeout should slash claim stake and requeue.

**Impact**

- accepted work can be discarded at the room deadline
- participants can keep permanently inflated `stake_locked` balances after timeout
- economic state drifts away from the intended pilot rules

### [medium] Replay/projection logic diverges from the actual dispute state machine

**Files**

- `packages/domain/src/service.ts:1427-1435`
- `packages/domain/src/service.ts:1488-1497`
- `packages/domain/src/replay.ts:283-306`

**Problem**

The runtime service sets a paneled dispute to `UNDER_REVIEW`, but replay maps `DISPUTE_PANELED` to `PANEL_ASSIGNED`.

There is also a second inconsistency: when a dispute is resolved, replay does not restore room status from `DISPUTED` to the post-resolution fallback state. It leaves the room status unchanged, which usually means the projection stays `DISPUTED` forever even though the DB row has been resolved and the room row may already be back to `ACTIVE` or `IN_SETTLEMENT`.

**Impact**

`GET /api/rooms/:roomId` can return a projection that disagrees with the persisted room state. That undermines replay-as-truth, which is one of the main trust claims of the system.

### [medium] Migration bookkeeping is present but not actually used to skip applied migrations

**Files**

- `packages/db/src/migrate.ts:13-20`
- `packages/db/src/sql/001_init.sql:1-4`

**Problem**

The migration runner:

1. reads all `.sql` files
2. executes every file on every run
3. inserts a row into `schema_migrations` afterward

So `schema_migrations` is only a log, not a guard. This works only while every migration is written to be manually re-runnable. The first normal non-idempotent migration will break repeated deploys.

**Impact**

Schema evolution is fragile. The current migration system will not scale beyond the initial bootstrap set.

### [medium] Required timeout coverage from the Phase 1 docs is still incomplete

**Files**

- `packages/contracts/src/index.ts:124-131`
- `packages/domain/src/service.ts:521-524`
- `packages/domain/src/service.ts:740-748`
- `packages/domain/src/service.ts:867-871`
- `packages/domain/src/service.ts:974-978`
- `packages/domain/src/service.ts:1380-1388`
- `packages/domain/src/service.ts:1445-1453`
- `packages/domain/src/service.ts:1753-1864`
- `docs/phase1/04-system-design.md:304-314`
- `docs/phase1/04-system-design.md:320-327`

**Problem**

The docs define worker coverage for:

- invitation timeout
- task claim timeout
- settlement quorum timeout
- ledger verifier
- payment handoff sender

The current worker coverage only includes:

- room execution deadline
- charter sign timeout
- task delivery timeout
- task review timeout
- dispute cooling-off end
- dispute panel timeout

There is also a contract smell here: `invitationWindowHours` exists in the shared timeout schema but is not used by the domain service at all.

**Impact**

The codebase looks more complete than it actually is. Several rooms can still stall or bypass the intended operational fallback paths.

## Open Questions

- Should Phase 1 economics stay with the locked docs model (`bonus_pool_pct` + `malus_pool_pct` + bounded task-weight reconciliation), or should the docs be revised to match the current discretionary-pool implementation? Right now both cannot be true.
- Should a task that exceeds maximum failed deliveries become `BLOCKED`, `REQUEUED`, or `CANCELLED`? Current comments, event semantics, and docs are not fully aligned.
- Is the requester meant to be modeled as a room member with explicit state, or as an external authority with separate permissions? The codebase currently mixes both ideas.

## Test Gaps

Current automated coverage is too narrow for the risks above.

What is covered:

- ledger hash verification
- replay reducer
- pure settlement math helper

What is missing:

- DB-backed happy path from room creation to settlement finalization
- migration/schema compatibility tests
- timeout job integration tests
- authorization tests on review, rating, and dispute commands
- replay-vs-database consistency tests after disputes are resolved

This is why `pnpm build` and `pnpm test` can still pass while several runtime-critical mismatches remain.

## Suggested Fix Order

1. Unify the charter economic model across docs, contracts, SQL schema, domain service, and settlement package.
2. Lock authorization for review and rating commands before any further product testing.
3. Add missing settlement timeout/manual-review handling so rooms cannot stall forever.
4. Fix stake lifecycle on delivery timeout and hard-wall execution handling.
5. Correct replay/dispute state restoration so projection can be trusted operationally.
6. Replace the current migration runner with real version-aware execution.
7. Add DB-backed lifecycle integration tests that cover the entire room state machine.
