# CP4 Validation Checklist — Settlement Engine & Voting

**Dành cho:** Validator Agent
**Đọc trước:** `/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp4-settlement-voting/result.json`
**Mục tiêu:** Verify room có thể chuyển từ execution sang economic conclusion đúng luật.

---

## Bước 0 — Đọc trạng thái hiện tại

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp4-settlement-voting/status || true
```

## Danh sách kiểm tra

### CHECK-01: Settlement math đúng baseline

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "settlement math"
```

**Expected:** suite pass  
**Fail if:** proposal lệch với rules đã khóa

### CHECK-02: Computation log được persist

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "computation log"
```

**Expected:** suite pass  
**Fail if:** dispute không có evidence snapshot

### CHECK-03: Vote quorum/supermajority enforced

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "settlement vote"
```

**Expected:** suite pass  
**Fail if:** proposal finalize sai quorum

### CHECK-04: Reject-without-dispute handled

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "reject without dispute"
```

**Expected:** suite pass  
**Fail if:** reject vote vô căn cứ vẫn block settlement mãi

### CHECK-05: Signed output sinh ra được

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "signed allocation"
```

**Expected:** suite pass  
**Fail if:** final allocation chưa có signature payload

### CHECK-06: Edge cases coverage

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "missing ratings|zero accepted tasks|peer raters"
```

**Expected:** suite pass  
**Fail if:** edge case logic chưa định nghĩa

**Blocker checks:** CHECK-01..CHECK-06  
**Warning checks:** none

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp4-settlement-voting \
  --role validator \
  --status PASS \
  --summary "CP4 pass. Economic loop đã có thể verify và finalize đúng luật." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp4-settlement-voting/validation.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp4-settlement-voting \
  --role validator \
  --status PASS \
  --summary "CP4 pass. Economic loop đã có thể verify và finalize đúng luật." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp4-settlement-voting/validation.json
```
