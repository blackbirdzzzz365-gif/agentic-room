# CP1 Validation Checklist — Contracts, Schema & Ledger Foundation

**Dành cho:** Validator Agent
**Đọc trước:** `/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp1-contracts-schema-ledger/result.json`
**Mục tiêu:** Verify product vocabulary, DB schema, và ledger primitives đã đủ làm nền cho domain flows.

---

## Bước 0 — Đọc trạng thái hiện tại

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp1-contracts-schema-ledger/status || true
```

## Danh sách kiểm tra

### CHECK-01: Migration tạo bảng cốt lõi được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm db:migrate
```

**Expected:** exit code `0`  
**Fail if:** thiếu bảng core hoặc migration fail

### CHECK-02: Ledger append tăng seq đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "ledger seq"
```

**Expected:** test pass  
**Fail if:** `seq` nhảy sai hoặc race logic chưa ổn

### CHECK-03: Hash chain đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "ledger hash"
```

**Expected:** test pass  
**Fail if:** `prev_hash`/`hash` không khớp

### CHECK-04: Replay baseline chạy được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "ledger replay"
```

**Expected:** test pass  
**Fail if:** replay không rebuild được room snapshot cơ bản

### CHECK-05: Shared contracts export được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm --filter @agentic-room/contracts build
```

**Expected:** exit code `0`  
**Fail if:** contracts package không build được

### CHECK-06: Có tests cho ledger baseline

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "ledger|replay|hash" packages tests apps
```

**Expected:** có test coverage baseline  
**Fail if:** chỉ có implementation mà chưa có test

## Ghi kết quả

`validation.json` phải set `next_cp` là `cp2-room-formation-charter`.

`validation.json` nên ghi rõ:

- verdict PASS/FAIL
- blocker checks fail nếu có
- warning checks nếu có
- commands thực tế đã chạy

**Blocker checks:** CHECK-01, CHECK-02, CHECK-03, CHECK-04, CHECK-05, CHECK-06  
**Warning checks:** none

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp1-contracts-schema-ledger \
  --role validator \
  --status PASS \
  --summary "CP1 pass. Contracts và ledger foundation đủ để bắt đầu room lifecycle." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp1-contracts-schema-ledger/validation.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp1-contracts-schema-ledger \
  --role validator \
  --status PASS \
  --summary "CP1 pass. Contracts và ledger foundation đủ để bắt đầu room lifecycle." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp1-contracts-schema-ledger/validation.json
```
