# CP4 — Settlement Engine & Voting

**Mục tiêu:** Chốt economic loop của Phase 1 để sản phẩm có giá trị thật.
**Requires:** CP3 PASS

---

## Bước 0 — Đồng bộ trạng thái dashboard

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp4-settlement-voting/status || true
```

## Bước 1 — Implement ratings capture

Implement:

- peer signals
- requester ratings
- eligibility rules
- deadline windows

## Bước 2 — Implement settlement engine

Theo [04-system-design.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/04-system-design.md):

- base share
- peer adjustment
- requester adjustment
- task-weight reconciliation
- normalization
- computation log persistence

## Bước 3 — Implement settlement vote flow

Implement:

- publish proposal
- collect accept/reject
- quorum rule
- 2/3 accept rule
- reject-without-dispute grace handling
- manual review fallback trigger

## Bước 4 — Sign output và payout handoff skeleton

Implement:

- signer interface
- signed allocation payload
- payment handoff record

Không cần real payroll integration; chỉ cần handoff contract đáng tin cậy.

## Bước 5 — Test edge cases

- missing requester rating
- fewer than 2 peer raters
- zero accepted tasks
- reject vote without dispute
- accepted settlement finalization

`result.json` phải ghi rõ:

- commands test đã chạy
- signed output artifacts hoặc stub contracts tạo ra
- `next_cp`: `cp5-disputes-admin-ops`

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp4-settlement-voting \
  --role implementer \
  --status READY \
  --summary "CP4 complete. Settlement, voting, và signed output đã có baseline end-to-end." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp4-settlement-voting/result.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp4-settlement-voting \
  --role implementer \
  --status READY \
  --summary "CP4 complete. Settlement, voting, và signed output đã có baseline end-to-end." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp4-settlement-voting/result.json
```
