# Agentic Room Network — Phase 1 FE Implementation Contract

**Version:** 1.0  
**Status:** Locked for FE lane execution  
**Last updated:** 2026-04-21

## Purpose

This document is the implementation source of truth for the **frontend lane** in Phase 1.

Its job is to remove guesswork for any FE-focused coding agent by locking:

- which parts of the current `apps/web` codebase are intentional and must be preserved
- which visual patterns define the current design system
- which shared components are mandatory reuse points
- which coding and validation rules the FE lane must follow before handing work back

Use this document together with:

- [06-current-codebase-baseline.md](06-current-codebase-baseline.md)
- [08-fe-be-integration-contract.md](08-fe-be-integration-contract.md)
- [Phase 1 lanes runbook](../phases/phase-1/lanes/README.md)

## Precedence Rule

For **presentation, theming, shared UI patterns, and FE structure**, this document overrides older Phase 1 docs that only describe the product at a conceptual level.

For **business rules, state machines, and domain semantics**, [04-system-design.md](04-system-design.md) and [08-fe-be-integration-contract.md](08-fe-be-integration-contract.md) override this document.

The app-facing docs page at `apps/web/src/app/docs/page.tsx` is **not** an implementation source of truth. It is user-facing copy and currently contains stale statements about auth and enums. Do not use it to infer runtime contracts.

## What the FE Lane Owns

The FE lane owns the implementation under `apps/web`, especially:

- route shells and page composition under `apps/web/src/app`
- domain-facing shared components under `apps/web/src/components/shared`
- shadcn-based UI primitives under `apps/web/src/components/ui`
- web-side API adapters and fetch helpers under `apps/web/src/lib`
- FE view-model types under `apps/web/src/types`

The FE lane does **not** own:

- domain rules in `packages/domain`
- wire contracts in `packages/contracts`
- API auth and route translation in `apps/api`
- DB schemas or migrations

If FE work reveals a contract mismatch, the lane must follow [08-fe-be-integration-contract.md](08-fe-be-integration-contract.md) instead of inventing a local workaround that silently changes protocol meaning.

## Runtime Shape

Phase 1 FE is a **Next.js App Router** application with a server-first layout and client islands only where interactivity is required.

Current route ownership:

| Route | Current file | Purpose |
|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | Home/dashboard overview |
| `/rooms` | `apps/web/src/app/rooms/page.tsx` | Room list |
| `/rooms/new` | `apps/web/src/app/rooms/new/page.tsx` | Room creation entrypoint |
| `/rooms/[roomId]` | `apps/web/src/app/rooms/[roomId]/page.tsx` | Room detail server shell |
| `/admin` | `apps/web/src/app/admin/page.tsx` | Admin page shell |
| `/docs` | `apps/web/src/app/docs/page.tsx` | User-facing product docs |

### Server/Client Composition Rule

- Prefer **Server Components** for initial data loading and static structure.
- Use `"use client"` only for:
  - theme switching
  - dialogs, drawers, menus, tabs, accordions
  - forms and mutation flows
  - SWR polling or live-refresh regions
  - token-by-token reveal behavior
- Do not convert an entire route to a Client Component just to avoid writing a small interactive child.

## FE Design System Contract

The current FE already contains a lightweight design system. Phase 1 must **extend it**, not replace it.

The existing implementation effectively uses:

- **semantic tokens** in `apps/web/src/app/globals.css`
- **theme switching** via `next-themes`
- **shared component recipes** in `apps/web/src/components/shared`
- **shadcn primitives** in `apps/web/src/components/ui`

There is no approved Phase 1 migration to a new token pipeline, new font stack, or a different component library. Do not introduce one mid-stream.

### Token Hierarchy Rule

Use the following hierarchy:

1. Semantic tokens in `globals.css`
2. Shared component recipes in `components/shared`
3. Route-local styling only when the pattern is unique to that page

Do **not** skip straight to ad-hoc one-off colors in pages when an equivalent token or shared recipe already exists.

## Theme Tokens

The following tokens are locked for Phase 1. If a lane needs to add a token, it must extend this set without renaming or redefining existing ones.

### Semantic Color Tokens

