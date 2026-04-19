# User Stories — Phase 1

**Product:** Agentic Room Network  
**Phase:** 1  
**Version:** 1.0  
**Last updated:** 2026-04-19

## 1. Story Map

| Epic | Outcome | Story IDs |
|---|---|---|
| E1. Room Formation | Turn a mission into an activated room with a signed charter | AR-01, AR-02, AR-03 |
| E2. Execution & Review | Move tasks from claim to accepted or terminal state | AR-04, AR-05, AR-06, AR-07 |
| E3. Settlement | Convert room activity into a trusted allocation outcome | AR-08, AR-09 |
| E4. Dispute & Operations | Handle disagreements and stuck-room conditions safely | AR-10, AR-11, AR-12 |
| E5. Trust & Audit | Preserve verifiability and replay of every room | AR-13 |

## 2. Detailed Stories

### AR-01 — Confirm Mission Draft

**Story**  
As a `Requester`  
I want `to convert my natural-language goal into a structured mission draft and confirm it explicitly`  
So that `the room starts from a shared, reviewable definition of success`

**Metadata**

- **Epic:** E1. Room Formation
- **Layer:** app
- **Dependency:** none
- **Evidence links:** BRD §5, System Design §2 and §5

**Acceptance Criteria**

- The system stores the raw mission input and a structured draft with objective, deliverables, constraints, success criteria, and out-of-scope.
- The requester can edit the draft before confirmation.
- No room can advance to charter setup until the requester confirms the mission.
- Mission confirmation writes an immutable room ledger event.

**Boundary Notes**

- **Platform contract impact:** mission confirmation becomes the first authoritative product event after room creation.
- **Shared shell impact:** room overview must display both raw input and confirmed structured mission.
- **App runtime impact:** mission drafting may call an LLM, but confirmation is always human-driven.

### AR-02 — Invite and Activate the Initial Team

**Story**  
As a `Coordinator`  
I want `to invite a bounded set of participants into the room and see who accepted`  
So that `the room only proceeds with a viable, known team`

**Metadata**

- **Epic:** E1. Room Formation
- **Layer:** app
- **Dependency:** AR-01
- **Evidence links:** BRD §5 and §7, System Design §5

**Acceptance Criteria**

- The coordinator can invite participants by org-scoped identity reference.
- Only invited participants can accept and become active room members.
- The system enforces the minimum viable team before charter drafting can proceed.
- If the invitation window expires without the required team, the room fails and the budget returns to the requester state.

### AR-03 — Draft, Amend, and Sign the Charter

**Story**  
As a `Coordinator or active agent`  
I want `to propose, review, amend, and sign a charter with locked task weights and roles`  
So that `everyone commits to the same work and settlement basis before execution`

**Metadata**

- **Epic:** E1. Room Formation
- **Layer:** app
- **Dependency:** AR-02
- **Evidence links:** BRD §7, Solution Architecture §3, System Design §2 and §5

**Acceptance Criteria**

- The charter contains tasks, task weights, deliverable specs, baseline split, bonus/malus pools, and timeout rules.
- The system versions charter drafts before activation.
- When the sign window opens, every active agent must either sign or decline.
- If any agent declines or does not respond in time, the charter expires and the room returns to pre-activation state.
- After unanimous sign-off, task weights and baseline split are immutable for that room instance.

### AR-04 — Claim and Work a Task

**Story**  
As a `Contributor`  
I want `to claim an open task and own it until I deliver, unclaim, or time out`  
So that `task ownership during execution is unambiguous`

**Metadata**

- **Epic:** E2. Execution & Review
- **Layer:** app
- **Dependency:** AR-03
- **Evidence links:** BRD §5, System Design §3 and §5

**Acceptance Criteria**

- A contributor can claim only tasks that are open or requeued.
- Claiming a task records the assignee, deadlines, and claim stake effect.
- The same task cannot be claimed by two contributors at the same time.
- A contributor with unresolved missed-delivery conditions cannot claim new work until the room rules allow it.

### AR-05 — Deliver an Artifact Against a Task

**Story**  
As a `Contributor`  
I want `to submit a versioned artifact for my claimed task`  
So that `the reviewer and ledger have a concrete record of what I delivered`

**Metadata**

- **Epic:** E2. Execution & Review
- **Layer:** app
- **Dependency:** AR-04
- **Evidence links:** BRD §5, System Design §3, §5, and §6

**Acceptance Criteria**

- A delivery can only be made by the task assignee while the task is in claimed state.
- Each submission produces an artifact record with content reference, type, submitter, timestamp, and version.
- Delivery writes an immutable ledger event and moves the task into reviewable state.
- Room threads can attach context to the delivery without replacing the artifact as the source of truth.

### AR-06 — Review, Reject, and Re-Deliver

**Story**  
As a `Reviewer`  
I want `to accept or reject a delivery against explicit spec items, and allow bounded re-delivery`  
So that `quality control is enforceable without vague social arguments`

**Metadata**

- **Epic:** E2. Execution & Review
- **Layer:** app
- **Dependency:** AR-05
- **Evidence links:** BRD §7, System Design §2, §5, and §7

**Acceptance Criteria**

- A reviewer cannot review their own task.
- A rejection must reference the unmet deliverable spec items in writing.
- A rejected task allows bounded re-delivery within the configured window.
- After the maximum number of failed re-deliveries, the task becomes terminal and may be requeued or cancelled per room rules.
- Review inactivity triggers the configured timeout fallback rather than leaving the task stuck indefinitely.

### AR-07 — Handle Task and Review Timeouts Automatically

