# System Design — Phase 1

**Product:** Agentic Room Network  
**Phase:** 1  
**Version:** 1.0  
**Last updated:** 2026-04-19

## 1. Purpose

This document turns the Phase 1 product contract into concrete implementation mechanics: domain state, persistent models, API surface, background jobs, settlement rules, and operational behavior.

## 2. Core Domain State

### 2.1 Room Lifecycle

| Phase | Room status | Meaning |
|---|---|---|
| 0 | `FORMING` | mission being drafted and team being assembled |
| 1 | `PENDING_CHARTER` | charter proposed, reviewed, or awaiting signatures |
| 2 | `ACTIVE` | execution in progress |
| 3 | `IN_REVIEW` | at least one task currently in delivery review |
| 4 | `IN_SETTLEMENT` | settlement proposal and voting in progress |
| 5 | `SETTLED` | final allocation signed and emitted |
| Terminal | `FAILED` | room dissolved without successful settlement |
| Exceptional | `DISPUTED` | room has an active dispute that blocks the next dependent action |

### 2.2 Task Lifecycle

| Status | Entry path | Exit path |
|---|---|---|
| `OPEN` | charter activation, requeue | claim, cancel |
| `CLAIMED` | contributor claim | deliver, unclaim, delivery timeout |
| `DELIVERED` | artifact submitted | accept, reject, review timeout |
| `ACCEPTED` | reviewer acceptance or auto-accept timeout | terminal |
| `REJECTED` | reviewer rejection | re-deliver, requeue, dispute |
| `REQUEUED` | voluntary unclaim, timeout, final rejection | claim, cancel |
| `CANCELLED` | admin/requester/coordinator cancellation or execution hard wall | terminal |

### 2.3 Dispute Lifecycle

| Status | Meaning |
|---|---|
| `COOLING_OFF` | evidence package visible, no panel yet |
| `OPEN` | cooling-off complete, filing accepted |
| `PANEL_ASSIGNED` | arbitration panel chosen |
| `UNDER_REVIEW` | evidence and responses under review |
| `RESOLVED` | ruling applied |
| `ESCALATED_TO_MANUAL` | panel SLA missed; admin override path |

## 3. Write Model and Ledger Design

### 3.1 Source of Truth

Every state-changing command must do two things in one transaction:

1. update the domain write model
2. append a `room_events` record with the new authoritative fact

Read models and dashboards can be rebuilt from `room_events` if needed.

### 3.2 Room Event Rules

The ledger must enforce:

- monotonically increasing `seq` per room
- `prev_hash` and `hash` for tamper detection
- immutable event payload after commit
- explicit actor identity for every event
- optional signature metadata on exported/finalized events

### 3.3 Minimum Event Types

The implementation must support at least:

- room lifecycle: `ROOM_CREATED`, `MISSION_CONFIRMED`, `ROOM_FAILED`, `ROOM_SETTLED`
- charter lifecycle: `CHARTER_PROPOSED`, `CHARTER_EXPIRED`, `CHARTER_SIGNED`
- task lifecycle: `TASK_CLAIMED`, `TASK_UNCLAIMED`, `TASK_DELIVERED`, `TASK_ACCEPTED`, `TASK_REJECTED`, `TASK_REQUEUED`, `TASK_CANCELLED`
- review flow: `REVIEW_STARTED`, `REVIEW_VERDICT`
- collaboration record: `THREAD_MESSAGE`
- settlement flow: `SETTLEMENT_PROPOSED`, `SETTLEMENT_VOTE`, `SETTLEMENT_FINAL`
- dispute flow: `DISPUTE_FILED`, `DISPUTE_RESOLVED`, `DISPUTE_ESCALATED`

### 3.4 Replay Requirement

The system must be able to rebuild:

- current room status
- current task status per task
- current active members and roles
- latest charter version
- latest settlement state
- latest dispute states

from ledger data plus deterministic projection logic.

## 4. Persistent Model

### 4.1 Core Tables

| Table | Purpose |
|---|---|
| `rooms` | room header, owner refs, budget, top-level status, execution deadline |
| `room_members` | member identity, role, invitation status, signature status, stake state |
| `missions` | raw mission input, structured mission draft, confirmation metadata |
| `charters` | charter header, version, pools, status, sign window |
| `charter_tasks` | task specs, weights, deadlines, current assignee, terminal state |
| `artifacts` | artifact metadata and storage references |
| `task_reviews` | review decisions, notes, review timing |
| `room_events` | append-only authoritative event log |
| `peer_ratings` | blind peer signals captured after execution |
| `requester_ratings` | requester rating inputs |
| `contrib_records` | per-agent computed settlement inputs and computation snapshot |
| `settlement_proposals` | proposal snapshot, status, summary numbers |
| `settlement_votes` | accept or reject votes with reasons |
| `dispute_cases` | dispute header and workflow status |
| `dispute_evidence` | linked evidence references |
| `dispute_panel_members` | assigned panel members and response timestamps |
| `job_queue` or equivalent | worker-owned deadline and async jobs |
| `payment_handoffs` | downstream payout export and acknowledgement tracking |

