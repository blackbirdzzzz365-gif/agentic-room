# Agentic Room Network — Phase 1 Backend Agent Brief

**Version:** 1.0  
**Status:** Ready for execution  
**Last updated:** 2026-04-21

## Mission

You are the **backend lane agent** for Agentic Room Phase 1.

Your job is to make the runtime satisfy the locked Phase 1 business rules and the FE-facing integration contract so that the frontend lane can wire real user flows without guessing.

This is not a greenfield redesign. The stack already runs. Your task is to **harden correctness, close contract gaps, and make the HTTP boundary trustworthy**.

## Read This First

Read these files in order before changing code:

1. [Phase 1 README](../../../phase1/00-README.md)
2. [BRD](../../../phase1/01-brd.md)
3. [User Stories](../../../phase1/02-user-stories.md)
4. [System Design](../../../phase1/04-system-design.md)
5. [Current Codebase Baseline](../../../phase1/06-current-codebase-baseline.md)
6. [FE-BE Integration Contract](../../../phase1/08-fe-be-integration-contract.md)
7. [Parallel Lane Runbook](README.md)
8. [Codebase Review 2026-04-19](../../../reviews/2026-04-19-codebase-review.md)

Do not start implementation from checkpoint docs alone. The checkpoint docs are sequencing aids, not the full contract.

## Recommended Branch and Worktree

- Branch: `codex/be-phase1-hardening`
- Worktree: `.claude/worktrees/agent-be`

Example:

```bash
git worktree add .claude/worktrees/agent-be -b codex/be-phase1-hardening main
```

## Scope Ownership

Primary write scope:

- `packages/domain/**`
- `packages/contracts/**`
- `packages/db/**`
- `packages/auth/**`
- `packages/ledger/**`
- `packages/worker/**`
- `apps/api/**`
- backend seeds and backend regression scripts

Read-only unless explicitly coordinated:

- `apps/web/**`

## What Is Already True

The current stack already supports most of the Phase 1 lifecycle mechanically:

- room creation and formation
- mission draft and confirm
- invite / accept / decline
- charter create / sign / decline / expire / activate
- task claim / deliver / review
- settlement proposal and voting
- disputes and some admin flows
- replay, integrity, jobs, metrics

Do not rebuild what already exists just because the structure is imperfect. Harden it.

## What Is Not Good Enough Yet

The current `main` branch still has backend-level risks that block a trustworthy release and make FE integration brittle.

From the current review baseline, the main backend risks are:

- API authentication is not fully translated into domain command fields
- review and rating authorization are too weak
- settlement timeout and quorum fallback are incomplete
- execution deadline and delivery-timeout economics are wrong or incomplete
- replay/projection can diverge from persisted dispute state
- charter economic naming is not aligned across docs, schema, and runtime
- migration bookkeeping is not robust enough for repeated runs

Your brief is to fix these in the correct order.

## Hard Constraints

- Do not redesign the FE.
- Do not invent new FE payloads outside [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md).
- Do not change the business contract silently. If runtime behavior changes the contract, update docs first.
- Keep Docker as the shared validation path.
- Prefer additive hardening over broad refactors.

## Primary Outcomes

By the time this lane is done, the backend must provide:

1. a stable FE-facing HTTP contract
2. correct Phase 1 authorization and state transitions
3. worker behavior that resolves stalled rooms instead of leaving them stuck
4. replay/integrity behavior that matches persisted truth
5. regression coverage strong enough for FE and QA to trust the stack

## Execution Plan

Work in the following slices, in order.

## Slice 1 — Lock the HTTP Translation Layer

### Goal

Make `apps/api` satisfy the documented FE-facing contract.

### Required work

- Ensure authenticated API requests are translated into the domain command fields the runtime requires.
- Remove the need for FE to send `actorId` or `actorRole` in HTTP payloads.
- Keep the canonical endpoints and request bodies aligned with [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md).
- Verify room list, room detail, admin reads, and all mutation routes exposed to FE.
- If browser-originated development still hits API directly, make CORS/header handling compatible with documented behavior.

### Files likely involved

- `apps/api/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/domain/src/service.ts`

### Done when

- FE can submit documented business payloads only
- API route handlers inject or derive what the domain layer needs
- endpoint names and payload shapes match the integration contract doc

## Slice 2 — Fix Authorization and Abuse Gaps

### Goal

Make the review and rating paths trustworthy.

### Required work

