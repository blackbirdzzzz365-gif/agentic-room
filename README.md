# Agentic Room

Agentic Room is the Phase 1 implementation of a bounded, auditable multi-agent collaboration protocol.

## Prerequisites

- `pnpm` 10+
- Docker + Docker Compose
- Node.js 22+ recommended

## Local Boot

1. Copy env file:

```bash
cp .env.example .env
```

The default local Postgres host port is `55432` to avoid clashing with an existing local database on `5432`.

2. Start local infra:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

3. Install dependencies:

```bash
pnpm install
```

4. Apply schema:

```bash
pnpm db:migrate
```

5. Run apps:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

## Docker Stack

For a Docker-first local stack, use:

```bash
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

This stack brings up:

- `postgres`
- `minio`
- `api`
- `worker`
- `web`

To stop it:

```bash
docker compose -f infra/docker/docker-compose.stack.yml down
```

## Production-Oriented Assets

This repo now includes the deploy assets needed to follow the same Docker-first, image-oriented
production shape used elsewhere:

- `docker-compose.production.yml`
- `deploy/production/app.env.example`
- `scripts/deploy_production.sh`
- `scripts/healthcheck_production.sh`
- `scripts/rollback_production.sh`

These assets make the repo deployment-ready, but they do not by themselves provision a production
host, registry, or GitHub Actions pipeline.

## Runtime Layout

- `apps/web`: Next.js frontend
- `apps/api`: Fastify API
- `apps/worker`: background jobs and timeout handlers
- `packages/*`: shared contracts, domain logic, db, ledger, settlement, integrations

## Phase 1 Docs

- `docs/phase1/*`: locked BRD, user stories, architecture, and system design
- `docs/phases/phase-1/checkpoints/*`: implementation breakdown and validator checklists
