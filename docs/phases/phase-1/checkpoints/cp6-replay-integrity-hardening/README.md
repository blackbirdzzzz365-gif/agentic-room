# CP6 — Replay, Integrity & Pilot Hardening

**Code:** cp6-replay-integrity-hardening
**Order:** 6
**Depends On:** cp5-disputes-admin-ops
**Estimated Effort:** 1 ngày

## Mục tiêu

Chốt readiness cho pilot: replay toàn room từ ledger, integrity verification jobs, observability tối thiểu, staging scenario pack, và signed export/handoff health checks.

## Artifacts dự kiến

| File/Path | Action | Mô tả |
|-----------|--------|-------|
| packages/ledger/src/verify/* | created | verify seq continuity và hash chain |
| apps/worker/src/jobs/integrity-* | created | scheduled integrity jobs |
| packages/observability/src/* | created | metrics/logging wrappers |
| docs/runbooks/* | created | manual review / stuck room / dispute ops runbook |
| tests/e2e/phase1/* | created | end-to-end scenario pack |

## Checklist Validator

| ID | Mô tả | Blocker |
|----|-------|---------|
| CHECK-01 | replay rebuild được room snapshot end-to-end | ✓ |
| CHECK-02 | integrity verifier detect được broken sequence/hash | ✓ |
| CHECK-03 | scenario pack có happy path và failure paths chính | ✓ |
| CHECK-04 | signed allocation export health check chạy được | ✓ |
| CHECK-05 | observability có metrics/logs quan trọng | ✓ |
| CHECK-06 | runbook đủ cho manual review/stuck room/dispute escalation | ✓ |

