# Agentic Room Network — Phase 1 Parallel Lane Runbook

**Version:** 1.0  
**Status:** Active runbook for two-agent parallel execution  
**Last updated:** 2026-04-21

## Purpose

This runbook defines how to execute Phase 1 with **two agents working in parallel** on separate branches and worktrees:

- one **BE lane**
- one **FE lane**

The goal is to let both agents move independently **without colliding on ownership, contract assumptions, or design decisions**.

This file is intentionally operational. It is not another product spec. It tells each lane exactly what to read, what to own, what not to touch, and when to sync.

## Agent Briefs

Use these files as the direct execution briefs for each implementation agent:

- [Backend Agent Brief](be-brief.md)
- [Frontend Agent Brief](fe-brief.md)

## Required Reading Before Either Lane Starts

Both lanes must read these documents in order:

1. [Phase 1 README](../../../phase1/00-README.md)
2. [BRD](../../../phase1/01-brd.md)
3. [User Stories](../../../phase1/02-user-stories.md)
4. [System Design](../../../phase1/04-system-design.md)
5. [Current Codebase Baseline](../../../phase1/06-current-codebase-baseline.md)
6. [FE Implementation Contract](../../../phase1/07-fe-implementation-contract.md)
7. [FE-BE Integration Contract](../../../phase1/08-fe-be-integration-contract.md)
8. [Checkpoint breakdown](../checkpoints/README.md)

Important:

- the FE lane must not skip documents `07` and `08`
- the BE lane must not ignore `08`, because it defines the HTTP boundary FE is coding against

## Worktree and Branch Setup

Run parallel work in separate worktrees. Do not use one dirty checkout for both lanes.

Example setup:

```bash
git worktree add .claude/worktrees/agent-be -b codex/be-phase1-hardening main
git worktree add .claude/worktrees/agent-fe -b codex/fe-phase1-integration main
```

Recommended working directories:

- BE lane: `.claude/worktrees/agent-be`
- FE lane: `.claude/worktrees/agent-fe`

Do not point both agents at the same `cwd`.

## Common Operating Rules

These rules apply to both lanes.

### Rule 1: Respect Ownership

Each lane has a primary write scope. Do not casually edit files owned by the other lane.

### Rule 2: Update Docs Before Redefining Contracts

If a wire contract, FE design contract, or lane ownership rule changes:

- update the relevant doc first
- then change code

### Rule 3: Do Not Hide Workarounds

Do not “just make it work locally” by adding hidden assumptions in code that are not reflected in the docs.

### Rule 4: Preserve Phase 1 Scope

Do not use the lane split as an excuse to add unplanned features, alternate auth models, or a new design system.

### Rule 5: Validate in Docker

The final shared verification path must run through the Docker stack, even if a lane uses faster local commands during development.

## Shared Commands

### Start stack

