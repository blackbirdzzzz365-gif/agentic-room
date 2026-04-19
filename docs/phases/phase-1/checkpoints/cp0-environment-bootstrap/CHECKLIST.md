# CP0 Validation Checklist — Environment & Repo Bootstrap

**Dành cho:** Validator Agent
**Đọc trước:** `/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp0-environment-bootstrap/result.json`
**Mục tiêu:** Verify workspace nền và local stack đúng với Phase 1 architecture.

---

## Bước 0 — Báo bắt đầu validate (bắt buộc, chạy trước tiên)

```bash
curl -s -X POST "http://localhost:3000/api/projects/agentic-room/checkpoints/cp0-environment-bootstrap/status" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "validator",
    "status": "VALIDATING",
    "summary": "Bắt đầu validate CP0 — Environment & Repo Bootstrap",
    "readyForNextTrigger": false
  }' || true
```

## Danh sách kiểm tra

### CHECK-01: Workspace install được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm install --frozen-lockfile=false
```

**Expected:** command exit code `0`  
**Fail if:** dependency resolution fail

### CHECK-02: Workspace build được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm -r build
```

**Expected:** command exit code `0`  
**Fail if:** package shell nào đó chưa compile được

### CHECK-03: Docker local stack chạy được

```bash
cd /Users/nguyenquocthong/project/agentic-room && docker compose -f infra/docker/docker-compose.yml up -d
```

**Expected:** services start thành công  
**Fail if:** db hoặc storage service không boot được

### CHECK-04: Repo shape đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && test -d apps/web && test -d apps/api && test -d apps/worker && test -d packages/contracts && test -d packages/domain && test -d infra/docker
```

**Expected:** exit code `0`  
**Fail if:** thiếu thư mục quan trọng

### CHECK-05: Env example đủ baseline

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "DATABASE_URL|OBJECT_STORAGE|SIGNER|LLM" .env.example
```

**Expected:** có các nhóm biến chính  
**Fail if:** thiếu db hoặc signer hoặc llm config

### CHECK-06: Root README có local boot instructions

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "pnpm install|docker compose|apps/web|apps/api|apps/worker" README.md
```

**Expected:** có hướng dẫn local run  
**Fail if:** implementer phải tự đoán cách boot repo

## Ghi kết quả

Tạo `validation.json`:

```json
{
  "cp": "cp0-environment-bootstrap",
  "role": "validator",
  "status": "PASS | FAIL | PARTIAL",
  "timestamp": "<ISO8601>",
  "summary": "<1-2 câu>",
  "checks": [],
  "issues": [],
  "ready_for_next_cp": true,
  "next_cp": "cp1-contracts-schema-ledger"
}
```

**Status rules:**
- `PASS`: CHECK-01..CHECK-05 pass
- `PARTIAL`: chỉ CHECK-06 fail
- `FAIL`: bất kỳ blocker check nào fail

**Blocker checks:** CHECK-01, CHECK-02, CHECK-03, CHECK-04, CHECK-05  
**Warning checks:** CHECK-06

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp0-environment-bootstrap \
  --role validator \
  --status PASS \
  --summary "CP0 pass. Workspace nền đủ để bắt đầu implement domain." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp0-environment-bootstrap/validation.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp0-environment-bootstrap/validation.json
```
