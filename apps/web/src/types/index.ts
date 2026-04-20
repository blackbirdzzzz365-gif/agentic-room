// ─── Domain Enums ────────────────────────────────────────────────────────────

export type RoomStatus =
  | "FORMING"
  | "PENDING_CHARTER"
  | "ACTIVE"
  | "IN_REVIEW"
  | "IN_SETTLEMENT"
  | "SETTLED"
  | "FAILED"
  | "DISPUTED";

export type AgentRole =
  | "COORDINATOR"
  | "CONTRIBUTOR"
  | "REVIEWER"
  | "OBSERVER"
  | "PANELIST"
  | "ADMIN";

export type TaskStatus =
  | "OPEN"
  | "CLAIMED"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "REQUEUED"
  | "BLOCKED"
  | "CANCELLED";

export type SettlementStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "DISPUTED"
  | "MANUAL_REVIEW"
  | "FINAL";

export type DisputeStatus =
  | "COOLING_OFF"
  | "OPEN"
  | "PANEL_ASSIGNED"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "ESCALATED_TO_MANUAL";

export type EffortEstimate = "S" | "M" | "L" | "XL";

export type DisputeCategory = "OPERATIONAL" | "ECONOMIC";

export type MemberStatus = "INVITED" | "ACTIVE" | "DECLINED";

// ─── Domain Models ───────────────────────────────────────────────────────────

export interface RoomSummary {
  id: string;
  name: string;
  status: RoomStatus;
  phase: number;
  memberCount: number;
  taskCount: number;
  disputeCount: number;
  budgetTotal?: number;
  executionDeadlineAt?: string;
  updatedAt: string;
  createdAt: string;
}

export interface Member {
  id: string;
  memberId: string;
  name?: string;
  role: AgentRole;
  status: MemberStatus;
  joinedAt?: string;
}

export interface TaskDefinition {
  title: string;
  description: string;
  deliverableSpec?: string;
  effortEstimate: EffortEstimate;
  weight: number;
  dependencies?: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  effortEstimate?: EffortEstimate;
  weight?: number;
  assigneeId?: string;
  deliverableUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Charter {
  id: string;
  tasks: TaskDefinition[];
  baselineSplit: number;
  discretionaryPoolPct: number;
  consensusConfig?: {
    quorum: number;
    approvalRatio: number;
  };
  status: "DRAFT" | "ACTIVE" | "DECLINED";
  signatures: Record<string, { signedAt: string } | { declinedAt: string }>;
  createdAt: string;
}

export interface Mission {
  objective: string;
  deliverables?: string[];
  successCriteria?: string[];
  constraints?: string[];
  confirmedAt?: string;
  status: "DRAFT" | "CONFIRMED";
}

export interface Allocation {
  memberId: string;
  amount: number;
}

export interface SettlementProposal {
  id: string;
  status: SettlementStatus;
  allocations: Allocation[];
  votes: Record<string, { vote: "APPROVE" | "REJECT"; rationale?: string }>;
  proposedAt: string;
}

export interface DisputeEvidence {
  type: string;
  url?: string;
  description: string;
}

export interface Dispute {
  id: string;
  category: DisputeCategory;
  subType?: string;
  respondentId: string;
  remedySought?: string;
  evidence: DisputeEvidence[];
  status: DisputeStatus;
  panelIds?: string[];
  resolution?: string;
  filedAt: string;
  updatedAt: string;
}

export interface RoomEvent {
  id: string;
  type: string;
  actorId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  status: RoomStatus;
  phase: number;
  requesterId?: string;
  coordinatorId?: string;
  budgetTotal?: number;
  executionDeadlineAt?: string;
  mission?: Mission;
  charter?: Charter;
  members: Member[];
  tasks: Task[];
  settlement?: SettlementProposal;
  disputes: Dispute[];
  events?: RoomEvent[];
  createdAt: string;
  updatedAt: string;
}

// ─── Admin Types ──────────────────────────────────────────────────────────────

export interface AdminRoom {
  id: string;
  name: string;
  status: RoomStatus;
  phase: number;
  memberCount?: number;
}

export interface Job {
  id: string;
  type: string;
  status: string;
  runAt: string;
  roomId?: string;
}

export interface AdminDispute extends Dispute {
  roomId: string;
}

export interface Metrics {
  roomsTotal?: number;
  roomsActive?: number;
  disputesOpen?: number;
  settlementsPending?: number;
  jobsQueued?: number;
  [key: string]: unknown;
}
