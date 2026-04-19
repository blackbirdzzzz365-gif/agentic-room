import { z } from "zod";

export const roomStatusSchema = z.enum([
  "FORMING",
  "PENDING_CHARTER",
  "ACTIVE",
  "IN_REVIEW",
  "IN_SETTLEMENT",
  "SETTLED",
  "FAILED",
  "DISPUTED"
]);

export const roomPhaseSchema = z.enum(["0", "1", "2", "3", "4", "5"]);

export const agentRoleSchema = z.enum([
  "COORDINATOR",
  "CONTRIBUTOR",
  "REVIEWER",
  "OBSERVER",
  "PANELIST",
  "ADMIN"
]);

export const memberStatusSchema = z.enum(["INVITED", "ACTIVE", "INACTIVE", "REMOVED", "DECLINED"]);

export const taskStatusSchema = z.enum([
  "OPEN",
  "CLAIMED",
  "DELIVERED",
  "ACCEPTED",
  "REJECTED",
  "REQUEUED",
  "BLOCKED",
  "CANCELLED"
]);

export const reviewStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "DISPUTED"]);
export const effortEstimateSchema = z.enum(["S", "M", "L", "XL"]);
export const settlementStatusSchema = z.enum([
  "PENDING_REVIEW",
  "ACCEPTED",
  "DISPUTED",
  "MANUAL_REVIEW",
  "FINAL"
]);

export const settlementVoteSchema = z.enum(["ACCEPT", "REJECT", "ABSTAIN"]);

export const disputeCategorySchema = z.enum(["OPERATIONAL", "ECONOMIC"]);
export const operationalDisputeSubtypeSchema = z.enum([
  "DELIVERY_REJECTION_CONTESTED",
  "TASK_TIMEOUT_CONTESTED",
  "TASK_REQUEUE_CONTESTED"
]);
export const economicDisputeSubtypeSchema = z.enum([
  "ATTRIBUTION_CONTESTED",
  "SETTLEMENT_ALLOCATION_CONTESTED"
]);
export const disputeStatusSchema = z.enum([
  "COOLING_OFF",
  "OPEN",
  "PANEL_ASSIGNED",
  "UNDER_REVIEW",
  "RESOLVED",
  "ESCALATED_TO_MANUAL"
]);

export const disputeEvidenceTypeSchema = z.enum([
  "ROOM_EVENT_REF",
  "ARTIFACT_REF",
  "TASK_RECORD_REF",
  "CONSENSUS_ROUND_REF"
]);

export const roomEventTypeSchema = z.enum([
  "ROOM_CREATED",
  "MISSION_DRAFTED",
  "MISSION_CONFIRMED",
  "MEMBER_INVITED",
  "MEMBER_JOINED",
  "MEMBER_DECLINED",
  "CHARTER_PROPOSED",
  "CHARTER_SIGNED",
  "CHARTER_SIGNATURE_RECORDED",
  "CHARTER_DECLINED",
  "CHARTER_EXPIRED",
  "ROOM_ACTIVATED",
  "TASK_CLAIMED",
  "TASK_UNCLAIMED",
  "TASK_DELIVERED",
  "TASK_ACCEPTED",
  "TASK_REJECTED",
  "TASK_REQUEUED",
  "TASK_BLOCKED",
  "TASK_CANCELLED",
  "THREAD_MESSAGE",
  "SETTLEMENT_PROPOSED",
  "SETTLEMENT_VOTE",
  "SETTLEMENT_FINAL",
  "DISPUTE_FILED",
  "DISPUTE_PANELED",
  "DISPUTE_RESOLVED",
  "DISPUTE_ESCALATED",
  "MANUAL_OVERRIDE",
  "ROOM_SETTLED",
  "ROOM_FAILED"
]);

export const missionStructuredSchema = z.object({
  objective: z.string().min(1),
  deliverables: z.array(z.string()).min(1),
  constraints: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([])
});

export const actorSchema = z.object({
  actorId: z.string().min(1),
  actorRole: agentRoleSchema
});

export const timeoutRulesSchema = z.object({
  invitationWindowHours: z.number().int().positive().default(48),
  charterSignWindowHours: z.number().int().positive().default(24),
  taskClaimWindowHours: z.number().int().positive().default(24),
  reviewWindowHours: z.number().int().positive().default(24),
  settlementVoteWindowHours: z.number().int().positive().default(48),
  disputeCoolingOffHours: z.number().int().positive().default(12),
  panelReviewWindowHours: z.number().int().positive().default(72),
  disputeResolutionWindowHours: z.number().int().positive().default(120)
});

