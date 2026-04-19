# Agentic Room Network — Phân Tích Phản Biện & Đề Xuất Giải Pháp

**Tài liệu gốc:** PRD v1.0 — Federated Room Protocol for Agentic OS Collaboration  
**Phiên bản phân tích:** April 2026  

---

## Tổng Quan

PRD Agentic Room Network có vision đúng nhưng lẫn lộn giữa **feature description** (kết quả trông như thế nào) và **feature design** (cơ chế vận hành như thế nào). Phần lớn mechanisms được claim chỉ là outcome examples.

Ba vấn đề cốt lõi phải giải quyết trước khi implement bất cứ thứ gì:

1. **Contribution Attribution** — trái tim của reward system, hoàn toàn chưa được thiết kế
2. **Consensus Protocol** — không có algorithm, toàn bộ Phase 1/3/4 không có foundation
3. **Dispute Resolution** — thiếu cơ chế này thì economic layer không trustworthy

---

## Phần A — Phản Biện Có Cơ Sở

### A.1 Efficiency Formula Là Công Thức Nguy Hiểm

PRD đề xuất: `efficiency = accepted value / estimated resource cost`

Cả tử số lẫn mẫu số đều dễ bị manipulate:

- **"Estimated resource cost"** do agent tự khai trước khi làm → inflate để boost score. Đây là moral hazard cổ điển.
- **"Accepted value"** không có định nghĩa rõ — ai accept? Requester? Đa số agents? Evaluators? Nếu là requester, họ có thể định nghĩa "value" theo hướng có lợi cho mình.
- Formula thiếu temporal dimension: agent làm nhanh nhưng ẩu vs agent làm chậm nhưng kỹ sẽ cho cùng score nếu "accepted value" như nhau.
- Không có normalisation theo task complexity.

**Contradiction nội tại:** PRD acknowledge "Attribution Gaming" là risk, nhưng formula này chính là cơ chế sinh ra gaming đó.

---

### A.2 Settlement Example Là Outcome Description, Không Phải Mechanism

PRD đưa ví dụ:
```
agent_architect: 20% → 15% (lý do: ít execution involvement)
agent_builder:  60% → 65% (lý do: xử lý unblock critical path)
```

Đây chỉ là kết quả trông như thế nào. PRD không giải thích:
- Ai đề xuất con số điều chỉnh này?
- Nếu agent_architect không đồng ý giảm từ 20% xuống 15%, điều gì xảy ra?
- "Contribution Graph" được xây như thế nào? Node là gì, edge là gì, weight tính ra sao?
- Khi 3 agents disagree về con số, cơ chế tiebreak là gì?

Đây là **claim có mechanism nhưng mechanism không tồn tại**.

---

### A.3 "Federated" Là Buzzword, Không Phải Thiết Kế

Federation thực sự đòi hỏi giải quyết:

- **Identity across federation boundaries**: Agent từ Org A và Org B có cùng namespace không? Làm sao tránh Sybil attack cross-org?
- **Policy conflict**: Khi Rule của Org A và Rule của Org B mâu thuẫn trong cùng room, rule nào áp dụng?
- **Trust verification**: Làm sao room biết agent từ federation khác thực sự có skill như nó claim? Ai verify? Federation B có thể là dishonest federation.

PRD list "Federation Trust Failure" là risk nhưng không đưa ra bất kỳ mitigation mechanism nào.

---

### A.4 6 Collaboration Modes Là Feature Name List

PRD claim đây là differentiator: `swarm / deliberation / assembly / tournament / council / shadow`. Nhưng không có một dòng nào giải thích:
- Cấu trúc event flow khác nhau như thế nào giữa các mode?
- Mode nào phù hợp với task loại nào, và ai/cái gì quyết định?
- "Shadow mode" — shadow ai, với mục đích gì, kết quả có ảnh hưởng đến reward không?
- "Tournament" — loser có bị penalise không?

**6 modes này trong thực tế sẽ là 6 hệ thống con hoàn toàn khác nhau về protocol.** Liệt kê tên mà không design là debt tích lũy cho engineering.

---

### A.5 Intent Compiler Là Assumption Ngây Thơ Nhất

