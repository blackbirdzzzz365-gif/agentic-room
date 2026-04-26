# Agentic Room Network — Phase 1 Frontend Agent Brief

**Version:** 1.0  
**Status:** Ready for execution  
**Last updated:** 2026-04-21

## Mission

You are the **frontend lane agent** for Agentic Room Phase 1.

Your job is to turn the existing `apps/web` shell into a working user-facing Phase 1 application while **preserving the current FE design system and shell patterns**.

This is not a redesign exercise. The FE already has a real foundation. Your task is to **integrate, normalize, wire, and polish** without breaking the design language already present in the repo.

## Read This First

Read these files in order before changing code:

1. [Phase 1 README](../../../phase1/00-README.md)
2. [Current Codebase Baseline](../../../phase1/06-current-codebase-baseline.md)
3. [FE Implementation Contract](../../../phase1/07-fe-implementation-contract.md)
4. [FE-BE Integration Contract](../../../phase1/08-fe-be-integration-contract.md)
5. [Parallel Lane Runbook](README.md)
6. [Backend Codebase Review 2026-04-19](../../../reviews/2026-04-19-codebase-review.md)

Optional but recommended:

- [BRD](../../../phase1/01-brd.md)
- [User Stories](../../../phase1/02-user-stories.md)
- [System Design](../../../phase1/04-system-design.md)

Do not treat `apps/web/src/app/docs/page.tsx` as a source of truth for runtime behavior. It is user-facing copy and currently contains stale contract details.

## Recommended Branch and Worktree

- Branch: `codex/fe-phase1-integration`
- Worktree: `.claude/worktrees/agent-fe`

Example:

```bash
git worktree add .claude/worktrees/agent-fe -b codex/fe-phase1-integration main
```

## Scope Ownership

Primary write scope:

- `apps/web/**`

Read-only unless explicitly coordinated:

- `apps/api/**`
- `packages/domain/**`
- `packages/contracts/**`
- `packages/db/**`

If the FE lane discovers a contract mismatch, update [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md) and coordinate with the BE lane. Do not “fix” it by inventing a silent FE-only payload.

## What Must Be Preserved

The current FE foundation is intentional. Preserve it.

These are locked implementation anchors:

- semantic theme tokens in `apps/web/src/app/globals.css`
- provider stack in `apps/web/src/components/providers.tsx`
- root shell in `apps/web/src/app/layout.tsx`
- sidebar in `apps/web/src/components/shared/sidebar.tsx`
- topbar in `apps/web/src/components/shared/topbar.tsx`
- status rendering via `apps/web/src/components/shared/status-badge.tsx`
- room summary card pattern via `apps/web/src/components/shared/room-card.tsx`
- KPI pattern via `apps/web/src/components/shared/kpi-card.tsx`
- lifecycle visualization via `apps/web/src/components/shared/phase-stepper.tsx`
- empty-state pattern via `apps/web/src/components/shared/empty-state.tsx`
- token reveal via `apps/web/src/components/shared/token-text.tsx`

Do not replace the shell, swap the typography, or introduce a different design system.

## What Is Already True

The current FE already gives you:

- route shells for `/`, `/rooms`, `/rooms/new`, `/rooms/[roomId]`, `/admin`, `/docs`
- a sidebar/topbar layout
- dark/light theme handling
- Sonner toast provider
- shared cards, status badges, stepper, empty states, and token reveal
- a typed FE view-model layer in `apps/web/src/types`
- server/client fetch helpers in `apps/web/src/lib/api.ts`

Build on these. Do not restart from scratch.

## Current Integration Gaps You Must Assume Exist

At the current baseline:

- browser mutations already point to `/api-proxy/*`, but no Next proxy route exists yet
- room detail pages expect FE-friendly view models, but the API returns a nested snapshot envelope
- some FE assumptions still reflect product-shell ambitions rather than the current runtime truth
- the docs page inside the app is not aligned with the actual auth model

Your brief is to remove these gaps without breaking the current design system.

## Hard Constraints

- Keep browser secrets server-side.
- Do not send raw `x-api-key` from client components.
- Do not add new tokens or a new component library unless docs are updated first.
- Do not duplicate status-color logic outside `StatusBadge`.
- Do not invent unsupported fields like free-form rating comments if the current contract does not support them.
- Prefer adapters over leaking raw API envelopes into UI components.

## Primary Outcomes

By the time this lane is done, the FE must provide:

1. same-origin mutation plumbing that keeps secrets out of the browser
2. normalized room/admin view models instead of ad-hoc raw API usage
3. real form wiring for the major Phase 1 workflows
4. loading, empty, error, and success states that feel production-grade
5. a UI that remains visually consistent with the current FE foundation

## Execution Plan

Work in the following slices, in order.

## Slice 1 — Integration Plumbing

### Goal

Create the web-side infrastructure needed for real authenticated mutations and normalized reads.

### Required work

- Implement the same-origin Next proxy path used by `mutateJson`, under the canonical `/api-proxy/*` contract.
- Keep secret-bearing API key behavior on the server side only.
- Verify server-side reads use the documented base URL behavior.
- Decide and document where raw-to-view adapters live for room detail and admin pages.