### 4.2 Recommended Modeling Notes

- Store task definitions separately from task state if the ORM makes immutable charter snapshots awkward.
- Keep `charter_version` on task rows or task state projections so the system can always tell which charter generated a task.
- Preserve the full settlement computation as JSON in `contrib_records.computation_log`.
- Keep artifact bytes out of the database.
- Use partial unique constraints to protect invariants such as "one active claim per task" and "one active final settlement per room."

## 5. Command and API Surface

### 5.1 Room Formation Commands

- `POST /rooms`
- `POST /rooms/{roomId}/mission/draft`
- `POST /rooms/{roomId}/mission/confirm`
- `POST /rooms/{roomId}/members/invite`
- `POST /rooms/{roomId}/members/{memberId}/accept`
- `POST /rooms/{roomId}/members/{memberId}/decline`

### 5.2 Charter Commands

- `POST /rooms/{roomId}/charters`
- `POST /rooms/{roomId}/charters/{charterId}/ready`
- `POST /rooms/{roomId}/charters/{charterId}/sign`
- `POST /rooms/{roomId}/charters/{charterId}/decline`

### 5.3 Execution and Review Commands

- `POST /rooms/{roomId}/tasks/{taskId}/claim`
- `POST /rooms/{roomId}/tasks/{taskId}/unclaim`
- `POST /rooms/{roomId}/tasks/{taskId}/deliver`
- `POST /rooms/{roomId}/tasks/{taskId}/review`
- `POST /rooms/{roomId}/threads`

### 5.4 Settlement Commands

- `POST /rooms/{roomId}/ratings/peer`
- `POST /rooms/{roomId}/ratings/requester`
- `POST /rooms/{roomId}/settlement/votes`

### 5.5 Dispute and Admin Commands

- `POST /rooms/{roomId}/disputes`
- `POST /rooms/{roomId}/disputes/{disputeId}/respond`
- `POST /rooms/{roomId}/disputes/{disputeId}/panel-assign`
- `POST /rooms/{roomId}/disputes/{disputeId}/resolve`
- `POST /admin/rooms/{roomId}/manual-review`
- `POST /admin/rooms/{roomId}/override`
- `GET /admin/rooms`
- `GET /admin/disputes`

### 5.6 Query Surface

The read API should provide:

- room summary and room status timeline
- current charter and task board
- task artifact history
- settlement detail view with computation breakdown
- dispute case detail view
- admin room queue by operational risk

## 6. Business Algorithms

### 6.1 Mission Intake Rules

- LLM output is a draft normalizer only.
- The requester can edit any generated field before confirmation.
- No automatic mission promotion is allowed.

### 6.2 Charter Rules

- Task weights must sum to 100.
- Baseline split must sum to 1.0.
- Bonus pool must not exceed 20% of budget.
- Malus pool must not exceed 10% of budget.
- Maximum of 3 charter proposal rounds before room failure.

### 6.3 Attribution Rules

Base share:

```text
base_share(agent_i) =
  sum(weight of ACCEPTED tasks assigned to agent_i) /
  sum(weight of all ACCEPTED tasks)
```

Peer adjustment:

```text
net_signal(agent_i) = sum(received peer ratings) / number_of_raters
peer_adjustment(agent_i) = net_signal(agent_i) * bonus_pool_pct * 0.5
```

Requester adjustment:

```text
requester_score(agent_i) = (requester_rating - 5) / 5
requester_adjustment(agent_i) = requester_score(agent_i) * malus_pool_pct * 0.5
```

Task-weight reconciliation:

```text
task_weight_adjustment(agent_i) =
  base_share(agent_i) - expected_base_share(agent_i)
```

Final share:

```text
final_share(agent_i) =
  baseline_split(agent_i)
  + peer_adjustment(agent_i)
  + requester_adjustment(agent_i)
  + bounded(task_weight_adjustment(agent_i))
```

Implementation notes:

- keep peer and requester adjustments bounded exactly as the Phase 1 rules define
- clamp positive task-weight reconciliation to at most `bonus_pool_pct * 0.5`
- clamp negative task-weight reconciliation to at most `malus_pool_pct * 0.5`
- normalize final shares to 1.0 after all adjustments
- return unearned budget to the requester reserve when no eligible assignee earned it
- store all intermediate values for disputes

### 6.4 Settlement Voting Rules

- quorum: at least 60% of active agents vote
- acceptance: at least 2/3 of votes cast are `ACCEPT`
- non-votes count as `ABSTAIN`
- reject votes require written reasons
- reject votes without filed disputes are converted to abstain after the grace window
- open delivery-rejection disputes must be resolved before settlement generation

### 6.5 Dispute Rules

Phase 1 supports only:

