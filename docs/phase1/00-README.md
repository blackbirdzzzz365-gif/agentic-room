# Agentic Room Network — Phase 1 Implementation Package

**Version:** 2.0  
**Status:** Decisions locked for implementation  
**Last updated:** 2026-04-19

## Purpose

This folder is the implementation handoff for Phase 1 of Agentic Room Network. It translates the exploratory protocol work into a buildable package for a delivery team or implementation-focused coding agent.

This package answers five questions:

1. What business result Phase 1 must unlock.
2. Which product and protocol decisions are locked.
3. What the target architecture and system boundaries are.
4. Which user stories and acceptance criteria define "done."
5. How to organize the codebase and delivery workflow so the product can actually ship.

## Locked Phase 1 Decisions

- Phase 1 is for a **single organization or curated allowlist only**. Open federation is out of scope.
- A Room is a **bounded collaboration unit** with 2-12 participants and one committed budget.
- Mission intake uses an **LLM-assisted draft**, but the requester must explicitly confirm the final structured mission.
- Charter approval is **unanimous-or-expire**. No work starts without full sign-off.
- Attribution uses **locked task weights plus bounded peer/requester adjustments**. No causal graph in Phase 1.
- Settlement is **system-generated**, then approved by a **2/3 supermajority with 60% quorum**.
- Disputes are limited to **Operational** and **Economic** categories, resolved by a **single 3-person panel**.
- The protocol uses a **single authoritative append-only ledger** with hash chaining and signed outputs.
- Payment execution stays **outside the protocol**. Phase 1 produces the signed allocation map that the organization's payment rails consume.
- The implementation architecture is **modular monolith + background worker + web app**, not microservices.

## Package Contents

| # | Document | What it locks |
|---|---|---|
| 00 | [README](00-README.md) | Package intent, reading order, locked decisions |
| 01 | [BRD](01-brd.md) | Business result, scope, exit criteria, release gate |
| 02 | [User Stories](02-user-stories.md) | Actor goals, acceptance criteria, dependency map |
| 03 | [Solution Architecture](03-solution-architecture.md) | Runtime topology, module ownership, tech choices |
| 04 | [System Design](04-system-design.md) | Data model, state machines, APIs, jobs, algorithms |
| 05 | [Development Organization](05-development-organization.md) | Repo shape, implementation sequence, delivery operating model |
| 06 | [Current Codebase Baseline](06-current-codebase-baseline.md) | What the current codebase actually delivers today for local testing |
| CP | [Implementation Checkpoints](../phases/phase-1/checkpoints/README.md) | Step-by-step execution plan for implementation agents |

## Recommended Reading Order

1. Read [01-brd.md](01-brd.md) to understand the product contract.
2. Read [02-user-stories.md](02-user-stories.md) to understand actor-facing behavior.
3. Read [03-solution-architecture.md](03-solution-architecture.md) to understand the runtime shape.
4. Read [04-system-design.md](04-system-design.md) to understand exact implementation mechanics.
5. Read [05-development-organization.md](05-development-organization.md) to understand repo structure, sequencing, and delivery checkpoints.
6. Read [06-current-codebase-baseline.md](06-current-codebase-baseline.md) if you need the current runtime truth instead of the original target design.
7. Execute [the checkpoint breakdown](../phases/phase-1/checkpoints/README.md) in order if you are building the product.

## Source Lineage

This package was derived from the following documents:

- [`../../phase1-spec.md`](../../phase1-spec.md): detailed protocol semantics and edge cases
- [`../../agentic-room-analysis.md`](../../agentic-room-analysis.md): critique of the original over-ambitious design
- [`../../agentic-room-feedback.md`](../../agentic-room-feedback.md): rationale for Phase 1 simplifications

These historical files remain useful as context, but **this folder is the implementation source of truth for Phase 1**.

## What an Implementation Agent Should Build

By the end of Phase 1, the system must support the full lifecycle:

`Mission Intake -> Charter Agreement -> Task Execution -> Delivery Review -> Settlement -> Dispute Resolution -> Signed Allocation Output`

The implementation package assumes the delivery team will produce:

- a role-aware web application for requesters, contributors, reviewers, panelists, and admins
- a protocol API and worker runtime
- a Postgres-backed append-only room ledger
- an artifact store
- a KMS-backed signing path
- an external payment adapter contract
- observability, audit, and manual-resolution flows

## Hard Non-Goals

Do not add the following into Phase 1 unless this package is explicitly revised:

- open federation
- cross-org trust and policy resolution
- public reputation system
- causal attribution graph
- appeal tree for disputes
- collaboration-mode variants
- on-chain settlement
- real-time presence or market-style agent discovery

## Change Rule

If a team wants to change Phase 1 scope or protocol behavior, they must first update the relevant document in this folder. Code should not silently redefine product rules.
