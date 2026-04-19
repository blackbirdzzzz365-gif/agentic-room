# CP5 Validation Checklist — Disputes & Admin Operations

**Dành cho:** Validator Agent
**Đọc trước:** `/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp5-disputes-admin-ops/result.json`
**Mục tiêu:** Verify system có thể xử lý disagreement mà không cần sửa DB bằng tay.

---

## Bước 0 — Đọc trạng thái hiện tại

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp5-disputes-admin-ops/status || true
```

## Danh sách kiểm tra

### CHECK-01: Filing validation đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "dispute filing validation"
```

**Expected:** suite pass  
**Fail if:** free-text/no-evidence dispute vẫn được open

### CHECK-02: Cooling-off và panel flow đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "dispute lifecycle"
```

**Expected:** suite pass  
**Fail if:** state machine dispute sai

### CHECK-03: Remedy application đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "dispute remedy"
```

**Expected:** suite pass  
**Fail if:** upheld dispute không update room state đúng

### CHECK-04: Admin override có audit trail

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "admin override audit"
```

**Expected:** suite pass  
**Fail if:** override mutate state nhưng không append event

### CHECK-05: SLA timeout escalate đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "panel timeout escalation"
```

**Expected:** suite pass  
**Fail if:** dispute kẹt vô thời hạn

### CHECK-06: Admin queues có dữ liệu vận hành

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "manual review|stuck room|active dispute|override" apps/web apps/api
```

**Expected:** admin query/UI paths hiện diện  
**Fail if:** ops không nhìn thấy nơi cần can thiệp

**Blocker checks:** CHECK-01..CHECK-06  
**Warning checks:** none

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp5-disputes-admin-ops \
  --role validator \
  --status PASS \
  --summary "CP5 pass. Dispute và admin safety net đã đủ cho pilot prep." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp5-disputes-admin-ops/validation.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp5-disputes-admin-ops \
  --role validator \
  --status PASS \
  --summary "CP5 pass. Dispute và admin safety net đã đủ cho pilot prep." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp5-disputes-admin-ops/validation.json
```