```bash
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

### Stop stack

```bash
docker compose -f infra/docker/docker-compose.stack.yml down
```

### Full repo build

```bash
pnpm build
```

### Full repo tests

```bash
pnpm test
```

## Lane A — Backend

### Scope Ownership

Primary ownership:

- `packages/domain/**`
- `packages/contracts/**`
- `packages/db/**`
- `packages/auth/**`
- `packages/ledger/**`
- `packages/worker/**`
- `apps/api/**`
- backend-facing scripts and seeds

Read-only unless coordinated:

- `apps/web/**`

### Primary Mission

The BE lane exists to make the runtime satisfy Phase 1 domain behavior and the FE-facing integration contract.

Core outcomes:

- domain rules are correct
- HTTP routes correctly translate FE payloads into domain commands
- actor identity is injected at API boundary
- replay/integrity behavior is reliable
- background jobs and timeouts behave correctly
- regression tests cover BRD use cases

### BE Lane Priority Stack

Work in this order unless blocked:

1. Fix API/domain contract mismatches that prevent FE integration.
2. Harden Phase 1 lifecycle semantics.
3. Fill replay, integrity, settlement, and dispute gaps.
4. Expand automated regression coverage.
5. Only then optimize or refactor internals.

### BE Lane Explicit Responsibilities

- make API routes satisfy [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md)
- keep `packages/contracts` aligned with domain semantics
- ensure API auth translates caller identity into domain command fields
- ensure room detail snapshot and admin endpoints are consistent enough for FE adapters
- own any CORS or proxy-related API behavior needed for the documented integration contract

### BE Lane Must Not Do

- redesign the FE
- rename FE routes or nav labels
- introduce FE-only view-model fields directly into domain logic without documenting them
- add FE workarounds in API responses that are not documented

### BE Lane Validation

Minimum validation commands:

```bash
pnpm test
pnpm build
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

Then verify at least:

- API health
- room list
- room detail snapshot
- room event log
- admin rooms/disputes/jobs/metrics/integrity
- critical mutations used by FE

### BE Lane Done Criteria

The BE lane is ready for FE integration when:

- documented HTTP routes exist
- payloads and response shapes match the integration contract
- actor injection is handled in API, not expected from FE
- Docker stack runs cleanly
- regression tests pass

## Lane B — Frontend

### Scope Ownership

Primary ownership:

- `apps/web/**`

Read-only unless coordinated:

- `apps/api/**`
- `packages/domain/**`
- `packages/contracts/**`
- `packages/db/**`

### Primary Mission

The FE lane exists to turn the Phase 1 product into a working web application **without replacing the current FE foundation**.

Core outcomes:

- preserve the existing shell, tokens, and shared component patterns
- wire pages to the backend contract correctly
- normalize raw API envelopes into FE view models
- provide complete loading, empty, and mutation feedback states
- finish the user-facing workflows that the current shell only partially covers

### FE Lane Hard Rule

The FE lane must follow:

- [FE Implementation Contract](../../../phase1/07-fe-implementation-contract.md)
- [FE-BE Integration Contract](../../../phase1/08-fe-be-integration-contract.md)

The current FE is not disposable scaffolding. It is the design baseline to extend.

### FE Lane Priority Stack

Work in this order unless blocked:

1. Keep the design system and shell consistent.
2. Add or fix same-origin proxy/API adapter paths required for browser mutations.
3. Normalize room detail/admin payloads into FE view models.
4. Wire real mutations to forms and actions.
5. Fill remaining UX states: skeletons, empty states, toasts, responsive cleanup.

### FE Lane Explicit Responsibilities

- preserve the semantic token system in `globals.css`
- reuse `Sidebar`, `Topbar`, `StatusBadge`, `RoomCard`, `KpiCard`, `PhaseStepper`, `EmptyState`, and `TokenText`
- keep browser secrets out of client code
- use route adapters instead of leaking raw API shapes into components
- use `react-hook-form` + `zod` for new or substantially changed forms
- use Sonner for mutation feedback

### FE Lane Must Not Do

- redefine Phase 1 economics in the UI
- invent unsupported payloads when the backend contract does not allow them
- duplicate status-color logic outside `StatusBadge`
- replace the shell with a new navigation system
- swap out the current design token set or font stack

### FE Lane Validation

Minimum validation commands:

```bash
pnpm --filter @agentic-room/web build
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

Then verify at least:

- `/`
- `/rooms`
- `/rooms/new`
- `/rooms/[roomId]`
- `/admin`
- `/docs`

And verify behavior:

- mobile sidebar
- theme toggle
- room detail render from normalized snapshot
- mutation toasts
- empty states
- loading skeletons

### FE Lane Done Criteria

The FE lane is ready for merge only when:

- it builds cleanly
- it follows the FE design contract
- it uses the documented integration boundary
- critical user flows work against the running Docker stack
- it does not depend on manual request patching in devtools

## Sync Points Between Lanes

Parallel work does not mean “never sync.” Use the following checkpoints.

### Sync 1 — Before FE Mutation Wiring

Goal:

- BE confirms canonical mutation endpoints and payloads
- FE confirms form payload mapping

Required document:

- [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md)

### Sync 2 — Before Room Detail Integration Lands

Goal:

- BE confirms room snapshot/read shapes
- FE confirms normalization adapter

Output:

- agreed adapter shape for `RoomSnapshot`

### Sync 3 — Before Final Merge Candidate

Goal:

- Docker stack passes with both branches combined
- smoke flows work end-to-end

Minimum smoke flows:

1. Create room
2. Draft and confirm mission
3. Invite and accept member
4. Create and sign charter
5. Claim, deliver, and review task
6. Propose and vote settlement
7. File dispute
8. View admin integrity/replay

## Merge and Rebase Policy

Default merge order:

1. BE merges first if it changed the integration contract or API behavior.
2. FE rebases on the latest merged BE branch.
3. FE runs the final Docker smoke pass.

If FE needs a new backend contract and BE has not merged it yet, FE may build the adapter and UI behind a local abstraction, but it must not finalize the workflow until the BE contract is real.

## Escalation Rule

Stop and sync immediately if either lane hits one of these conditions:

- a route or payload needs to change from the documented contract
- the FE needs a field the BE does not expose
- the BE wants to simplify a payload that will break current FE forms
- a design change would alter the FE implementation contract

Do not let those issues sit silently in code review.
