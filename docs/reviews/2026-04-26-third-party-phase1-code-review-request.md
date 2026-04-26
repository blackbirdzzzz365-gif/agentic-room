# Third-Party Code Review Request — Agentic Room Phase 1

## Purpose

We are requesting an independent technical review of the Agentic Room Phase 1 implementation before handoff or merge. The review should verify that the implementation matches the locked Phase 1 product/system contracts, is safe to run in a local Docker-based environment, and does not contain hidden FE/BE contract drift, authorization gaps, settlement lifecycle defects, or integrity/replay inconsistencies.

The reviewer should approach this as a release-readiness review, not a general style review. Findings should focus on correctness, security, data integrity, runtime behavior, contract compatibility, and test coverage.

## Review Target

Repository:

```text
/Users/nguyenquocthong/project/agentic-room
```

Current working branch at the time this request was prepared:

```text
codex/fe-phase1-integration
```

Expected Phase 1 review target:

```text
Current working tree / final Phase 1 integration branch provided by the repository owner.
```

If the repository owner provides a specific commit SHA or pull request, review that exact revision and mention the reviewed revision in your report.

## Required Background Documents

Please read these documents before reviewing code:

```text
docs/phase1/00-README.md
docs/phase1/04-system-design.md
docs/phase1/06-current-codebase-baseline.md
docs/phase1/07-fe-implementation-contract.md
docs/phase1/08-fe-be-integration-contract.md
docs/phases/phase-1/lanes/README.md
docs/phases/phase-1/lanes/be-brief.md
docs/phases/phase-1/lanes/fe-brief.md
docs/reviews/2026-04-19-codebase-review.md
docs/reviews/2026-04-21-use-case-coverage-feynman.md
```

The implementation should be judged against these documents, with `docs/phase1/08-fe-be-integration-contract.md` treated as the canonical FE/BE HTTP contract for Phase 1.

## Code Review Scope

Review all Phase 1 backend and frontend integration paths, especially:

```text
apps/api/**
apps/worker/**
apps/web/**
packages/auth/**
packages/contracts/**
packages/db/**
packages/domain/**
packages/ledger/**
packages/settlement/**
docs/phase1/**
docs/phases/phase-1/lanes/**
infra/docker/**
```

Pay special attention to:

- API boundary behavior and actor identity injection.
- FE mutation behavior through the same-origin proxy.
- Contract schemas in `packages/contracts`.
- Domain lifecycle transitions in `packages/domain`.
- Settlement calculations in `packages/settlement`.
- Database migration alignment in `packages/db`.
- Replay/integrity verification in `packages/ledger` and `packages/domain`.
- Docker/runtime configuration in `infra/docker/docker-compose.stack.yml`.

## Out Of Scope

The following are not primary review objectives unless they directly affect Phase 1 correctness or release readiness:

- Visual design polish beyond functional FE/BE integration.
- Large-scale architecture rewrites.
- Production-grade identity provider integration.
- Real payment provider integration.
- Performance optimization unrelated to correctness or data integrity.

## Critical Product And Technical Expectations

### 1. FE/BE HTTP Contract

The frontend must send business payloads only. It must not send or depend on `actorId` or `actorRole` in request bodies.

All browser-side mutations must go through:

```text
/api-proxy/*
```

The browser must never directly set `x-api-key`.

The Next.js proxy is responsible for attaching `x-api-key` using a server-side secret:

```text
AGENT_API_KEY
```

The API validates the key against:

```text
AGENT_API_KEYS
```

Any remaining direct browser mutation to the API, browser-visible secret, or FE-owned actor injection should be treated as a high-severity finding.

### 2. Actor Injection And Authorization

The API must derive actor identity from `x-api-key`, strip spoofed body fields, and inject the authenticated actor before calling domain services.

Please verify that authorization is enforced for at least:

- Room creation and requester/coordinator behavior.
- Mission draft and confirmation.
- Member invitation, acceptance, and decline.
- Charter creation, signing, and decline.
- Task claim, unclaim, delivery, and review.
- Peer rating and requester rating.
- Settlement proposal and voting.
- Dispute filing, panel assignment, and resolution.
- Admin override and due job execution.

Reviewer should explicitly check that self-review, unauthorized task review, unauthorized requester rating, self-rating, and out-of-room actions are rejected.

### 3. Charter Contract

The canonical Phase 1 charter economics fields are:

```text
bonusPoolPct
malusPoolPct
```

The old `discretionaryPoolPct` field must not be emitted by the new FE payload or canonical API snapshot contract. A legacy read fallback is acceptable only inside adapters if it does not leak into the current view model or outgoing payloads.

Please verify:

- `packages/contracts` validates `bonusPoolPct` and `malusPoolPct`.
- `packages/domain` persists and snapshots the same fields.
- `apps/web` creates charter payloads using the same fields.
- `docs/phase1/08-fe-be-integration-contract.md` matches code behavior.

### 4. Settlement Lifecycle And Economics

Please verify that settlement behavior matches the Phase 1 design:

- Settlement proposal is generated from persisted room/charter/task/rating truth.
- Accepted work, baseline split, bonus pool, malus pool, peer ratings, and requester ratings are applied consistently.
- Proposal generation is idempotent where documented.
- Quorum and accept-ratio voting rules are correct.
- Timeout fallback finalizes or escalates correctly instead of leaving rooms stuck.
- Economic outputs are deterministic and auditable.
- Settlement signatures or computation logs align with persisted state.