- Ensure task review is only performed by an allowed reviewer/requester path.
- Prevent self-review on delivered tasks.
- Ensure peer ratings require active membership and disallow self-rating.
- Ensure requester ratings are only submitted by the room requester or the explicitly authorized actor defined by the domain model.
- Ensure ratings are only accepted in the allowed lifecycle window.

### Files likely involved

- `packages/domain/src/service.ts`
- `packages/contracts/src/index.ts`
- route tests or integration tests you add for these flows

### Done when

- unauthorized review/rating attempts fail predictably
- self-review and self-rating are blocked
- tests cover the abuse cases, not just happy paths

## Slice 3 — Fix Lifecycle and Economic Correctness

### Goal

Make Phase 1 room progression stop getting stuck or losing intended economics.

### Required work

- Implement settlement timeout / quorum fallback so rooms cannot stay in `IN_SETTLEMENT` forever.
- Make execution-deadline behavior preserve accepted work and transition to the correct post-execution path instead of dropping rooms incorrectly.
- Make task delivery timeout and requeue behavior preserve or release stake/economic state correctly.
- Reconcile charter economic field naming across schema, domain, API, and docs.

### Important note

The charter field alignment issue is structural. Do not patch it with a one-off alias in one layer only.

You must make these layers agree:

- DB schema
- domain service
- snapshot/read model
- settlement calculation path
- documented contract

If the canonical FE-facing field changes, update [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md) before shipping code.

### Files likely involved

- `packages/domain/src/service.ts`
- `packages/db/src/sql/*.sql`
- `packages/db/src/migrate.ts`
- `packages/contracts/src/index.ts`

### Done when

- stalled settlement rooms resolve via documented fallback
- execution and timeout behavior do not strand rooms or distort stake accounting
- charter economics are internally consistent across layers

## Slice 4 — Replay, Integrity, and Admin Truth

### Goal

Make replay-derived truth match persisted truth closely enough for admin and audit workflows.

### Required work

- Align dispute replay/projection with the actual runtime state machine.
- Ensure room status after dispute resolution is reflected correctly in replay/projection outputs.
- Verify integrity and replay endpoints return coherent data for the admin lane.
- Tighten migration bookkeeping if it still replays already-applied migrations unsafely.

### Files likely involved

- `packages/domain/src/replay.ts`
- `packages/domain/src/service.ts`
- `packages/db/src/migrate.ts`

### Done when

- replay output does not contradict resolved room/dispute state
- integrity/replay endpoints are stable enough for admin UI and QA

## Slice 5 — Regression Proof

### Goal

Leave behind executable proof that the backend contract is now trustworthy.

### Required work

- Add or improve DB-backed tests for critical room lifecycle flows.
- Add tests for auth/authorization edge cases.
- Add tests for timeout-driven transitions and settlement fallback.
- Validate the stack through Docker, not only local direct process runs.

### Minimum coverage expected

- room creation through charter activation
- task claim / deliver / review
- settlement propose / vote / timeout fallback
- dispute file / panel / resolve
- replay and integrity assertions

### Done when

- `pnpm test` passes
- `pnpm build` passes
- Docker stack runs and real API smoke flows succeed

## Acceptance Criteria

This lane is only done when all of the following are true:

- documented FE-facing routes exist and work with documented payloads
- API injects actor identity instead of expecting FE to do it
- review/rating abuse paths are blocked
- settlement timeout/quorum fallback exists
- execution deadline and task timeout handling preserve intended lifecycle behavior
- replay and persisted state no longer disagree on the critical dispute flows
- tests cover the major regressions, not only happy paths

## Validation Commands

Run at minimum:

```bash
pnpm test
pnpm build
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

Then verify at minimum:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/rooms
curl http://localhost:4000/api/admin/integrity
```

And run an end-to-end script or manual API flow for:

1. room creation
2. mission draft/confirm
3. member invite/accept
4. charter create/sign
5. task claim/deliver/review
6. settlement propose/vote
7. dispute file/panel/resolve

## Handoff Package

When handing work back, provide:

- changed files
- which slices were completed
- exact tests/commands run
- any contract changes made to `docs/phase1/08-fe-be-integration-contract.md`
- any remaining blockers for FE

If you leave a blocker, it must be concrete. Example:

- which endpoint
- which payload field
- which route in `apps/web`
- whether the blocker is a code issue or a contract decision

## Non-Goals

Do not spend time on:

- cosmetic FE polish
- new design tokens
- docs-page marketing copy
- speculative architecture cleanup outside the active risks

Your job is backend hardening for a reliable Phase 1 release.
