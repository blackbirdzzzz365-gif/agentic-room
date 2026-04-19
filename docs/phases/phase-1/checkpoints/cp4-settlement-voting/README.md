# CP4 — Settlement Engine & Voting

**Code:** cp4-settlement-voting
**Order:** 4
**Depends On:** cp3-execution-review-loop
**Estimated Effort:** 1.5 ngày

## Mục tiêu

Implement toàn bộ economic loop của Phase 1: peer/requester ratings, contribution records, deterministic settlement proposal, voting, signing, và payout handoff skeleton.

## Artifacts dự kiến

| File/Path | Action | Mô tả |
|-----------|--------|-------|
| packages/settlement/src/* | created | attribution và settlement calculations |
| apps/api/src/modules/settlement/* | created | ratings, proposal, votes, finalization |
| apps/worker/src/jobs/settlement-* | created | settlement generation và vote timeout jobs |
| packages/integrations/src/signer/* | created | signer abstraction |
| packages/integrations/src/payment/* | created | payment handoff adapter skeleton |

## Checklist Validator

| ID | Mô tả | Blocker |
|----|-------|---------|
| CHECK-01 | settlement proposal tính từ accepted tasks + adjustments | ✓ |
| CHECK-02 | computation log được persist | ✓ |
| CHECK-03 | quorum và 2/3 accept enforced đúng | ✓ |
| CHECK-04 | reject-without-dispute path xử lý đúng | ✓ |
| CHECK-05 | signed final allocation output sinh ra được | ✓ |
| CHECK-06 | edge cases: missing ratings, zero accepted tasks, peer-rater thiếu | ✓ |

