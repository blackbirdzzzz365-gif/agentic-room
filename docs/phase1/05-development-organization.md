# Development Organization — Phase 1

**Product:** Agentic Room Network  
**Phase:** 1  
**Version:** 1.0  
**Last updated:** 2026-04-19

## 1. Goal

This document explains how to organize the implementation work so a delivery team or implementation agent can build Phase 1 without guessing repository shape, ownership boundaries, or milestone order.

## 2. Recommended Repository Shape

Use a TypeScript monorepo with one shared contract language across frontend, API, worker, and tests.

```text
agentic-room/
  apps/
    web/                  # requester, contributor, reviewer, panel, admin UI
    api/                  # synchronous command/query API
    worker/               # timeouts, settlement, disputes, notifications, exports
  packages/
    domain/               # pure domain rules and state transitions
    contracts/            # API schemas, event schemas, DTOs, signature payloads
    db/                   # schema, migrations, repositories, query helpers
    settlement/           # contribution and settlement calculations
    ledger/               # event append, replay, integrity verification
    integrations/         # llm, signer, notifications, payment adapter
    auth/                 # identity, role, permission utilities
    ui/                   # shared UI primitives
    observability/        # logging, metrics, tracing wrappers
    testkit/              # fixtures, factories, replay helpers, e2e helpers
  docs/
    phase1/               # locked product and architecture docs
    phases/
      phase-1/
        checkpoints/      # implementation checkpoint system
  infra/
    docker/
    migrations/
    seed/
```

## 3. Module Dependency Rules

- `domain` depends on nothing application-specific.
- `settlement` can depend on `domain` and `contracts`, not on the web layer.
- `ledger` is a platform package used by both `api` and `worker`.
- `integrations` implement ports defined by `domain` or application services.
- `web` talks only to public API contracts, not directly to the database.
- `worker` runs use cases through the same application service layer as `api` where feasible.

## 3.1 Toolchain Baseline

- package manager: `pnpm`
- frontend: `Next.js`
- api: `Fastify`
- worker jobs: Postgres-backed queue
- schema validation: shared runtime schemas
- db access: typed SQL layer with migrations checked into repo
- test stack: unit + integration + end-to-end in the same language

## 4. Delivery Team Lanes

For a 2-4 engineer team, assign lanes instead of microservice ownership:

| Lane | Owns | Primary outputs |
|---|---|---|
| Product Protocol | room lifecycle, charter, task, review, disputes | domain rules, API commands, projections |
| Trust and Computation | settlement, ledger, signatures, replay, audit | settlement engine, ledger verifier, signed outputs |
| Experience and Ops | web UI, admin console, notifications, operational dashboards | room views, settlement UX, dispute UX, admin tooling |

One engineer can cover more than one lane, but ownership must still be explicit per milestone.

## 5. Recommended Implementation Order

### Step 1 — Contracts and Domain Skeleton

Build first:

- room statuses
- task statuses
- event types
- core command contracts
- table schema skeleton

Reason: everything else depends on the product vocabulary being stable.

### Step 2 — Ledger and Replay

Implement:

- append-only event writer
- per-room sequencing
- hash chaining
- replay projection helpers

Reason: Phase 1 trust model fails if later work is built on mutable-only state.

### Step 3 — Room Formation and Charter

Implement:

- mission draft and confirmation
- membership invite/accept flow
- charter proposal, readiness, sign/decline flow

Reason: this locks the contract that execution depends on.

### Step 4 — Task, Artifact, and Review Loop

Implement:

- claim/unclaim
- artifact delivery
- review and re-delivery
- task/read-model views

Reason: this is the core workflow users feel first.

### Step 5 — Timeouts and Worker Automation

Implement:

- delivery timeout
- review timeout
- execution deadline handling
- job claiming and retry rules

Reason: a room product without deadline automation becomes an operator spreadsheet.

### Step 6 — Settlement and Signed Output

Implement:

- peer and requester rating capture
- contribution record generation
- settlement proposal and voting
- signer integration and payment handoff

### Step 7 — Disputes and Admin Operations

Implement:

- dispute intake and cooling-off
- panel assignment and ruling
- manual review paths
- admin queues and override actions

### Step 8 — Pilot Hardening