Phase 0 claim: NLP → structured mission. Vấn đề:

- Khi NLP misinterpret intent và mission đã được sign bởi agents → Phase 1 đã lock commitment. Agent có thể exit không?
- Human requester không phải lúc nào cũng biết họ muốn gì. NLP compiler sẽ make up assumptions → structured mission không reflect thực tế.
- **Contradiction:** PRD nói "NLP → structured mission" ở Phase 0, nhưng Phase 1 lại nói cần "alignment và sign-off". Nếu mission đã compiled, tại sao cần alignment phase? Nếu alignment là thực chất, thì Phase 0 chỉ là draft — không phải "compiled mission".

---

### A.6 Tính Năng Bị Thiếu Hoàn Toàn

| Thiếu | Hậu quả nếu không có |
|---|---|
| **Partial completion & pro-rata settlement** | Mission 60% hoàn thành thì ai được trả gì? |
| **Room exit conditions** | Agents không biết họ đang commit gì khi join |
| **Task dependency graph** | Task B block Task C, agent disappear → ai chịu trách nhiệm? |
| **Schema versioning** | Rooms chạy months, protocol evolve, federated nodes không upgrade cùng lúc |
| **Incentive compatibility analysis** | Không chứng minh bất kỳ reward mode nào là incentive-compatible |
| **Anti-Sybil mechanism** | 5 agents do cùng 1 entity tạo ra → chiếm 100% reward |

---

## Phần B — Đề Xuất Giải Quyết 3 Vấn Đề Core

---

## B.1 Contribution Attribution Algorithm

### Tại Sao Hard

Đây là bài toán **social epistemology**, không phải đo lường thuần túy.

- **Counterfactual underdetermination**: Contribution thực sự của agent A là "giá trị A thêm vào nếu A không ở đó" — nhưng đây là counterfactual không bao giờ xảy ra. Không có ground truth.
- **Information asymmetry kép**: Agent biết nhiều nhất về công việc của mình (private info) nhưng cũng có incentive lớn nhất để misreport.
- **Non-linearity**: Đôi khi một agent giải quyết một blocker nhỏ nhưng unblock toàn bộ critical path — contribution nhỏ về artifact nhưng lớn về impact.

### Đề Xuất: Layered Evidence-Anchored Attribution

```
final_contribution(i) =
  α × objective_score(i)     // α = 0.40
  + β × causal_score(i)      // β = 0.25
  + γ × calibrated_peer(i)   // γ = 0.20
  + δ × requester_score(i)   // δ = 0.15
```

**Layer 1 — Objective Score (automated, không gameable)**

```python
ObjectiveScore(agent_i) = Σ_tasks [
    task_weight(t) × completion_quality(t, i) × (1 - time_overrun_penalty(t, i))
]

task_weight(t)            = base_weight(t) × critical_path_multiplier(t)
# Critical path tasks: 2× weight
# Baseline weight locked trong Phase 1 Agreement — không thể thay đổi sau khi lock

completion_quality(t, i)  = accepted_artifact_score(t) / max_possible_score
time_overrun_penalty(t,i) = max(0, (actual - estimated) / estimated × 0.1)  # capped 10%
```

**Layer 2 — Causal Score (credit flow qua causal graph)**

```typescript
interface CausalLink {
  source_contribution: ContributionEvent.id  // "A enabled này"
  target_contribution: ContributionEvent.id  // "B was enabled bởi A"
  link_type: 'DIRECT_DEPENDENCY' | 'UNBLOCK' | 'DESIGN_REUSE' | 'KNOWLEDGE_TRANSFER'
  declared_by: Agent.id           // phải là target agent, không phải source
  evidence: ArtifactRef[]         // bắt buộc — phải cite artifact cụ thể
  verified_by: Agent.id[]         // ≥50% agents không liên quan phải corroborate
  disputed_by: Agent.id[]
  weight: 0.1 | 0.3 | 0.5 | 0.7 | 1.0
}
```

Credit propagation với exponential decay:

```python
def compute_causal_score(agent_i, causal_graph, base_scores, decay=0.4):
    """
    decay=0.4: mỗi hop trong causal chain, credit giảm còn 40%
    Ví dụ: A enable B enable C
      - C: full credit cho task của C
      - B: direct credit + 0.4 × value(C)
      - A: direct credit + 0.4 × value(B) + 0.16 × value(C)
    """
    causal_score = 0
    for link in causal_graph.outgoing_links(agent_i):
        if link.verification_ratio > 0.5:  # majority đã corroborate
            propagated = link.weight × base_scores[link.target] × decay
            causal_score += propagated
    return causal_score
```

Anti-gaming: agent khai >N/2 tasks đều "được enabled bởi tôi" → trigger audit.

**Layer 3 — Calibrated Peer Review (blind commit-reveal)**

```
Round 1 - COMMIT (4h):
  agent_i gửi: Hash(peer_scores || nonce)
  peer_scores: {agent_j: score_j for j ≠ i}
  Constraint: sum của tất cả scores = (n-1) × 50 (normalized, chống inflation)

Round 2 - REVEAL (4h, sau khi commit window đóng):
  agent_i gửi: (peer_scores, nonce)
  Non-revealers: excluded khỏi peer evaluation round

Round 3 - CALIBRATION:
  calibration_weight_i = max(0.1, 1 - mean_absolute_deviation_i / norm_factor)
  # Evaluator deviation cao so với median → downweighted
  
  calibrated_peer_score_j = weighted_average(scores_j, calibration_weights)
```

**Layer 4 — Requester Assessment (bounded):** Capped ở 15%, không thể unilaterally override layers 1-3.

### Data Model

```typescript
interface ContributionRecord {
  agent_id: string
  room_id: string
  
  // Layer outputs
  total_objective_score: number
  causal_links_outgoing: CausalLink[]
  total_causal_score: number
  calibrated_peer_score: number
  requester_assessment: number     // 0-100
  
  // Final
  raw_contribution_score: number   // weighted sum
  normalized_share: number         // % of total room contribution
  final_payout_amount: number
  
  // Audit
  computation_snapshot: JSONBlob   // full computation preserved cho dispute
  algorithm_version: string        // đảm bảo appeal dùng cùng algorithm
}
```

### Điểm Yếu Được Thừa Nhận

- Decay parameter 0.4 là arbitrary → cần empirical calibration từ room data
- Pure coordination roles (bridge communication giữa A và C, không produce artifact) sẽ bị undervalue
- Với n=5 agents, "consensus" trong peer calibration có thể là collusion

---

## B.2 Consensus Protocol

### Tại Sao Hard

Ba properties không thể đồng thời đạt được:
- **Safety**: không bao giờ commit sai kết quả
- **Liveness**: luôn eventually đưa ra quyết định
- **Byzantine Fault Tolerance**: chịu được f nodes malicious với n ≥ 3f+1

Thêm vào đó: **strategic behavior**. Agents không chỉ crash hoặc lie arbitrarily — họ vote chiến lược để maximize reward. PBFT và Raft không được thiết kế cho điều này.

**Last-mover advantage**: agent rational delay voting để gather information từ người khác → liveness failure trong settlement consensus.

### Đề Xuất: 3 Protocol Cho 3 Pha

#### Protocol A — Pre-Work Alignment (Phase 1): Unanimous Consent

Rationale: Đây là commitment phase. Nếu không đạt unanimous consent, tốt hơn là fail early.

```
Quy trình:
1. Creator post Agreement Proposal V0
2. OPEN COMMENT (24h): agent post structured amendment
   Format: { section, proposed_change, rationale, effect_on_reward }
3. Creator post V1 incorporating accepted amendments
4. APPROVAL ROUND: mỗi agent vote ACCEPT | REJECT | ABSTAIN + điều kiện
5. Nếu REJECT:
   - Rejecting agent PHẢI specify chính xác điều gì cần thay (không chỉ "no")
   - Creator có 12h để post V2
   - Reject V2 với no new substance → flagged OBSTRUCTIVE (reputation penalty nhỏ)
   - Creator call FINAL VOTE sau 2 rounds amendment
6. FINAL VOTE: unanimous required, else room DISSOLVED
   (agents không bị penalized khi dissolved; reason được log)

Timeout: agent không vote trong 48h → treated as ABSTAIN
```

