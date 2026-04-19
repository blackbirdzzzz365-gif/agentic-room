# Dispute Escalation Runbook

## Trigger

- panel not assigned in time
- panel assigned but ruling not delivered before SLA
- evidence conflict requires operator judgement

## Steps

1. Read dispute case, evidence refs, and latest room replay.
2. Confirm whether the dispute is still `COOLING_OFF`, `OPEN`, `PANEL_ASSIGNED`, or `ESCALATED_TO_MANUAL`.
3. If no panel exists, assign one through the API.
4. If panel missed SLA, mark the case for manual resolution via override and append a reason.
5. If the remedy affects tasks or settlement, re-run settlement proposal before finalization.