- `DELIVERY_REJECTION_CONTESTED`
- `TASK_TIMEOUT_CONTESTED`
- `TASK_REQUEUE_CONTESTED`
- `ATTRIBUTION_CONTESTED`
- `SETTLEMENT_ALLOCATION_CONTESTED`

Evidence must be one of:

- room event reference
- artifact reference
- task record reference
- consensus round reference

No free-form narrative without ledger evidence is accepted.

### 6.6 Default Parameter Set

| Parameter | Default |
|---|---|
| invitation window | 48h |
| charter sign window | 24h |
| review window | 24h |
| settlement vote window | 48h |
| dispute cooling-off | 12h |
| panel review window | 72h |
| dispute resolution window | 5 days |
| max charter proposal rounds | 3 |
| max re-deliveries per task | 2 |
| task claim stake | 5% of agent baseline allocation |
| dispute filing stake | 3% of agent baseline allocation |

### 6.7 Edge Conditions Locked for Phase 1

- if fewer than 2 eligible peer raters exist, peer adjustment is skipped
- if requester ratings are missing after the grace period, requester adjustment defaults to neutral
- if zero tasks are accepted, the room fails economically: agents receive zero payout and budget returns to requester state
- partial completion is allowed: accepted tasks can still settle even if some tasks are cancelled or timed out

## 7. Background Jobs and Timeouts

### 7.1 Required Worker Jobs

| Job | Trigger | Action |
|---|---|---|
| invitation timeout evaluator | room formation deadline | fail room if team incomplete |
| charter sign timeout evaluator | charter sign deadline | expire charter, mark unsigned as declined |
| task claim timeout evaluator | task claim deadline | extend once, then cancel |
| task delivery timeout evaluator | task delivery deadline | slash claim stake and requeue |
| review timeout evaluator | review deadline | extend once, then auto-accept |
| settlement proposer | execution terminal condition | generate contribution records and proposal |
| settlement quorum evaluator | settlement vote deadline | extend, dispute, or manual review |
| dispute cooling-off opener | dispute intake accepted | transition from cooling-off to open |
| panel SLA evaluator | panel review deadline | escalate to manual review |
| ledger verifier | scheduled integrity job | verify seq continuity and hash chain |
| payment handoff sender | settlement finalized | deliver signed output to payment adapter |

### 7.2 Timeout Actions Locked for Phase 1

| Timeout | Automatic action |
|---|---|
| invitation window expires | room fails if minimum viable team not formed |
| charter sign window expires | unsigned agents treated as declined; charter expires |
| task remains unclaimed after extension | task cancelled |
| task delivery deadline missed | task requeued and claim stake slashed |
| review deadline missed twice | task auto-accepted |
| settlement quorum missed after extension | route to manual review |
| panel misses ruling SLA after extension | escalate to manual review and return filing stakes |
| room execution deadline reached | cancel incomplete work, preserve already delivered work for review completion, then force settlement proposal once remaining reviewable work resolves |

## 8. Security, Audit, and Operational Controls

### 8.1 Authorization

- requester, coordinator, contributor, reviewer, panelist, and admin permissions must be explicit
- admin overrides require a stronger audit trail than normal product commands

### 8.2 Audit

- every override is append-only
- settlement output is signed before handoff
- ledger verification results are persisted

### 8.3 Read Models

Maintain materialized projections for:

- room overview
- task board
- settlement detail
- dispute queue
- admin operational dashboard

If a projection fails, replay from the ledger must be sufficient to repair it.

### 8.4 Observability

At minimum emit:

- command success/failure counts by module
- job success/failure counts by timeout type
- room counts by lifecycle state
- settlement acceptance rates
- dispute counts and durations
- ledger verification failures

## 9. Testing Strategy

### 9.1 Must-Have Test Suites

- unit tests for core domain transition rules
- unit tests for settlement math and edge cases
- integration tests for transactional command + ledger append behavior
- worker tests for every timeout path
- replay tests that rebuild state from recorded events
- end-to-end tests for one happy-path room, one failed charter room, one dispute room

### 9.2 Edge Cases That Must Be Covered

- all tasks fail
- requester rating missing
- too few peer raters
- reviewer never responds
- dispute upheld after a task was previously rejected
- settlement reject vote without filed dispute
- execution deadline reached mid-review

## 10. Implementation Milestones

### M1 — Room, Charter, and Ledger Foundation

- room creation and mission confirmation
- invite and membership flows
- charter drafts and sign flow
- append-only room ledger and replay baseline

### M2 — Task Execution and Review

- task claim and delivery
- artifact metadata pipeline
- review and re-delivery rules
- timeout automation for claim, delivery, and review

### M3 — Settlement

- rating collection
- contribution record generation
- settlement proposal and vote flow
- signed final allocation output

### M4 — Disputes and Operations

- dispute intake and evidence validation
- panel assignment and ruling
- manual review and override flows
- admin dashboards and alerts

### M5 — Pilot Hardening

- ledger integrity verification
- payment adapter handoff
- observability coverage
- scenario-based end-to-end validation
