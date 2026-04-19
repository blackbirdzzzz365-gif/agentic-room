# CP6 Validation Checklist — Replay, Integrity & Pilot Hardening

**Dành cho:** Validator Agent
**Đọc trước:** `/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp6-replay-integrity-hardening/result.json`
**Mục tiêu:** Verify Phase 1 implementation thật sự sẵn sàng cho pilot chứ không chỉ pass ở mức feature demo.

---

## Bước 0 — Đọc trạng thái hiện tại

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp6-replay-integrity-hardening/status || true
```

## Danh sách kiểm tra

### CHECK-01: Replay end-to-end chạy được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "room replay e2e"
```

**Expected:** suite pass  
**Fail if:** room state không rebuild được từ ledger

### CHECK-02: Integrity verifier detect corruption

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "integrity verifier"
```

**Expected:** suite pass  
**Fail if:** broken chain vẫn không bị phát hiện

### CHECK-03: Scenario pack đủ breadth

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "happy path|charter fail|review timeout|dispute upheld|manual review" tests/e2e docs
```

**Expected:** đủ scenario chính  
**Fail if:** chỉ có happy path

### CHECK-04: Signed export health check chạy được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "signed export"
```

**Expected:** suite pass  
**Fail if:** final signed output không verify được

### CHECK-05: Observability baseline hiện diện

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "room state|timeout|dispute|settlement|ledger verification" packages/observability apps
```

**Expected:** metrics/log hooks hiện diện  
**Fail if:** pilot không có tín hiệu vận hành cơ bản

### CHECK-06: Runbooks tồn tại

```bash
cd /Users/nguyenquocthong/project/agentic-room && test -f docs/runbooks/manual-review.md && test -f docs/runbooks/stuck-room.md && test -f docs/runbooks/dispute-escalation.md
```

**Expected:** exit code `0`  
**Fail if:** ops chưa có tài liệu vận hành

**Blocker checks:** CHECK-01, CHECK-02, CHECK-03, CHECK-04, CHECK-05, CHECK-06  
**Warning checks:** none

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp6-replay-integrity-hardening \
  --role validator \
  --status PASS \
  --summary "CP6 pass. Phase 1 implementation đủ readiness cho staging/pilot." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp6-replay-integrity-hardening/validation.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp6-replay-integrity-hardening \
  --role validator \
  --status PASS \
  --summary "CP6 pass. Phase 1 implementation đủ readiness cho staging/pilot." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp6-replay-integrity-hardening/validation.json
```
