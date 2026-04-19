# CP0 — Environment & Repo Bootstrap

**Mục tiêu:** Dựng workspace nền cho Phase 1 để các CP sau chỉ tập trung vào domain logic.
**Requires:** Phase docs đã khóa trong `docs/phase1/`

---

## Bước 0 — Báo bắt đầu (bắt buộc, chạy trước tiên)

```bash
curl -s -X POST "http://localhost:3000/api/projects/agentic-room/checkpoints/cp0-environment-bootstrap/status" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "implementer",
    "status": "IN_PROGRESS",
    "summary": "Bắt đầu implement CP0 — Environment & Repo Bootstrap",
    "readyForNextTrigger": false
  }' || true
```

Nếu dashboard local không chạy, bỏ qua và tiếp tục implementation bình thường.

## Bước 1 — Tạo monorepo skeleton

Tạo các thư mục và package nền theo đúng shape trong [05-development-organization.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/05-development-organization.md):

```text
apps/web
apps/api
apps/worker
packages/contracts
packages/domain
packages/db
packages/ledger
packages/settlement
packages/integrations
packages/auth
packages/ui
packages/observability
packages/testkit
infra/docker
```

## Bước 2 — Thiết lập toolchain

- dùng `pnpm` làm package manager
- cấu hình TypeScript base config ở root
- tạo scripts tối thiểu: `build`, `lint`, `test`, `dev:web`, `dev:api`, `dev:worker`
- tạo `package.json`, `pnpm-workspace.yaml`, và `tsconfig.base.json` ở root

## Bước 3 — Dựng local infrastructure

Tạo `infra/docker/docker-compose.yml` cho tối thiểu:

- Postgres
- object storage compatible service hoặc mock phù hợp

Không cần production-hardening ở CP này; chỉ cần local stack chạy được.

## Bước 4 — Viết hướng dẫn local run

Cập nhật root `README.md` với:

- prerequisites
- `pnpm install`
- copy `.env.example`
- `docker compose` boot
- cách chạy web/api/worker

## Bước 5 — Verify local baseline

```bash
cd /Users/nguyenquocthong/project/agentic-room
pnpm install
pnpm -r build
docker compose -f infra/docker/docker-compose.yml up -d
```

## Bước 6 — Viết `result.json` và gửi notification

Tạo `result.json`:

```json
{
  "cp": "cp0-environment-bootstrap",
  "role": "implementer",
  "status": "READY",
  "timestamp": "<ISO8601>",
  "summary": "Monorepo TypeScript, local infra, và app shells đã sẵn sàng cho implementation.",
  "artifacts": [
    {"file": "package.json", "action": "created"},
    {"file": "pnpm-workspace.yaml", "action": "created"},
    {"file": "infra/docker/docker-compose.yml", "action": "created"},
    {"file": ".env.example", "action": "created"},
    {"file": "README.md", "action": "updated"}
  ],
  "issues": [],
  "notes": "CP này chưa chứa business logic."
}
```

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp0-environment-bootstrap \
  --role implementer \
  --status READY \
  --summary "CP0 complete. Workspace, Docker stack, và app shells đã chạy được." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp0-environment-bootstrap/result.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp0-environment-bootstrap/result.json
```
