# CP5 — Disputes & Admin Operations

**Mục tiêu:** Hoàn tất operational safety net của Phase 1 trước pilot.
**Requires:** CP4 PASS

---

## Bước 0 — Đồng bộ trạng thái dashboard

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp5-disputes-admin-ops/status || true
```

## Bước 1 — Implement dispute intake

Implement:

- category / subtype validation
- cooling-off creation
- filing stake logic
- evidence reference validation

## Bước 2 — Implement panel workflow

Implement:

- assign panel members
- respondent reply window
- written ruling
- remedy application

## Bước 3 — Implement admin operations

Implement:

- list stuck rooms
- list active disputes
- manual review actions
- override commands with audit events

## Bước 4 — Worker jobs

Implement:

- cooling-off opener
- panel SLA timeout escalation
- dispute -> settlement adjustment follow-up if needed

## Bước 5 — Tests

- reject free-text dispute without evidence
- upheld delivery rejection contest
- rejected frivolous dispute
- panel timeout -> manual review
- override writes audit trail

## Bước 6 — Ghi kết quả và publish trạng thái

`result.json` phải ghi:

- artifacts thật đã thay đổi
- commands test đã chạy
- queues/admin surfaces đã thêm
- `next_cp`: `cp6-replay-integrity-hardening`

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp5-disputes-admin-ops \
  --role implementer \
  --status READY \
  --summary "CP5 complete. Disputes, panel workflow, và admin operations đã có baseline." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp5-disputes-admin-ops/result.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp5-disputes-admin-ops \
  --role implementer \
  --status READY \
  --summary "CP5 complete. Disputes, panel workflow, và admin operations đã có baseline." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp5-disputes-admin-ops/result.json
```
