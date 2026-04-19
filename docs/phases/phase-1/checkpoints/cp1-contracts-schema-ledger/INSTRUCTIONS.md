# CP1 — Contracts, Schema & Ledger Foundation

**Mục tiêu:** Biến vocabulary của Phase 1 thành contracts, schema, và ledger primitives có thể thi hành.
**Requires:** CP0 PASS

---

## Bước 0 — Đồng bộ trạng thái dashboard

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp1-contracts-schema-ledger/status || true
```

Nếu dashboard đang tắt, tiếp tục làm việc bình thường và đẩy trạng thái ở cuối checkpoint.

## Bước 1 — Tạo shared contracts

Từ [04-system-design.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/04-system-design.md), tạo các enums/types tối thiểu:

- room status
- task status
- dispute status
- room event types
- command/query payload schemas

Ưu tiên đặt contract ở shared package để API, web, worker, và testkit cùng dùng một vocabulary.

## Bước 2 — Tạo DB schema cốt lõi

Thiết kế migration cho các bảng:

- `rooms`
- `room_members`
- `missions`
- `charters`
- `charter_tasks`
- `artifacts`
- `room_events`

Nếu chưa cần full dispute/settlement tables ở checkpoint này thì ghi rõ deferred scope trong `result.json`, nhưng `room_events` là blocker.

## Bước 3 — Tạo ledger primitives

Implement các primitive:

- lấy next `seq` theo room
- tính `prev_hash` và `hash`
- append event trong cùng transaction với domain write
- replay danh sách event để build room snapshot cơ bản

Mọi mutation room-level phải có đường đi qua append-event contract, không mutate state thuần rồi vá ledger sau.

## Bước 4 — Tạo tests baseline

Ít nhất cần:

- append 2 event liên tiếp trong cùng room
- append event ở 2 room khác nhau
- replay room từ event list

Ưu tiên có cả unit test cho hash/seq và integration test cho append + replay.

## Bước 5 — Verify local baseline

```bash
cd /Users/nguyenquocthong/project/agentic-room
pnpm test -- --runInBand ledger
pnpm build
```

Nếu có script/schema specific command khác, ghi lại đúng command đã chạy trong `result.json`.

## Bước 6 — Ghi kết quả và publish trạng thái

`result.json` phải nêu tối thiểu:

- artifact paths thật đã thêm/sửa
- commands đã chạy
- blockers còn lại nếu có
- `next_cp`: `cp2-room-formation-charter`

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp1-contracts-schema-ledger \
  --role implementer \
  --status READY \
  --summary "CP1 complete. Contracts, schema, và ledger primitives đã có baseline chạy được." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp1-contracts-schema-ledger/result.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp1-contracts-schema-ledger \
  --role implementer \
  --status READY \
  --summary "CP1 complete. Contracts, schema, và ledger primitives đã có baseline chạy được." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp1-contracts-schema-ledger/result.json
```
