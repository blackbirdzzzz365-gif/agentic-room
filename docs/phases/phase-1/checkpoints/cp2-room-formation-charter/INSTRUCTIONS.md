# CP2 — Room Formation & Charter

**Mục tiêu:** Hoàn tất toàn bộ formation contract trước khi room được phép active.
**Requires:** CP1 PASS

---

## Bước 0 — Đồng bộ trạng thái dashboard

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp2-room-formation-charter/status || true
```

## Bước 1 — Implement Mission Intake

Implement:

- create room
- mission draft generation adapter
- requester edit/confirm mission
- ledger events: `ROOM_CREATED`, `MISSION_CONFIRMED`

LLM chỉ là helper. Không được cho room tiến sang charter nếu requester chưa confirm.

## Bước 2 — Implement Membership Flow

Implement:

- invite member
- accept invite
- decline invite
- invitation window fail path

## Bước 3 — Implement Charter Flow

Implement:

- charter create/update
- mark ready
- sign
- decline
- expiry on timeout
- room activation on unanimous sign

## Bước 4 — Add UI/read models

Ít nhất phải có:

- room overview
- confirmed mission display
- member list
- charter draft / signing status

## Bước 5 — Test required scenarios

- happy path: room -> mission confirmed -> members active -> charter signed -> room active
- fail path: mission not confirmed
- fail path: charter unsigned agent timeout
- fail path: 3 charter rounds exhausted

## Bước 6 — Result handoff

`result.json` phải liệt kê:

- artifacts thật đã thêm/sửa
- commands đã chạy
- scenario coverage đã verify
- `next_cp`: `cp3-execution-review-loop`

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp2-room-formation-charter \
  --role implementer \
  --status READY \
  --summary "CP2 complete. Room formation và charter flow đã chạy end-to-end." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp2-room-formation-charter/result.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp2-room-formation-charter \
  --role implementer \
  --status READY \
  --summary "CP2 complete. Room formation và charter flow đã chạy end-to-end." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp2-room-formation-charter/result.json
```