Any mismatch between documented economics, contract schema, and runtime calculation should be reported as high severity.

### 5. Deadlines, Timeouts, And Worker Jobs

Please verify the full timeout/deadline chain:

- Charter signing timeout.
- Invitation timeout.
- Task claim timeout.
- Delivery timeout.
- Review timeout.
- Execution deadline.
- Settlement voting timeout.
- Dispute lifecycle timeout.

The worker should process due jobs safely and idempotently. Deadline handling must not silently skip economic consequences, settlement generation, or failure transitions.

### 6. Replay And Integrity

Replay and integrity checks should compare against persisted truth, not reconstructed assumptions that can drift from the database.

Please verify:

- Event replay uses stable event ordering.
- Persisted room state, charter state, task state, ratings, settlement, and disputes are reflected correctly.
- Integrity verification catches meaningful drift.
- Admin integrity endpoints expose useful results without mutating state unexpectedly.

### 7. Frontend Runtime Integration

Please verify the frontend can perform the Phase 1 lifecycle using the documented API contract:

- Create room.
- Draft and confirm mission.
- Invite/accept/decline members.
- Create/sign/decline charter.
- Claim/unclaim/deliver/review tasks.
- Submit peer/requester ratings.
- Propose/vote settlement.
- File and inspect disputes.
- Inspect admin metrics, jobs, rooms, disputes, and integrity.

The FE should normalize backend envelopes through adapters instead of leaking raw API shapes into components.

## Recommended Validation Commands

Run these from the repository root:

```bash
pnpm test
pnpm build
docker compose -f infra/docker/docker-compose.stack.yml config
docker compose -f infra/docker/docker-compose.stack.yml up -d --build
```

If Docker is available, also run basic smoke checks after the stack starts:

```bash
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/api/rooms
curl -fsS http://localhost:3000/
```

Current local validation status when this request was prepared:

- `pnpm test`: passed.
- `pnpm build`: passed.
- `docker compose -f infra/docker/docker-compose.stack.yml config`: passed.
- `docker compose -f infra/docker/docker-compose.stack.yml up -d --build`: not completed locally because the Docker daemon was not running.
- `pnpm lint`: currently blocked by the deprecated `next lint` interactive setup prompt in `apps/web`; this should be treated as a tooling gap, not as evidence that lint passed.

Please rerun all commands in your own environment and report exact outputs for any failure.

## Expected Review Method

Use both static and runtime review:

- Compare docs against contracts, domain code, DB schema, FE adapters, and FE payloads.
- Trace each Phase 1 use case from UI action to API route to domain service to persisted data/event.
- Attempt negative authorization cases, not only happy paths.
- Inspect tests and identify which critical behaviors are not covered.
- Prefer concrete reproduction steps and file/line references over broad comments.
- Do not assume author intent. If code and docs disagree, report the disagreement explicitly.

## Deliverable Format

Please provide the review as a Markdown report with these sections:

```text
# Independent Phase 1 Code Review

## Reviewed Revision

Repository, branch, commit SHA, and date reviewed.

## Executive Summary

Release-readiness assessment in 3-7 bullets.

## Validation Results

Commands run, pass/fail result, and relevant output excerpts.

## Findings

Findings ordered by severity.

## Contract Drift

Explicit list of any FE/BE/doc/schema mismatches.

## Missing Regression Coverage

Critical cases not covered by automated tests.

## Open Questions

Questions that must be answered before release.

## Release Recommendation

One of: approve, approve with minor fixes, block release.
```

Each finding should use this format:

```text
### [P0/P1/P2/P3] Short title

Files:
- path/to/file.ts:line
- path/to/other-file.ts:line

Problem:
Clear description of the defect or risk.

Impact:
What can break, who is affected, and why it matters.

Reproduction:
Exact steps, command, test, or request that demonstrates the issue.

Recommendation:
Concrete fix direction.

Regression Test:
Suggested automated test that would prevent recurrence.
```

## Severity Rubric

Use this severity scale:

- `P0`: Release blocker. Data corruption, security bypass, broken core lifecycle, or cannot run the product.
- `P1`: High-risk correctness issue. Core Phase 1 behavior is wrong, under-tested, or materially inconsistent with docs.
- `P2`: Medium-risk issue. Important edge case, poor error handling, runtime fragility, or contract ambiguity.
- `P3`: Low-risk issue. Maintainability, clarity, or minor UX/tooling issue.

## Specific Questions For The Reviewer

Please answer these explicitly:

1. Does the implementation satisfy the locked FE/BE contract without requiring FE to send actor identity?
2. Are review and rating authorization rules sufficient to prevent self-review and economic manipulation?
3. Can settlement reach a final or documented fallback state under quorum failure and timeout scenarios?
4. Are execution deadline and delivery timeout economics applied consistently?
5. Does replay/integrity verification compare against persisted truth strongly enough to catch drift?
6. Are all critical Phase 1 use cases covered by regression tests?
7. Does Docker stack configuration contain all runtime environment variables needed for FE/API mutation flows?
8. Are there any undocumented contract semantics that FE or BE currently depends on?

## Notes For Reviewer Independence

Please treat this review as independent verification. The implementation has already had internal passes, but the goal of this review is to find remaining release-blocking gaps. Do not optimize for confirming prior conclusions. If evidence is ambiguous, report the ambiguity and the exact additional check needed to resolve it.
