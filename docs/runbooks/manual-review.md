# Manual Review Runbook

## When to use

- settlement vote timed out into `MANUAL_REVIEW`
- dispute panel missed SLA
- operator needs to confirm a room cannot progress automatically

## Steps

1. Open `/api/admin/rooms` and identify the target room.
2. Fetch `/api/admin/rooms/{roomId}/replay` and `/api/admin/rooms/{roomId}/integrity`.
3. Check latest charter, latest settlement proposal, and active disputes.
4. Decide whether to:
   - finalize settlement manually
   - escalate dispute to manual resolution
   - cancel or fail remaining tasks
5. Record the action through `POST /api/admin/rooms/{roomId}/override` so an audit event is appended.

## Never do

- direct SQL status edits without an override event
- changing task weights or baseline split after charter sign-off
