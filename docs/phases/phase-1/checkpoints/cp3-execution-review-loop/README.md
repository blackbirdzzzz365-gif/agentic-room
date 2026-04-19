# CP3 — Task Execution & Review Loop

**Code:** cp3-execution-review-loop
**Order:** 3
**Depends On:** cp2-room-formation-charter
**Estimated Effort:** 1.5 ngày

## Mục tiêu

Implement execution core: claim/unclaim, artifact delivery, task review, re-delivery, task threads, và timeout jobs cho claim/delivery/review/execution deadline.

## Artifacts dự kiến

| File/Path | Action | Mô tả |
|-----------|--------|-------|
| apps/api/src/modules/tasks/* | created | claim, unclaim, deliver commands |
| apps/api/src/modules/review/* | created | review verdict và re-delivery rules |
| apps/worker/src/jobs/task-* | created | claim/delivery/review timeout jobs |
| packages/db/schema/task_* | created | task/review/artifact state mở rộng |
| apps/web/src/routes/tasks/* | created | task board và review UI |

## Checklist Validator

| ID | Mô tả | Blocker |
|----|-------|---------|
| CHECK-01 | task claim exclusivity đúng | ✓ |
| CHECK-02 | delivery chỉ cho assignee hợp lệ | ✓ |
| CHECK-03 | review/reject/re-deliver flow đúng giới hạn | ✓ |
| CHECK-04 | review timeout auto-accept sau extension | ✓ |
| CHECK-05 | execution deadline force settlement entry path có logic | ✓ |
| CHECK-06 | task/review events được append đầy đủ | ✓ |

