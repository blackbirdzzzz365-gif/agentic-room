# CP1 — Contracts, Schema & Ledger Foundation

**Code:** cp1-contracts-schema-ledger
**Order:** 1
**Depends On:** cp0-environment-bootstrap
**Estimated Effort:** 1 ngày

## Mục tiêu

Khóa product vocabulary vào code: contracts dùng chung, schema Postgres, append-only room ledger, và projection/replay skeleton. Sau CP này, repo phải có thể lưu authoritative room events thay vì chỉ CRUD mutable state.

## Artifacts dự kiến

| File/Path | Action | Mô tả |
|-----------|--------|-------|
| packages/contracts/src/* | created | room statuses, event types, DTOs |
| packages/db/schema/* | created | tables cho rooms, members, missions, charters, tasks, events |
| packages/ledger/src/* | created | append event, hash chain, replay primitives |
| apps/api/src/modules/room/* | created | command handlers skeleton cho room creation |
| packages/testkit/src/ledger/* | created | ledger fixtures / replay helpers |

## Checklist Validator

| ID | Mô tả | Blocker |
|----|-------|---------|
| CHECK-01 | schema migration tạo được bảng cốt lõi Phase 1 | ✓ |
| CHECK-02 | append room event tự tăng `seq` đúng theo room | ✓ |
| CHECK-03 | event có `prev_hash` và `hash` nhất quán | ✓ |
| CHECK-04 | replay skeleton rebuild được room snapshot đơn giản | ✓ |
| CHECK-05 | contracts package export được shared enums/types | ✓ |
| CHECK-06 | có test cho ledger append và replay baseline | ✓ |

