# CP3 Validation Checklist — Task Execution & Review Loop

**Dành cho:** Validator Agent
**Đọc trước:** `/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp3-execution-review-loop/result.json`
**Mục tiêu:** Verify execution loop đã có ownership, review, và timeout automation đúng spec.

---

## Bước 0 — Đọc trạng thái hiện tại

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp3-execution-review-loop/status || true
```

## Danh sách kiểm tra

### CHECK-01: Claim exclusivity đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "task claim race"
```

**Expected:** test pass  
**Fail if:** cùng task được claim trùng

### CHECK-02: Delivery ownership đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "task delivery ownership"
```

**Expected:** test pass  
**Fail if:** non-assignee deliver được task

### CHECK-03: Review and redelivery flow đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "review redelivery"
```

**Expected:** test pass  
**Fail if:** reject/accept/redelivery không theo giới hạn

### CHECK-04: Review timeout auto-accept

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "review timeout"
```

**Expected:** test pass  
**Fail if:** task bị treo do reviewer im lặng

### CHECK-05: Execution deadline path có automation

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "execution deadline"
```

**Expected:** test pass  
**Fail if:** room không chuyển được sang settlement khi hard wall chạm

### CHECK-06: Ledger events đầy đủ

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "TASK_CLAIMED|TASK_UNCLAIMED|TASK_DELIVERED|TASK_ACCEPTED|TASK_REJECTED|TASK_REQUEUED" apps packages
```

**Expected:** event append logic hiện diện  
**Fail if:** mutable state update không đi qua ledger

**Blocker checks:** CHECK-01..CHECK-06  
**Warning checks:** none

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp3-execution-review-loop \
  --role validator \
  --status PASS \
  --summary "CP3 pass. Execution loop đã đáp ứng Phase 1 core workflow." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp3-execution-review-loop/validation.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp3-execution-review-loop \
  --role validator \
  --status PASS \
  --summary "CP3 pass. Execution loop đã đáp ứng Phase 1 core workflow." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp3-execution-review-loop/validation.json
```