| Token | Light value | Dark value | Use |
|---|---|---|---|
| `--color-background` | `oklch(97% 0.008 85)` | `oklch(14% 0.015 260)` | App/page background |
| `--color-foreground` | `oklch(18% 0.025 40)` | `oklch(92% 0.008 220)` | Default text |
| `--color-card` | `oklch(100% 0 0)` | `oklch(17% 0.018 260)` | Solid card surfaces |
| `--color-card-foreground` | `oklch(18% 0.025 40)` | `oklch(92% 0.008 220)` | Text on cards |
| `--color-popover` | `oklch(100% 0 0)` | `oklch(17% 0.018 260)` | Dialog/popover surface |
| `--color-popover-foreground` | `oklch(18% 0.025 40)` | `oklch(92% 0.008 220)` | Text on popovers |
| `--color-primary` | `oklch(18% 0.025 40)` | `oklch(98% 0.005 220)` | Primary emphasis |
| `--color-primary-foreground` | `oklch(97% 0.008 85)` | `oklch(22% 0.03 260)` | Text on primary surfaces |
| `--color-secondary` | `oklch(93% 0.012 85)` | `oklch(22% 0.03 260)` | Secondary surfaces |
| `--color-secondary-foreground` | `oklch(18% 0.025 40)` | `oklch(98% 0.005 220)` | Text on secondary surfaces |
| `--color-muted` | `oklch(91% 0.010 85)` | `oklch(22% 0.03 260)` | Low-emphasis surfaces |
| `--color-muted-foreground` | `oklch(52% 0.015 40)` | `oklch(65% 0.012 220)` | Secondary text |
| `--color-accent` | `oklch(72% 0.15 62)` | `oklch(72% 0.15 62)` | Highlight/accent action |
| `--color-accent-foreground` | `oklch(100% 0 0)` | `oklch(100% 0 0)` | Text on accent surfaces |
| `--color-destructive` | `oklch(58% 0.22 27)` | `oklch(45% 0.18 27)` | Destructive actions |
| `--color-destructive-foreground` | `oklch(98% 0 0)` | `oklch(98% 0 0)` | Text on destructive surfaces |
| `--color-border` | `oklch(88% 0.008 85)` | `oklch(28% 0.02 260)` | Borders/dividers |
| `--color-input` | `oklch(88% 0.008 85)` | `oklch(28% 0.02 260)` | Form field borders |
| `--color-ring` | `oklch(18% 0.025 40)` | `oklch(92% 0.008 220)` | Focus rings |

### Radius Tokens

| Token | Value | Notes |
|---|---|---|
| `--radius` | `0.75rem` | Base radius |
| `--radius-sm` | `calc(var(--radius) - 0.25rem)` | Small controls |
| `--radius-md` | `var(--radius)` | Default control radius |
| `--radius-lg` | `calc(var(--radius) + 0.25rem)` | Large cards |
| `--radius-xl` | `calc(var(--radius) + 0.5rem)` | Large panels |
| `--radius-2xl` | `calc(var(--radius) + 1rem)` | Hero and glass cards |

### Typography

The typography contract is also already in code:

- body font: `"Inter", "Segoe UI", system-ui, -apple-system, sans-serif`
- headings: `font-weight: 600`
- heading tracking: `-0.02em`
- body text should default to `text-foreground`
- secondary copy should default to `text-muted-foreground`

Do not introduce a new headline font or decorative typeface during Phase 1.

### Spacing

The FE lane must maintain a consistent **8px grid**:

- use Tailwind spacing values that map cleanly to 4px and 8px increments
- page shells should keep current padding rhythm:
  - mobile: `p-4`
  - tablet: `md:p-6`
  - desktop: `lg:p-8`
- cards and panels should stay within the current `p-4` to `p-6` range unless a layout needs a documented exception

## Motion Contract

The current FE already implies a motion language. Preserve it.

### Standard Interaction Motion

- hover/focus/selection transitions: `150ms` to `200ms`, `ease`
- sidebar nav items: `0.15s ease`
- accordion open/close: `0.2s ease-out`
- glass cards and KPI surfaces: subtle shadow/border transitions only

### Token Reveal Motion

`TokenText` in `apps/web/src/components/shared/token-text.tsx` is the approved Phase 1 text reveal primitive.

