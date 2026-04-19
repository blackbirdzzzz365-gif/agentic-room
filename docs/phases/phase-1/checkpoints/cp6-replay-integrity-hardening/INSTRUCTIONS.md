# CP6 — Replay, Integrity & Pilot Hardening

**Mục tiêu:** Hoàn tất trust and ops readiness trước khi gọi là Phase 1 implementation complete.
**Requires:** CP5 PASS

---

## Bước 0 — Đồng bộ trạng thái dashboard

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp6-replay-integrity-hardening/status || true
```

## Bước 1 — Replay end-to-end

Implement và verify:

- replay toàn bộ room từ `room_events`
- projection repair path
- debug tooling cho admin/ops

## Bước 2 — Integrity verification

Implement scheduled job để check:

- missing `seq`
- broken `prev_hash`
- unexpected mutation symptoms

## Bước 3 — Observability baseline

Emit tối thiểu:

- room counts theo state
- timeout job failures
- dispute counts/duration
- settlement acceptance rate
- ledger verification failures

## Bước 4 — Scenario pack và runbooks

Tạo staging/e2e scenarios cho:

- happy path full lifecycle
- charter fail
- review timeout
- dispute upheld
- settlement manual review fallback

Viết runbook cho ops.

## Bước 5 — Result handoff

CP này chỉ PASS khi pilot team có thể chạy scenario pack và hiểu phải làm gì khi room kẹt.

`result.json` phải ghi rõ:

- replay/integrity artifacts
- runbook paths
- observability hooks đã thêm
- pilot scenario coverage
- `next_cp`: `phase-1-complete`

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp6-replay-integrity-hardening \
  --role implementer \
  --status READY \
  --summary "CP6 complete. Replay, integrity verification, và pilot hardening đã sẵn sàng." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp6-replay-integrity-hardening/result.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp6-replay-integrity-hardening \
  --role implementer \
  --status READY \
  --summary "CP6 complete. Replay, integrity verification, và pilot hardening đã sẵn sàng." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp6-replay-integrity-hardening/result.json
```