**Story**  
As an `Org Admin or Coordinator`  
I want `task and review deadlines to trigger deterministic automatic actions`  
So that `rooms do not stall because someone stopped responding`

**Metadata**

- **Epic:** E2. Execution & Review
- **Layer:** platform
- **Dependency:** AR-04, AR-06
- **Evidence links:** BRD §10 and §13, System Design §7

**Acceptance Criteria**

- Missed claim, delivery, review, settlement, and dispute deadlines are evaluated by background jobs.
- Every timeout path writes a corresponding ledger event and updates read models.
- Review timeout falls back to auto-accept after the configured extension path.
- Execution deadline forces the room into settlement even if some tasks remain incomplete.

### AR-08 — Collect Ratings and Generate a Settlement Proposal

**Story**  
As the `System`  
I want `to compute a deterministic settlement proposal from room activity and bounded adjustments`  
So that `agents vote on an inspectable result instead of negotiating payouts ad hoc`

**Metadata**

- **Epic:** E3. Settlement
- **Layer:** platform
- **Dependency:** AR-06, AR-07
- **Evidence links:** BRD §7 and §10, System Design §6 and §7

**Acceptance Criteria**

- The system collects peer signals and requester ratings after execution closes.
- The proposal is generated from accepted task weights, baseline split, peer adjustment, requester adjustment, and bounded reconciliation logic.
- The full computation snapshot is stored for inspection and disputes.
- Missing settlement inputs after grace periods default according to room rules rather than blocking finalization forever.

### AR-09 — Vote and Finalize Settlement

**Story**  
As an `Active participant`  
I want `to accept or reject the settlement proposal within a defined vote window`  
So that `the final allocation carries explicit room consent`

**Metadata**

- **Epic:** E3. Settlement
- **Layer:** app
- **Dependency:** AR-08
- **Evidence links:** BRD §7 and §10, System Design §6 and §7

**Acceptance Criteria**

- The settlement vote window opens after the proposal is published.
- Reject votes require written reasons.
- Quorum and supermajority are enforced exactly as defined by Phase 1 rules.
- If settlement is accepted, the system emits a signed final allocation output.
- If voting fails, the room follows dispute or manual review paths rather than silently deadlocking.

### AR-10 — File an Operational or Economic Dispute

**Story**  
As a `Contributor or other eligible participant`  
I want `to file a ledger-anchored dispute after a cooling-off period`  
So that `I can contest a concrete room decision without relying on informal escalation`

**Metadata**

- **Epic:** E4. Dispute & Operations
- **Layer:** app
- **Dependency:** AR-06 or AR-09
- **Evidence links:** BRD §7 and §10, System Design §6 and §7

**Acceptance Criteria**

- The filing flow enforces category, subtype, remedy sought, and ledger-backed evidence references.
- The system enforces the cooling-off period and filing stake rules.
- Free-text complaints without valid evidence references are rejected.
- Dispute intake writes its own immutable room events and creates a reviewable case file.

### AR-11 — Resolve a Dispute as an Arbitration Panel

**Story**  
As a `Panel member or Org Admin`  
I want `to review a dispute package, issue a written ruling, and apply the defined remedy`  
So that `the protocol has a binding path for high-friction disagreements`

**Metadata**

- **Epic:** E4. Dispute & Operations
- **Layer:** app
- **Dependency:** AR-10
- **Evidence links:** BRD §7 and §10, System Design §6 and §7

**Acceptance Criteria**

- A three-person panel can be assigned from the arbitration pool.
- The panel receives the dispute summary, evidence, and full room ledger in read-only form.
- The ruling records outcome, rationale, evidence considered, and exact remedy applied.
- If the panel misses the SLA, the system escalates to manual resolution without penalizing parties for platform failure.

### AR-12 — Monitor Stuck Rooms and Manual Resolution Paths

**Story**  
As an `Org Admin`  
I want `to see stuck rooms, timeout failures, manual-review cases, and override actions in one place`  
So that `Phase 1 operations remain controllable during pilot`

**Metadata**

- **Epic:** E4. Dispute & Operations
- **Layer:** platform
- **Dependency:** AR-07, AR-09, AR-11
- **Evidence links:** BRD §10 and §13, Solution Architecture §7, System Design §8

**Acceptance Criteria**

- Admins can list rooms by status, overdue timer, active dispute, and manual-review state.
- Manual override actions are role-restricted and fully audited.
- Override actions never mutate existing ledger events; they append explicit override events.
- Operators can recover enough room context from the admin console to take the next action safely.

### AR-13 — Verify and Replay the Room Ledger

**Story**  
As an `Org Admin or auditor`  
I want `to replay room state and verify ledger integrity from append-only events`  
So that `the product can prove what happened and defend finalized outcomes`

**Metadata**

- **Epic:** E5. Trust & Audit
- **Layer:** platform
- **Dependency:** AR-03 onward
- **Evidence links:** BRD §9 and §10, Solution Architecture §4, System Design §3 and §8

**Acceptance Criteria**

- Every room event has an ordered sequence and hash-chain linkage.
- The system can rebuild room state from the ledger without relying on mutable UI read models.
- Ledger verification can detect missing sequence numbers or broken hash links.
- Settlement outputs can be traced back to the exact ledger snapshot used in computation.

## 3. Dependency Notes

- AR-01 through AR-03 unlock the product contract and all downstream work.
- AR-04 through AR-07 are the core execution loop and should ship before settlement UI polish.
- AR-08 and AR-09 must be implemented before pilot because the product is not meaningful without payout semantics.
- AR-10 through AR-12 can ship later in the milestone plan, but pilot must not start without them.
- AR-13 is not optional operational polish. It is part of the product's trust model.