#### Protocol B — Execution (Phase 2-3): Weighted Majority + Optimistic Default

```typescript
interface TaskConsensusConfig {
  quorum_threshold: 0.60         // 60% active agents phải vote
  approval_threshold: 0.67       // 2/3 votes phải là ACCEPT
  weight_scheme: 'REPUTATION_WEIGHTED'  // reputation weight capped 3×
  timeout_action: 'DEFAULT_APPROVE'     // optimistic: không ai object → accepted
  timeout_duration: Duration            // set trong Phase 1 Agreement
  offline_handling: 'COUNT_AS_ABSTAIN'
}
```

**Task claim bonding**: Khi claim task, agent lock 5% of allocated reward.  
Nếu không deliver trong SLA → stake slashed. Ngăn "claim and wait to obstruct."

#### Protocol C — Post-Work Settlement (Phase 4): Blind Commit-Reveal BFT

Đây là protocol phức tạp nhất. Chống lại: herd behavior, last-mover advantage, extreme outlier proposals, collusive majority.

```
Phase C.1 — EVIDENCE WINDOW (24h)
  Mỗi agent submit Evidence Package: danh sách contributions với links đến room events
  Không submit số — chỉ submit evidence
  Tất cả agents thấy tất cả evidence packages (transparent)

Phase C.2 — BLIND COMMIT (8h)
  agent_i tính: proposal_i = { agent_A: 0.32, agent_B: 0.41, agent_C: 0.27 }
  Constraints:
    - sum = 1.0
    - không agent nào dưới floor (50% of pre-agreed minimum)
  agent_i gửi: Hash(canonical_json(proposal_i) || nonce || privkey_sig)
  Agents chỉ thấy "X đã committed" signal, không thấy nội dung

Phase C.3 — REVEAL (4h)
  agent_i gửi: (proposal_i, nonce)
  Non-revealers: stake slashed 5%, treated as ABSTAIN

Phase C.4 — AGGREGATION
```

```python
def aggregate_settlement(proposals, weights):
    # Bước 1: Detect outliers
    for agent_j in all_agents:
        allocations_for_j = [p[agent_j] for p in proposals]
        median_j = median(allocations_for_j)
        for proposal in proposals:
            if abs(proposal[agent_j] - median_j) > OUTLIER_THRESHOLD:  # 0.15
                weights[proposal.from_agent] *= 0.5  # downweight outlier proposer

    # Bước 2: Weighted MEDIAN (không phải mean)
    # Median breakdown point ≥ 25%: cần >25% weighted votes mới kéo kết quả lệch
    # Mean breakdown point là 0%: một agent weight cao có thể drag mean
    final_allocation = {}
    for agent_j in all_agents:
        weighted_allocations = [(p[agent_j], weights[p.from_agent]) for p in proposals]
        final_allocation[agent_j] = weighted_median(weighted_allocations)

    # Bước 3: Normalize
    total = sum(final_allocation.values())
    return {k: v/total for k, v in final_allocation.items()}
```

```
Phase C.5 — ACCEPTANCE CHECK
  Mỗi agent vote ACCEPT nếu: |final_allocation[i] - my_proposal[i]| ≤ 0.08 for all i
  Cần 2/3 supermajority ACCEPT → settlement FINALIZED
  Nếu không: tối đa 2 NEGOTIATION ROUNDS thêm
  Sau 2 rounds vẫn không đạt → trigger DISPUTE RESOLUTION
```

---

## B.3 Dispute Resolution

### Tại Sao Hard

Ba tension không thể hoàn toàn resolve:

- **Finality vs Accuracy**: cần decisions cuối cùng nhưng accurate decisions cần time
- **Independence vs Expertise**: arbiter lý tưởng là không liên quan (independent) nhưng đủ chuyên môn (expert) — trong small federated system, hai properties này conflict
- **Deterrence vs Access**: filing quá dễ → frivolous disputes; quá khó → legitimate grievances bị suppress

### Taxonomy 5 Levels

| Level | Loại | Ví dụ |
|---|---|---|
| L1 | Administrative | Timeout extension, quorum validity, evidence admissibility |
| L2 | Contribution | Attribution claim, causal link invalid, peer rating bias |
| L3 | Delivery | Spec compliance, quality standard, scope creep |
| L4 | Settlement | Allocation unfair, evidence suppression, collusion allegation |
| L5 | Conduct | Bad faith, misrepresentation, Sybil activity |

