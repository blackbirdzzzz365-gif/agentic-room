# Phase 1 Current Codebase Baseline

## Purpose

This document freezes **what the current codebase actually delivers today** for local Phase 1 testing.

It is intentionally narrower than the original Phase 1 ambition documents. If this file conflicts with earlier design docs, treat this file as the **current runtime baseline** until the implementation is revised.

Baseline date: `2026-04-19`

## Current Runtime Shape

The current local stack runs as a Docker-based modular monolith:

- `web` on port `3000`
- `api` on port `4000`
- `worker` polling background jobs
- `postgres` on port `55432`
- `minio` on ports `9000` and `9001`

Current UI note:

- the web app is currently a **read-oriented shell** for rooms and admin views
- most mutation and workflow testing still happens through the API

## What Is Working Now

### Room Lifecycle

The codebase currently supports:

- room creation
- mission draft and mission confirm
- member invite / accept / decline
- charter creation, signature, decline, expiry
- room activation after all active members sign

### Execution Lifecycle

The codebase currently supports:

- task claim / unclaim
- task delivery
- task review accept / reject
- task re-delivery
- worker-driven timeout handling for delivery review and some dispute flows

### Settlement and Dispute Lifecycle

The codebase currently supports:

- peer ratings
- requester ratings
- settlement proposal generation
- settlement voting
- signed payment handoff payload generation
- dispute filing
- panel assignment
- dispute resolution

### Admin and Audit

The codebase currently exposes:

- room listing
- room snapshot with events, projection, and verification
- job listing
- dispute listing
- metrics
- integrity verification
- manual status override

## Known Gaps Accepted In This Baseline

These are known limitations in the current codebase and should be treated as accepted for the current local test baseline, not as resolved behavior:

- charter economic fields are not fully aligned across docs, schema, and runtime naming
- settlement math does not fully implement the richer Phase 1 contribution formula described in the original design docs
- rating and review authorization still need tightening
- settlement timeout / quorum fallback is incomplete
- some timeout behaviors still differ from the earlier design package
- replay output around disputes may diverge from persisted room state in some cases

For the detailed issue list, see:

- [`../reviews/2026-04-19-codebase-review.md`](../reviews/2026-04-19-codebase-review.md)

## Local Test Endpoints

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- API meta: `http://localhost:4000/api/meta`
- Room list: `http://localhost:4000/api/rooms`
- Admin page: `http://localhost:3000/admin`
- Rooms page: `http://localhost:3000/rooms`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Current Local Deploy Command

Run from repo root:

```bash
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

Stop without deleting data:

```bash
docker compose -f infra/docker/docker-compose.stack.yml down
```

Stop and delete local Docker volumes:

```bash
docker compose -f infra/docker/docker-compose.stack.yml down -v
```

## Current Smoke-Test Result

Verified on `2026-04-19`:

- Docker stack builds successfully
- API returns `200` on `/health`
- API returns room data on `/api/rooms`
- Web returns `200` on `/`

## Local Test Room Created

To give QA a clean entry point without deleting old volumes, one room was created on the running local stack:

- Room name: `Phase 1 Local Test`
- Room id: `e9539c98-70ed-4957-b488-bd02b2faea7d`
- Snapshot endpoint:
  - `http://localhost:4000/api/rooms/e9539c98-70ed-4957-b488-bd02b2faea7d`

This room starts at:

- status: `FORMING`
- phase: `0`

## Practical Interpretation

For the current local test cycle, Phase 1 should be treated as:

- **deployable locally**
- **navigable through web and API**
- **sufficient for manual flow testing**
- **not yet semantically final against every earlier Phase 1 document**

The next implementation phase should improve correctness without redefining this baseline silently.
