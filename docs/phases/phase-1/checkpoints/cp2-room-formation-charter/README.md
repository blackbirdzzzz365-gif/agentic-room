# CP2 — Room Formation & Charter

**Code:** cp2-room-formation-charter
**Order:** 2
**Depends On:** cp1-contracts-schema-ledger
**Estimated Effort:** 1 ngày

## Mục tiêu

Implement Phase 0 và Phase 1 của sản phẩm: room creation, mission draft/confirm, member invite/accept, charter proposal, sign/decline, expire, và room activation sau unanimous sign-off.

## Artifacts dự kiến

| File/Path | Action | Mô tả |
|-----------|--------|-------|
| apps/api/src/modules/mission/* | created | mission intake và confirmation |
| apps/api/src/modules/membership/* | created | invite/accept/decline flow |
| apps/api/src/modules/charter/* | created | charter draft/ready/sign/decline/expire |
| apps/web/src/routes/rooms/* | created | UI room formation cơ bản |
| packages/domain/src/room/* | created | room formation rules |

## Checklist Validator

| ID | Mô tả | Blocker |
|----|-------|---------|
| CHECK-01 | requester confirm mission trước khi sang charter | ✓ |
| CHECK-02 | invite flow chỉ cho allowlist participant join room | ✓ |
| CHECK-03 | charter sign cần unanimous, non-response xử lý đúng | ✓ |
| CHECK-04 | charter expire và room fail path hoạt động | ✓ |
| CHECK-05 | activation append đúng ledger events | ✓ |
| CHECK-06 | có integration tests cho happy path và fail path | ✓ |