### Pre-Dispute: Mandatory 24h Cooling-Off

Trước khi formal filing, bắt buộc cooling-off 24h:

```
System auto-generate DisputeSummary:
  - Timeline của relevant events (từ room log)
  - Cả hai bên's contribution records
  - Relevant artifact diffs
  - Previous consensus round data

Cả hai bên thấy summary của nhau
Nếu tự resolve trong 24h → dispute cancelled, no reputation effects, no public record

Kỳ vọng: ~40-50% disputes resolve ở bước này
(nhiều disputes tồn tại vì các bên thiếu full picture của nhau)
```

### Dispute Filing Requirements

```typescript
interface DisputeCase {
  level: 1 | 2 | 3 | 4 | 5
  dispute_type: DisputeType
  claimant: Agent.id
  respondent: Agent.id | Requester.id
  
  statement_of_claim: string    // tối đa 1000 words, structured template
  evidence: Evidence[]          // ít nhất 1 objective evidence bắt buộc
  remedy_sought: RemedySought
  filing_stake: number          // locked trong suốt dispute
}

// Evidence được chấp nhận:
type AcceptedEvidence = 
  'ARTIFACT_DIFF' | 'EVENT_LOG_ENTRY' | 'SIGNED_MESSAGE' |
  'TASK_RECORD' | 'CONSENSUS_ROUND_DATA' | 'CAUSAL_LINK_RECORD'

// KHÔNG được chấp nhận:
// 'UNSIGNED_STATEMENT' | 'CHARACTER_CLAIM' | 'HEARSAY'
```

### Arbiter Selection

```python
def eligible_arbiters(dispute, all_agents):
    return [a for a in all_agents if (
        # Independence
        a.id not in dispute.room.all_participants
        and not co_participated_recently(a, dispute.claimant, lookback_days=90)
        and not co_participated_recently(a, dispute.respondent, lookback_days=90)
        and dispute_history_clear(a, dispute.claimant)
        and dispute_history_clear(a, dispute.respondent)
        # Competence
        and a.reputation_score >= ARBITER_REPUTATION_THRESHOLD
        and a.completed_similar_missions(dispute.room.mission_type, min_count=2)
        and a.dispute_frivolous_rate < 0.10
        # Accountability
        and a.guild_membership != []  # phải là guild member
    )]

# Selection: weighted random
# weight = reputation_score × (1 / prior_ruling_correlation_with_median)
# Correlate quá cao với majority → slight downweight (possible herd thinker)
# Deviate quá nhiều luôn → downweight (possible bad actor)

# Mỗi bên: 1 veto (no justification needed)
# Panel: 3 arbiters (L1-L3), 5 arbiters (L4-L5)
# Arbiters evaluate INDEPENDENTLY trước khi deliberate — tránh anchor bias
```

### Dispute Flow (Level 3: Delivery — phổ biến nhất)

```
Ngày 0:  Filing + cooling-off check
Ngày 1:  Arbiters assigned, accept/decline (48h)
Ngày 2:  EVIDENCE EXCHANGE mở
          Claimant: artifact + spec reference + specific failure points
          Respondent: 72h để submit rebuttal + evidence compliance
          Submissions locked sau window (không amend sau khi thấy đối phương)
Ngày 5:  ARBITER INDEPENDENT EVALUATION
          Mỗi arbiter evaluate ĐỘCLẬP
          Submit: ACCEPT | REJECT | PARTIAL + written reasoning (bắt buộc)
Ngày 7:  PANEL DELIBERATION (nếu không unanimous)
          Arbiters thấy nhau's rulings và reasoning
          Async discussion 72h
          FINAL RULING: majority decision
          Written decision phải address tất cả key evidence
Ngày 10: RULING PUBLISHED
          Appeal window mở (72h)
```

**Level 4 thêm bước:** Independent Contribution Audit trước khi arbiters review. Auditor reconstruct contribution graph từ raw event log, produce OBJECTIVE RECONSTRUCTION (facts only, no judgment). Award bounded ±15% so với consensus settlement — ngăn runaway redistribution.

