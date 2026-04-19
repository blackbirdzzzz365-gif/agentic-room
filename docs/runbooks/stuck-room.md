# Stuck Room Runbook

## Signals

- room status remains `IN_REVIEW`, `IN_SETTLEMENT`, or `DISPUTED` beyond SLA
- pending job queue grows for the same room
- execution deadline has passed but room did not move forward

## Steps

1. Check `/api/admin/jobs` for overdue `review_timeout`, `charter_sign_timeout`, `dispute_*`, or `settlement_vote_timeout` jobs.
2. Run the worker sweep once.
3. Replay the room and inspect the last 10 events.
4. If automation failed but integrity is intact, use manual override with reason.
5. If integrity failed, stop the room and escalate before further mutation.
