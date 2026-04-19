# CP2 Validation Checklist — Room Formation & Charter

**Dành cho:** Validator Agent
**Đọc trước:** `/Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp2-room-formation-charter/result.json`
**Mục tiêu:** Verify no room can start work without a confirmed mission and unanimously signed charter.

---

## Bước 0 — Đọc trạng thái hiện tại

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp2-room-formation-charter/status || true
```

## Danh sách kiểm tra

### CHECK-01: Mission phải confirm trước charter

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "mission confirm gate"
```

**Expected:** test pass  
**Fail if:** charter flow mở dù mission chưa confirmed

### CHECK-02: Invite/allowlist enforcement đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "membership allowlist"
```

**Expected:** test pass  
**Fail if:** non-invited member join được room

### CHECK-03: Unanimous sign enforced

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "charter unanimous"
```

**Expected:** test pass  
**Fail if:** room active khi chưa đủ sign

### CHECK-04: Expiry/failure path đúng

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "charter expiry"
```

**Expected:** test pass  
**Fail if:** unsigned/declined flow không expire đúng

### CHECK-05: Ledger events đủ

```bash
cd /Users/nguyenquocthong/project/agentic-room && rg "ROOM_CREATED|MISSION_CONFIRMED|CHARTER_PROPOSED|CHARTER_SIGNED|CHARTER_EXPIRED" apps packages
```

**Expected:** event handling và append logic hiện diện  
**Fail if:** state đổi nhưng thiếu ledger event tương ứng

### CHECK-06: Integration happy/fail paths có coverage

```bash
cd /Users/nguyenquocthong/project/agentic-room && pnpm test -- --runInBand "room formation|charter"
```

**Expected:** suite pass  
**Fail if:** thiếu coverage formation contract

**Blocker checks:** CHECK-01..CHECK-06  
**Warning checks:** none

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp2-room-formation-charter \
  --role validator \
  --status PASS \
  --summary "CP2 pass. Room formation contract đã khóa đúng theo Phase 1 docs." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp2-room-formation-charter/validation.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp2-room-formation-charter \
  --role validator \
  --status PASS \
  --summary "CP2 pass. Room formation contract đã khóa đúng theo Phase 1 docs." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp2-room-formation-charter/validation.json
```
