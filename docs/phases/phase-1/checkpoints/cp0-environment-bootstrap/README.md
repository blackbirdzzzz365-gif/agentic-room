# CP0 — Environment & Repo Bootstrap

**Code:** cp0-environment-bootstrap
**Order:** 0
**Depends On:** —
**Estimated Effort:** 0.5 ngày

## Mục tiêu

Khởi tạo monorepo TypeScript theo shape đã chốt cho Phase 1, dựng Docker/dev environment, và verify team có thể chạy web, api, worker, database, object storage giả lập trước khi đụng business logic.

## Artifacts dự kiến

| File/Path | Action | Mô tả |
|-----------|--------|-------|
| package.json | created | workspace root scripts và tooling |
| pnpm-workspace.yaml | created | khai báo monorepo workspaces |
| apps/web/package.json | created | frontend app shell |
| apps/api/package.json | created | api runtime shell |
| apps/worker/package.json | created | worker runtime shell |
| packages/contracts/package.json | created | shared contracts package |
| packages/domain/package.json | created | pure domain package |
| packages/db/package.json | created | db package |
| infra/docker/docker-compose.yml | created | local stack cho db và phụ trợ |
| .env.example | created | env vars baseline cho local/dev |
| README.md | updated | cách chạy local stack |

## Checklist Validator

| ID | Mô tả | Blocker |
|----|-------|---------|
| CHECK-01 | `pnpm install` chạy thành công ở workspace root | ✓ |
| CHECK-02 | `pnpm -r build` chạy được với shells tối thiểu | ✓ |
| CHECK-03 | `docker compose -f infra/docker/docker-compose.yml up -d` khởi động được stack local | ✓ |
| CHECK-04 | `apps/web`, `apps/api`, `apps/worker`, `packages/*` tồn tại đúng shape đã chốt | ✓ |
| CHECK-05 | `.env.example` có đủ biến tối thiểu cho db, storage, signer, llm | ✓ |
| CHECK-06 | README root mô tả được cách boot local stack | |