### Files likely involved

- `apps/web/src/lib/api.ts`
- `apps/web/src/app/api-proxy/**` or equivalent Next route-handler location
- route-local or shared adapter modules under `apps/web/src/lib` or `apps/web/src/app/...`

### Done when

- client mutations no longer depend on a missing proxy path
- browser code does not need to know `x-api-key`
- adapter boundaries are clear and reusable

## Slice 2 — Normalize Room and Admin Data

### Goal

Make the app consume FE view models, not backend envelopes.

### Required work

- Build a room detail adapter that maps the raw `/api/rooms/:roomId` envelope to FE `RoomSnapshot`.
- Normalize mission, charter, members, tasks, settlement, disputes, and events according to [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md).
- Build admin-side adapters for rooms, disputes, jobs, integrity, and replay where needed.
- Keep mapping logic out of presentational components as much as possible.

### Important rules

- derive charter signature state from members rather than assuming the API already returns it as a FE-ready object
- derive `charter.tasks` from the task list until BE exposes a better shape
- do not fabricate dispute evidence arrays
- keep `apps/web/src/types/index.ts` as FE view-model types, not raw wire DTOs

### Files likely involved

- `apps/web/src/types/index.ts`
- `apps/web/src/app/rooms/[roomId]/page.tsx`
- `apps/web/src/app/rooms/[roomId]/room-detail-client.tsx`
- `apps/web/src/app/admin/admin-dashboard-client.tsx`
- new adapter modules you introduce

### Done when

- room detail renders from normalized data instead of assuming a flat BE payload
- admin pages stop depending on incidental raw response shapes

## Slice 3 — Wire the Core User Flows

### Goal

Make the primary user-facing workflows actually work from the UI.

### Required work

At minimum, wire these flows:

1. create room
2. draft mission
3. confirm mission
4. invite member
5. accept or decline invite
6. create charter
7. sign or decline charter
8. claim task
9. unclaim task
10. deliver task
11. review task
12. submit peer rating
13. submit requester rating
14. propose settlement
15. vote on settlement
16. file dispute

If admin actions are already exposed in the FE shell, also wire:

- run due jobs
- assign dispute panel
- resolve dispute
- override room state

### Form rules

Every new or materially changed form must:

- use `react-hook-form`
- validate with `zod`
- show pending state while submitting
- show success and error feedback through Sonner

### Contract rules

- use only payloads allowed by [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md)
- do not invent comment fields or unsupported nested payloads
- if BE is not ready for a documented contract, isolate the FE behind adapters and leave a concrete blocker note

### Done when

- core flows can be exercised end-to-end against the local stack without manual request editing

## Slice 4 — UX Quality Pass

### Goal

Make the integrated FE feel complete rather than merely connected.

### Required work

- ensure loading states use skeletons or equivalent placeholders
- ensure empty list views use `EmptyState`
- ensure errors are visible and actionable
- ensure mobile sidebar and responsive layouts keep working
- ensure theme toggle continues to work without hydration mismatch
- use `TokenText` for mission/charter/event streaming surfaces rather than inventing a second animation system

### Design-system guardrails

- status colors must come from `StatusBadge`
- global tokens must remain in `globals.css`
- reuse shared glass-card and standard-card patterns
- preserve the current nav labels: `Home`, `Rooms`, `Admin`, `Docs`

### Done when

- route-level flows are not just functional, but visually coherent with the current FE foundation

## Acceptance Criteria

This lane is only done when all of the following are true:

- browser mutations work through same-origin server-side plumbing
- room detail and admin screens render normalized data correctly
- FE forms use the documented payload contracts
- core user flows work from the UI against the running stack
- loading, empty, toast, and error states are present
- the current FE design system has been preserved rather than replaced

## Validation Commands

Run at minimum:

```bash
pnpm --filter @agentic-room/web build
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

Then verify routes:

- `http://localhost:3000/`
- `http://localhost:3000/rooms`
- `http://localhost:3000/rooms/new`
- `http://localhost:3000/rooms/<roomId>`
- `http://localhost:3000/admin`
- `http://localhost:3000/docs`

And verify behavior:

1. mobile sidebar opens and closes
2. theme toggle works
3. room detail renders without snapshot-shape errors
4. at least one mutation succeeds from the UI
5. success and error toasts appear
6. empty states and skeletons appear where appropriate

## Handoff Package

When handing work back, provide:

- changed files
- which slices were completed
- exact routes and flows tested
- any blockers that still depend on the BE lane
- any updates made to [08-fe-be-integration-contract.md](../../../phase1/08-fe-be-integration-contract.md)

If you leave a blocker, specify:

- exact route
- exact payload/field
- whether the blocker is missing data, missing endpoint behavior, or an unresolved contract decision

## Non-Goals

Do not spend time on:

- redesigning the shell
- replacing the color system
- changing the nav structure
- adding a second badge system
- introducing a new component library
- speculative visual experimentation unrelated to Phase 1 delivery

Your job is Phase 1 FE integration on top of the current design system, not a new branding pass.
