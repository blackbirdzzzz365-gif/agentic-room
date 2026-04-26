export type RoomStatus =
  | "FORMING"
  | "PENDING_CHARTER"
  | "ACTIVE"
  | "IN_REVIEW"
  | "IN_SETTLEMENT"
  | "SETTLED"
  | "FAILED"
  | "DISPUTED"
  | (string & {});

export type AgentRole =
  | "COORDINATOR"
  | "CONTRIBUTOR"
  | "REVIEWER"
  | "OBSERVER"
  | "PANELIST"
  | "ADMIN"
  | (string & {});

export type TaskStatus =
  | "OPEN"
  | "CLAIMED"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "REQUEUED"
  | "BLOCKED"
  | "CANCELLED"
  | (string & {});

export type SettlementStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "DISPUTED"
  | "MANUAL_REVIEW"
  | "FINAL"
  | (string & {});

export type SettlementVote = "ACCEPT" | "REJECT" | "ABSTAIN";

export type DisputeStatus =
  | "COOLING_OFF"
  | "OPEN"
  | "PANEL_ASSIGNED"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "ESCALATED_TO_MANUAL"
  | (string & {});

export type EffortEstimate = "S" | "M" | "L" | "XL";
export type DisputeCategory = "OPERATIONAL" | "ECONOMIC";
export type MemberStatus =
  | "INVITED"
  | "ACTIVE"
  | "INACTIVE"
  | "REMOVED"
  | "DECLINED"
  | (string & {});

export type MissionStatus = "DRAFT" | "CONFIRMED";
export type CharterStatus = "DRAFT" | "ACTIVE" | "DECLINED" | "EXPIRED" | (string & {});

export interface RoomSummary {
  id: string;
  name: string;
  status: RoomStatus;
  phase: number;
  requesterId?: string;
  coordinatorId?: string;
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
  identityRef?: string;
  name?: string;
  role: AgentRole;
  status: MemberStatus;
  joinedAt?: string;
  charterSigned?: boolean;
  charterSignedAt?: string;
  stakeLocked?: number;
}

export interface TaskDefinition {
  id?: string;
  title: string;
  description: string;
  deliverableSpec?: string;
  effortEstimate: EffortEstimate;
  weight: number;
  dependencies: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deliverableSpec?: string;
  status: TaskStatus;
  effortEstimate?: EffortEstimate;
  weight?: number;
  dependencies: string[];
  assigneeId?: string;
  deliverableUrl?: string;
  deliverableContentType?: string;
  artifactId?: string;
  notes?: string;
  claimDeadline?: string;
  deliveryDeadline?: string;
  reviewStatus?: string;
  deliveryCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsensusConfig {
  settlementQuorumRatio: number;
  settlementAcceptRatio: number;
}

export interface TimeoutRules {
  invitationWindowHours: number;
  charterSignWindowHours: number;
  taskClaimWindowHours: number;
  taskDeliveryWindowHours: number;
  reviewWindowHours: number;
  settlementVoteWindowHours: number;
  disputeCoolingOffHours: number;
  panelReviewWindowHours: number;
  disputeResolutionWindowHours: number;
}

export interface CharterSignature {
  status: "SIGNED" | "DECLINED" | "PENDING";
  signedAt?: string;
  declinedAt?: string;
}

export interface Charter {
  id: string;
  version?: number;
  tasks: TaskDefinition[];
  baselineSplit: Record<string, number>;
  bonusPoolPct: number;
  malusPoolPct: number;
  consensusConfig?: ConsensusConfig;
  timeoutRules?: TimeoutRules;
  status: CharterStatus;
  signatures: Record<string, CharterSignature>;
  createdAt?: string;
  signDeadline?: string;
}

export interface Mission {
  objective: string;
  rawInput?: string;
  deliverables: string[];
  successCriteria: string[];
  constraints: string[];
  outOfScope: string[];
  confirmedAt?: string;
  status: MissionStatus;
}

export interface Allocation {
  memberId: string;
  amount: number;
}

export interface SettlementVoteRecord {
  vote: SettlementVote;
  reason?: string;
  submittedAt?: string;
}

export interface SettlementProposal {
  id: string;
  status: SettlementStatus;
  allocations: Allocation[];
  votes: Record<string, SettlementVoteRecord>;
  proposedAt: string;
  finalizedAt?: string;
  computationLog?: unknown;
  signaturePayload?: unknown;
}

export interface DisputeEvidence {
  type: string;
  ledgerRef: string;
}

export interface Dispute {
  id: string;
  category: DisputeCategory;
  subType?: string;
  claimantId?: string;
  respondentId: string;
  remedySought?: string;
  evidence: DisputeEvidence[];
  evidenceCount: number;
  status: DisputeStatus;
  panelIds: string[];
  resolution?: unknown;
  filedAt: string;
  updatedAt: string;
  coolingOffExpiresAt?: string;
  responseDeadlineAt?: string;
  panelDeadlineAt?: string;
}

export interface RoomEvent {
  id: string;
  type: string;
  actorId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrityResult {
  roomId: string;
  ok: boolean;
  errors: string[];
  eventCount: number;
}

export interface IntegritySummary {
  valid: boolean;
  checkedRoomCount: number;
  invalidRoomCount: number;
  totalEvents: number;
  results: IntegrityResult[];
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
  events: RoomEvent[];
  integrity?: IntegritySummary;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRoom extends RoomSummary {}

export interface Job {
  id: string;
  type: string;
  status: string;
  runAt: string;
  roomId?: string;
  attempts?: number;
  maxAttempts?: number;
  lastError?: string;
  payload?: Record<string, unknown>;
}

export interface AdminDispute extends Dispute {
  roomId: string;
}

export interface Metrics {
  roomsTotal?: number;
  roomsActive?: number;
  disputesOpen?: number;
  settlementsPending?: number;
  failedJobs?: number;
  roomStatuses?: Record<string, number>;
  disputeStatuses?: Record<string, number>;
  settlementStatuses?: Record<string, number>;
}
