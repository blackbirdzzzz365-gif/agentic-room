# CP3 — Task Execution & Review Loop

**Mục tiêu:** Làm cho room `ACTIVE` thực sự làm việc được, không chỉ có charter.
**Requires:** CP2 PASS

---

## Bước 0 — Đồng bộ trạng thái dashboard

```bash
curl -s http://localhost:3000/api/projects/agentic-room/phases/phase-1/checkpoints/cp3-execution-review-loop/status || true
```

## Bước 1 — Implement task ownership

Implement:

- `claim_task`
- `unclaim_task`
- stake effect
- conflict prevention khi 2 contributor claim cùng task

## Bước 2 — Implement artifact delivery

Implement:

- artifact metadata record
- content reference storage
- `TASK_DELIVERED` event

## Bước 3 — Implement review loop

Implement:

- assign reviewer
- accept / reject with spec-linked notes
- bounded re-delivery
- final rejection -> requeue/cancel

## Bước 4 — Implement worker jobs

Implement timeout jobs cho:

- task claim timeout
- task delivery timeout
- review timeout
- execution deadline

## Bước 5 — Add task/read-model UI

Tối thiểu phải có:

- task board theo status
- task detail với artifact history
- review action surface

## Bước 6 — Verify

Chạy integration suite cho:

- claim race
- reject -> re-deliver -> accept
- review timeout -> auto accept
- delivery timeout -> requeue

Ghi rõ command test thật đã chạy vào `result.json`.

```bash
python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/notify.py \
  --cp cp3-execution-review-loop \
  --role implementer \
  --status READY \
  --summary "CP3 complete. Task execution, delivery, review, và timeout loop đã hoạt động." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp3-execution-review-loop/result.json

python3 /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/post-status.py \
  --cp cp3-execution-review-loop \
  --role implementer \
  --status READY \
  --summary "CP3 complete. Task execution, delivery, review, và timeout loop đã hoạt động." \
  --result-file /Users/nguyenquocthong/project/agentic-room/docs/phases/phase-1/checkpoints/cp3-execution-review-loop/result.json
```