Rules:

- use it for mission text, charter text, event-log streaming, or AI-generated copy
- do not create a second token-reveal implementation with different CSS unless this document is revised
- preserve the current `token-char` animation approach in `globals.css`
- prefer `speed` values that remain readable and do not delay workflow completion

## App Shell Contract

The root layout at `apps/web/src/app/layout.tsx` defines the shell the FE lane must preserve:

- fixed desktop sidebar on the left
- slide-in mobile sidebar
- sticky translucent topbar
- main content offset by `md:pl-60`
- page content inside `main` with responsive padding

### Provider Contract

`apps/web/src/components/providers.tsx` is the canonical application provider stack.

Locked behavior:

- `ThemeProvider` uses `attribute="class"`
- `defaultTheme="system"`
- `enableSystem`
- `disableTransitionOnChange`
- Sonner toaster is mounted globally
- toaster position is `bottom-right`
- toaster uses `richColors`
- toaster uses `closeButton`
- default toast duration is `4000ms`

Do not add a second theme provider or a second toast system.

### Sidebar Rules

The current sidebar is the authoritative nav pattern.

Locked behavior:

- desktop sidebar stays fixed
- mobile sidebar uses overlay + slide-in panel
- nav item styling uses `.sidebar-nav-item`
- current nav labels remain:
  - `Home`
  - `Rooms`
  - `Admin`
  - `Docs`

Important: the `/` route is the product dashboard, but the nav label is currently **Home**. FE agents should preserve that label unless a product doc explicitly changes the information architecture.

### Topbar Rules

The topbar is currently defined by:

- sticky positioning
- translucent `bg-card/80` surface
- `backdrop-blur-sm`
- theme toggle
- simple avatar badge
- route-based title resolution

Do not replace it with a new navigation pattern during Phase 1.

## Surface Recipes

When building new screens or expanding existing ones, use the current surface patterns.

### Standard Card

Use for metrics, admin tables, form wrappers, and ordinary containers.

Current recipe:

- `rounded-2xl`
- `border border-border`
- `bg-card`
- `shadow-sm`
- hover elevation may increase to `shadow-md`

### Glass Card

Use sparingly for room summaries or high-level featured surfaces.

Current recipe:

- `rounded-2xl`
- translucent border such as `border-white/20`
- translucent fill such as `bg-white/70`
- dark equivalent such as `dark:bg-white/5`
- `backdrop-blur-sm`
- subtle shadow transitions

Do not turn every surface into glass. The current app uses glass as emphasis, not as the default for every block.

### Pills and Minor Status Surfaces

Use for counts, lightweight metadata, and secondary grouping:

- rounded full shape
- muted background
- small font
- tabular numbers for counts

### Empty States

All list-like or tabular screens must provide:

- a title
- short guidance text
- an obvious CTA when a next step exists

Reuse `apps/web/src/components/shared/empty-state.tsx`.

## Shared Component Inventory

The following shared components are the default extension points. Reuse them before creating a new component with overlapping purpose.

| Component | File | Contract |
|---|---|---|
| `Providers` | `apps/web/src/components/providers.tsx` | Owns theme provider and global Sonner configuration |
| `Sidebar` | `apps/web/src/components/shared/sidebar.tsx` | Owns primary app navigation shell |
| `Topbar` | `apps/web/src/components/shared/topbar.tsx` | Owns route title, theme toggle, avatar control |
| `StatusBadge` | `apps/web/src/components/shared/status-badge.tsx` | Canonical status label + color mapping |
| `RoomCard` | `apps/web/src/components/shared/room-card.tsx` | Canonical room summary card |
| `KpiCard` | `apps/web/src/components/shared/kpi-card.tsx` | Canonical KPI/summary card |
| `PhaseStepper` | `apps/web/src/components/shared/phase-stepper.tsx` | Canonical room lifecycle visualization |
| `EmptyState` | `apps/web/src/components/shared/empty-state.tsx` | Canonical empty list/panel state |
| `TokenText` / `TokenParagraph` | `apps/web/src/components/shared/token-text.tsx` | Canonical token-by-token reveal |

### Extension Rule