export const consensusConfigSchema = z.object({
  settlementQuorumRatio: z.number().min(0).max(1).default(0.6),
  settlementAcceptRatio: z.number().min(0).max(1).default(2 / 3)
});

export const taskDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  deliverableSpec: z.string().min(1),
  effortEstimate: effortEstimateSchema,
  weight: z.number().positive(),
  dependencies: z.array(z.string()).default([])
});

export const charterDraftSchema = z.object({
  roomId: z.string().uuid(),
  version: z.number().int().positive().default(1),
  tasks: z.array(taskDefinitionSchema).min(1),
  baselineSplit: z.record(z.string(), z.number().min(0)).refine(
    (value) => Object.keys(value).length > 0,
    "baseline split must not be empty"
  ),
  bonusPoolPct: z.number().min(0).max(0.2),
  malusPoolPct: z.number().min(0).max(0.1),
  consensusConfig: consensusConfigSchema,
  timeoutRules: timeoutRulesSchema
});

export const createRoomCommandSchema = actorSchema.extend({
  name: z.string().min(1),
  requesterId: z.string().min(1),
  coordinatorId: z.string().min(1),
  budgetTotal: z.number().positive(),
  executionDeadlineAt: z.string().datetime()
});

export const draftMissionCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  rawInput: z.string().min(1),
  structured: missionStructuredSchema
});

export const confirmMissionCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  rawInput: z.string().min(1),
  structured: missionStructuredSchema
});

export const inviteMemberCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  memberId: z.string().min(1),
  identityRef: z.string().min(1),
  role: agentRoleSchema
});

export const memberDecisionCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  memberId: z.string().min(1)
});

export const createCharterCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  draft: charterDraftSchema.omit({ roomId: true })
});

export const signCharterCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  charterId: z.string().uuid()
});

export const declineCharterCommandSchema = signCharterCommandSchema.extend({
  reason: z.string().min(1)
});

export const claimTaskCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  taskId: z.string().uuid()
});

export const deliverTaskCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  taskId: z.string().uuid(),
  contentRef: z.string().min(1),
  contentType: z.string().min(1)
});

export const reviewTaskCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  taskId: z.string().uuid(),
  verdict: z.enum(["ACCEPTED", "REJECTED"]),
  notes: z.string().min(1)
});

export const peerRatingCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  targetId: z.string().min(1),
  signal: z.number().int().min(-1).max(1)
});

export const requesterRatingCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  targetId: z.string().min(1),
  rating: z.number().int().min(0).max(10)
});

export const settlementVoteCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  proposalId: z.string().uuid(),
  vote: settlementVoteSchema,
  reason: z.string().optional()
});

export const disputeEvidenceSchema = z.object({
  type: disputeEvidenceTypeSchema,
  ledgerRef: z.string().min(1)
});

export const createDisputeCommandSchema = actorSchema.extend({
  roomId: z.string().uuid(),
  category: disputeCategorySchema,
  subType: z.union([operationalDisputeSubtypeSchema, economicDisputeSubtypeSchema]),
  respondentId: z.string().min(1),
  remedySought: z.string().min(1),
  evidence: z.array(disputeEvidenceSchema).min(1)
});

export const roomEventSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  eventType: roomEventTypeSchema,
  actorId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
  prevHash: z.string().min(1),
  hash: z.string().min(1)
});

export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type RoomPhase = z.infer<typeof roomPhaseSchema>;
export type AgentRole = z.infer<typeof agentRoleSchema>;
export type MemberStatus = z.infer<typeof memberStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;
export type SettlementVote = z.infer<typeof settlementVoteSchema>;
export type DisputeCategory = z.infer<typeof disputeCategorySchema>;
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type RoomEventType = z.infer<typeof roomEventTypeSchema>;
export type MissionStructured = z.infer<typeof missionStructuredSchema>;
export type CharterDraft = z.infer<typeof charterDraftSchema>;
export type TaskDefinition = z.infer<typeof taskDefinitionSchema>;
export type TimeoutRules = z.infer<typeof timeoutRulesSchema>;
export type ConsensusConfig = z.infer<typeof consensusConfigSchema>;
export type RoomEvent = z.infer<typeof roomEventSchema>;

export const defaultTimeoutRules: TimeoutRules = timeoutRulesSchema.parse({});
export const defaultConsensusConfig: ConsensusConfig = consensusConfigSchema.parse({});
