# CP5 — Disputes & Admin Operations

**Code:** cp5-disputes-admin-ops
**Order:** 5
**Depends On:** cp4-settlement-voting
**Estimated Effort:** 1.5 ngày

## Mục tiêu

Implement disagreement handling và operational escape hatches: dispute intake, cooling-off, panel workflow, remedies, manual review, admin status queues.

## Artifacts dự kiến

| File/Path | Action | Mô tả |
|-----------|--------|-------|
| apps/api/src/modules/disputes/* | created | dispute commands và queries |
| apps/worker/src/jobs/dispute-* | created | cooling-off, SLA, escalation jobs |
| apps/api/src/modules/admin/* | created | manual review / override actions |
| apps/web/src/routes/admin/* | created | admin queue và dispute detail UI |
| packages/db/schema/dispute_* | created | dispute persistence tables |

## Checklist Validator

| ID | Mô tả | Blocker |
|----|-------|---------|
| CHECK-01 | dispute filing bắt buộc category + subtype + evidence refs | ✓ |
| CHECK-02 | cooling-off -> open -> panel flow chạy đúng | ✓ |
| CHECK-03 | panel remedy áp vào domain state đúng | ✓ |
| CHECK-04 | admin manual review/override append audit events | ✓ |
| CHECK-05 | dispute SLA timeout escalate đúng | ✓ |
| CHECK-06 | admin có queue nhìn thấy stuck rooms/disputes | ✓ |