Implement:

- observability
- integrity verification jobs
- seed data and test scenarios
- operator runbooks

## 6. Checkpoints for an Implementation Agent

The implementation agent should work checkpoint by checkpoint, not file by file:

| Checkpoint | Build goal | Done when |
|---|---|---|
| CP0 | environment bootstrap | the repo, local infra, and app shells are ready for domain work |
| CP1 | contracts, schema, and ledger | authoritative event storage and replay primitives exist |
| CP2 | room formation and charter | a room can be created, confirmed, invited, and charter-signed |
| CP3 | task execution loop | a task can be claimed, delivered, reviewed, and timeout correctly |
| CP4 | settlement | the room can produce a voted and signed allocation result |
| CP5 | disputes and admin | disagreements and stuck states can be resolved without database surgery |
| CP6 | hardening | replay, alerts, integrity checks, and pilot readiness are proven |

The detailed checkpoint package now lives at [docs/phases/phase-1/checkpoints/README.md](/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/README.md).

## 6.1 Detailed Checkpoint Breakdown

### CP0 — Environment & Repo Bootstrap

- Purpose: create the TypeScript monorepo, local Docker stack, env baseline, and root runbook.
- Outputs: workspace packages, app shells, local infra, root README.
- Why first: no domain work should start while the repo and runtime contract are still unstable.

### CP1 — Contracts, Schema & Ledger Foundation

- Purpose: lock the shared product vocabulary and authoritative storage model.
- Outputs: contracts package, schema/migrations, ledger append and replay primitives.
- Validation focus: event sequencing, hash chain, replay.

### CP2 — Room Formation & Charter

- Purpose: implement Mission Intake and Charter Agreement end to end.
- Outputs: room creation, membership flow, charter sign/decline/expire, activation path.
- Validation focus: unanimous sign gate and failure paths.

### CP3 — Task Execution & Review Loop

- Purpose: implement the working room once it becomes active.
- Outputs: task claim/deliver/review/re-deliver, timeouts, task board read models.
- Validation focus: task ownership, review rules, automatic timeout actions.

### CP4 — Settlement Engine & Voting

- Purpose: implement the economic loop that makes the product meaningful.
- Outputs: ratings capture, contribution records, settlement proposal, vote flow, signed output.
- Validation focus: deterministic math, computation logs, quorum/supermajority rules.

### CP5 — Disputes & Admin Operations

- Purpose: provide the controlled disagreement path and operational escape hatches.
- Outputs: dispute intake, panel flow, remedies, manual review, admin queues.
- Validation focus: evidence-bound disputes, audit-safe overrides, SLA escalation.

### CP6 — Replay, Integrity & Pilot Hardening

- Purpose: finish trust and operations readiness before pilot.
- Outputs: replay verification, integrity jobs, scenario pack, observability, runbooks.
- Validation focus: recoverability, corruption detection, pilot-operable system.

## 7. Definition of Done

A Phase 1 slice is done only when:

- the domain rule is implemented
- the rule writes the correct ledger event
- the read model updates correctly
- the worker or timeout path is covered if relevant
- at least one automated test proves the happy path
- at least one automated test proves the failure or timeout path

## 8. Working Rules for Agents and Engineers

- Do not implement features that change room economics without updating the docs package first.
- Do not bypass the ledger for convenience writes.
- Do not put business rules only in the UI.
- Do not let background jobs mutate state without writing domain events.
- Do not introduce microservices during Phase 1 unless there is a documented operational failure that the modular monolith cannot handle.

## 9. Handoff Contract for the Next Implementation Agent

The next implementation-focused agent should treat this package as the starting contract and proceed in this order:

1. Generate or align database schema and shared contracts from [04-system-design.md](04-system-design.md).
2. Implement the domain modules described in [03-solution-architecture.md](03-solution-architecture.md).
3. Build features in the milestone order defined in this document.
4. Verify each story in [02-user-stories.md](02-user-stories.md) with tests before moving to pilot hardening.

## 10. What Not To Optimize Yet

- federation abstraction
- public reputation mechanics
- causal evidence attribution
- generic workflow framework
- marketplace onboarding
- real-time presence

Phase 1 wins by being correct, inspectable, and shippable, not by being theoretically complete.