- If a new component is a variant of an existing shared component, extend the existing component or extract a reusable primitive.
- Do not create parallel badge systems, phase steppers, or room-summary cards.
- If a new pattern will be reused across two or more routes, move it into `components/shared`.

## Status Color Contract

`StatusBadge` is the canonical mapping layer for:

- `RoomStatus`
- `TaskStatus`
- `DisputeStatus`
- `SettlementStatus`

Rules:

- do not duplicate status-color maps in page files
- do not style statuses with one-off colors that bypass `StatusBadge`
- if a new enum value is introduced in BE, update `StatusBadge` first

This is especially important because the current app already encodes meaningful color semantics:

- blue/cyan for active flow transitions
- green for successful/completed states
- amber/orange for pending or caution states
- red for failure or rejection
- violet/purple for settlement/finalization states

## UI Primitive Contract

`apps/web/src/components/ui` is the approved shadcn-based primitive layer. Before adding a dependency or a new primitive, check whether an existing UI primitive already exists.

Current primitives include:

- accordion
- alert-dialog
- avatar
- badge
- button
- card
- dialog
- dropdown-menu
- input
- label
- progress
- scroll-area
- select
- separator
- skeleton
- tabs
- textarea
- tooltip

Phase 1 rule:

- prefer extending these primitives with composition and class names
- do not introduce a second primitive library
- if a missing primitive is truly required, add it in the same style family as current shadcn usage

## FE Coding Rules

### Data and Type Handling

- Treat `apps/web/src/types/index.ts` as **FE view-model types**, not guaranteed raw API DTOs.
- Add explicit adapters when BE returns nested envelopes or differently named fields.
- Keep mapping logic out of presentational components where possible.

### Forms

All new or significantly modified forms must:

- use `react-hook-form`
- validate with `zod`
- show loading state while submitting
- trigger success or error toast via Sonner

### Loading and Empty States

All data views must handle:

- loading skeleton
- non-empty data
- empty state
- request failure state when applicable

Do not ship a page that simply renders `null` while data is missing unless it is a very small shell route whose child handles the state explicitly.

### Accessibility

- preserve visible focus states through `ring`
- do not remove semantic labels from icon-only buttons
- keep theme toggle and mobile menu reachable by keyboard
- use `aria-current="step"` on steppers when appropriate

### Design Guardrails

- no new global colors without updating this document and `globals.css`
- no new font family without an explicit product/design decision
- no one-off status badges
- no route-local duplicate of sidebar/topbar patterns
- no browser-side secret handling

## Recommended FE File Strategy

When expanding the app, prefer the following split:

- route shell in `src/app/...`
- route client controller only when needed
- domain/shared visual blocks in `src/components/shared`
- wire/data adapters in `src/lib` or route-local adapter modules
- FE types in `src/types`

If two routes need the same card/table/timeline pattern, move it out of the route immediately.

## Validation Checklist for the FE Lane

Before a frontend branch is considered ready for handoff, it must pass:

### Build Gate

```bash
pnpm --filter @agentic-room/web build
```

### Route Smoke Gate

Verify at minimum:

- `/`
- `/rooms`
- `/rooms/new`
- `/rooms/[roomId]`
- `/admin`
- `/docs`

### Responsive Gate

Check:

- mobile sidebar opens and closes
- desktop sidebar remains fixed
- KPI cards and room grid do not break at tablet widths
- forms remain usable on narrow screens

### Theme Gate

Check:

- dark and light theme both render with correct contrast
- theme toggle works without hydration issues
- glass cards remain legible in both themes

### UX Gate

Check:

- loading state uses skeleton or equivalent placeholder
- empty lists use `EmptyState`
- mutations show success and error toast
- status rendering uses `StatusBadge`
- token reveal uses `TokenText` rather than page-local implementations

## Definition of Done for FE Work

An FE task is only done when all of the following are true:

- it respects the existing shell and design system
- it reuses the current shared components where applicable
- it follows the integration boundary in [08-fe-be-integration-contract.md](08-fe-be-integration-contract.md)
- it builds successfully
- it does not silently redefine product rules in the UI

If a frontend agent needs to deviate from this contract, the document must be updated first. Code should not silently become the new design system.