### Stake Model

```python
filing_stakes = {1: 0.02, 2: 0.05, 3: 0.07, 4: 0.10, 5: 0.15}  # % room earnings

def apply_stakes(outcome, filing_stake, respondent_frozen_stake):
    if outcome == 'UPHELD':
        claimant_receives = filing_stake + respondent_frozen_stake * 0.5
        respondent_loses  = respondent_frozen_stake
    elif outcome == 'REJECTED':
        claimant_loses   = filing_stake  # forfeited
        respondent_freed = respondent_frozen_stake
    elif outcome == 'FRIVOLOUS':
        claimant_loses   = filing_stake * 2.0  # doubled penalty
    elif outcome == 'PARTIAL':
        # Pro-rata based on adjustment_ratio
        ...

respondent_frozen = {1: 0.05, 2: 0.10, 3: 0.12, 4: 0.20, 5: 0.25}
```

### Appeal

```
Điều kiện:
  - 1 lần appeal per case
  - Filed trong 72h của ruling
  - Chi phí: 2× original filing stake (non-refundable)

Grounds hợp lệ (phải specify, panel review grounds trước):
  G1: New evidence không available và không thể có trước
  G2: Procedural violation có document
  G3: Factual error cụ thể (misread event log entry)

KHÔNG hợp lệ:
  - "Tôi không đồng ý với interpretation"
  - "Outcome là unfair với tôi"
  - "Tôi quên submit evidence"

Appeal panel: 5 arbiters MỚI (không ai từ original panel)
Outcome: AFFIRM | REVERSE | MODIFY (trong original bounds)
Nếu appeal thất bại: stake forfeited, case FINAL, reputation effect cho frivolous appeal
```

### Reputation Effects

```python
severity_multiplier = {1: 0.5, 2: 1.0, 3: 1.2, 4: 1.5, 5: 2.0}

outcomes = {
    'UPHELD':            {'claimant': +0.10, 'respondent': -0.20},
    'REJECTED':          {'claimant': -0.15, 'respondent': +0.05},
    'FRIVOLOUS':         {'claimant': -0.40},            # strong deterrent
    'CONDUCT_VIOLATION': {'respondent': -1.00},          # severe, permanent flag
}

# Arbiters: +0.05 base cho tham gia, +0.03 thêm nếu voted với majority
# Minority vote KHÔNG bị penalized — muốn honest minority opinions

# L1-L3: dispute records expire sau 180 ngày
# L4-L5: records persist indefinitely
```

---

## Kết Luận

### Ba Vấn Đề Là Deeply Coupled

```
Contribution Attribution
    └─→ tạo INPUT cho Settlement Consensus
            └─→ Dispute Resolution là SAFETY NET cho cả hai
```

Nếu Attribution sai → Consensus argue về wrong numbers → Disputes nhiều hơn thực sự cần thiết.

### Thứ Tự Implement

```
1. Consensus Protocol (foundation cho mọi decision)
2. Attribution Algorithm (cần room data để calibrate parameters)
3. Dispute Resolution (safety net, không cần cho MVP nhưng cần trước mainnet)
```

### Điều Quan Trọng Nhất Không Phải Technical Design

**Parameter governance** là critical nhất và không thể hardcode từ đầu:

| Parameter | Default | Cần calibrate sau |
|---|---|---|
| Causal credit decay | 0.40/hop | Dựa trên room data thực tế |
| Outlier threshold trong settlement | 0.15 | Dựa trên variance quan sát được |
| Reputation delta magnitudes | xem trên | Dựa trên behavior data |
| Tolerance band trong acceptance check | 0.08 | Dựa trên settlement dispute rate |
| Filing stake percentages | 2-15% | Dựa trên frivolous dispute rate |

Những con số này quyết định **incentive landscape** của toàn bộ hệ thống. Thiết kế protocol đúng nhưng calibrate parameter sai → system produce wrong equilibrium. Cần governance mechanism cho phép adjust parameters dựa trên observed behavior, không cứng nhắc từ ngày 1.

---

*Phân tích bởi Agentic Room Session — April 2026*
