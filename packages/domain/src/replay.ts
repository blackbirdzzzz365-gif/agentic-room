import type {
  RoomEvent,
  RoomStatus,
  TaskDefinition,
  TaskStatus,
  MemberStatus,
  SettlementStatus,
  DisputeStatus
} from "@agentic-room/contracts";

type MemberProjection = {
  memberId: string;
  identityRef: string;
  role: string;
  status: MemberStatus;
  charterSigned: boolean;
  charterSignedAt: string | null;
};

type TaskProjection = TaskDefinition & {
  status: TaskStatus;
  assignedTo: string | null;
  artifactId: string | null;
  reviewStatus: string | null;
  deliveryCount: number;
};

type CharterProjection = {
  charterId: string;
  version: number;
  status: "DRAFT" | "SIGNED" | "EXPIRED";
  tasks: Record<string, TaskProjection>;
};

type SettlementProjection = {
  proposalId: string;
  status: SettlementStatus;
  allocations: Record<string, number>;
};

type DisputeProjection = {
  disputeId: string;
  status: DisputeStatus;
  category: string;
  subType: string;
};

export type RoomProjection = {
  roomId: string | null;
  name: string | null;
  requesterId: string | null;
  coordinatorId: string | null;
  budgetTotal: number;
  status: RoomStatus | null;
  phase: string | null;
  executionDeadlineAt: string | null;
  mission: {
    rawInput: string | null;
    structured: Record<string, unknown> | null;
    confirmedAt: string | null;
  };
  members: Record<string, MemberProjection>;
  charter: CharterProjection | null;
  settlement: SettlementProjection | null;
  disputes: Record<string, DisputeProjection>;
};

function makeInitialProjection(): RoomProjection {
  return {
    roomId: null,
    name: null,
    requesterId: null,
    coordinatorId: null,
    budgetTotal: 0,
    status: null,
    phase: null,
    executionDeadlineAt: null,
    mission: {
      rawInput: null,
      structured: null,
      confirmedAt: null
    },
    members: {},
    charter: null,
    settlement: null,
    disputes: {}
  };
}

export function replayRoomEvents(events: RoomEvent[]): RoomProjection {
  const state = makeInitialProjection();

  for (const event of events) {
    switch (event.eventType) {
      case "ROOM_CREATED": {
        state.roomId = event.roomId;
        state.name = String(event.payload.name ?? "");
        state.requesterId = String(event.payload.requesterId ?? "");
        state.coordinatorId = String(event.payload.coordinatorId ?? "");
        state.budgetTotal = Number(event.payload.budgetTotal ?? 0);
        state.status = "FORMING";
        state.phase = "0";
        state.executionDeadlineAt = String(event.payload.executionDeadlineAt ?? "");
        break;
      }
      case "MISSION_DRAFTED":
      case "MISSION_CONFIRMED": {
        state.mission.rawInput = String(event.payload.rawInput ?? "");
        state.mission.structured = (event.payload.structured as Record<string, unknown>) ?? {};
        if (event.eventType === "MISSION_CONFIRMED") {
          state.mission.confirmedAt = event.timestamp;
          state.status = "PENDING_CHARTER";
          state.phase = "1";
        }
        break;
      }
      case "MEMBER_INVITED":
      case "MEMBER_JOINED":
      case "MEMBER_DECLINED": {
        const memberId = String(event.payload.memberId ?? "");
        const current = state.members[memberId] ?? {
          memberId,
          identityRef: String(event.payload.identityRef ?? ""),
          role: String(event.payload.role ?? ""),
          status: "INVITED",
          charterSigned: false,
          charterSignedAt: null
        };
        if (event.eventType === "MEMBER_JOINED") {
          current.status = "ACTIVE";
        } else if (event.eventType === "MEMBER_DECLINED") {
          current.status = "DECLINED";
        } else {
          current.status = "INVITED";
        }
        state.members[memberId] = current;
        break;
      }
      case "CHARTER_PROPOSED": {
        const tasks = Object.fromEntries(
          (((event.payload.tasks as TaskDefinition[]) ?? []).map((task) => [
            task.id ?? "",
            {
              ...task,
              status: "OPEN",
              assignedTo: null,
              artifactId: null,
              reviewStatus: null,
              deliveryCount: 0
            }
          ]))
        );
        state.charter = {
          charterId: String(event.payload.charterId ?? ""),
          version: Number(event.payload.version ?? 1),
          status: "DRAFT",
          tasks
        };
        break;
      }
      case "CHARTER_SIGNATURE_RECORDED": {
        const memberId = String(event.payload.memberId ?? "");
        if (state.members[memberId]) {
          state.members[memberId].charterSigned = true;
          state.members[memberId].charterSignedAt = event.timestamp;
        }
        break;
      }
      case "CHARTER_DECLINED":
      case "CHARTER_EXPIRED": {
        if (state.charter) {
          state.charter.status = "EXPIRED";
        }
        state.status = "PENDING_CHARTER";
        state.phase = "1";
        break;
      }
      case "CHARTER_SIGNED":
      case "ROOM_ACTIVATED": {
        if (state.charter) {
          state.charter.status = "SIGNED";
        }
        state.status = "ACTIVE";
        state.phase = "2";
        break;
      }
      case "TASK_CLAIMED": {
        const taskId = String(event.payload.taskId ?? "");
        const task = state.charter?.tasks[taskId];
        if (task) {
          task.status = "CLAIMED";
          task.assignedTo = String(event.payload.assignedTo ?? "");
        }
        break;
      }
      case "TASK_UNCLAIMED":
      case "TASK_REQUEUED": {
        const task = state.charter?.tasks[String(event.payload.taskId ?? "")];
        if (task) {
          task.status = "REQUEUED";
          task.assignedTo = null;
        }
        break;
      }
      case "TASK_BLOCKED": {
        const task = state.charter?.tasks[String(event.payload.taskId ?? "")];
        if (task) {
          task.status = "BLOCKED";
          task.assignedTo = null;
        }
        break;
      }
      case "TASK_DELIVERED": {
        const task = state.charter?.tasks[String(event.payload.taskId ?? "")];
        if (task) {
          task.status = "DELIVERED";
          task.artifactId = String(event.payload.artifactId ?? "");
          task.deliveryCount += 1;
          task.reviewStatus = "PENDING";
          state.status = "IN_REVIEW";
          state.phase = "3";
        }
        break;
      }
      case "TASK_ACCEPTED":
      case "TASK_REJECTED": {
        const taskId = String(event.payload.taskId ?? "");
        const current = state.charter?.tasks?.[taskId];
        if (current) {
          if (event.eventType === "TASK_ACCEPTED") {
            current.status = "ACCEPTED";
            current.reviewStatus = "ACCEPTED";
          } else {
            const nextStatus = (event.payload.nextStatus as TaskStatus | undefined) ?? "REJECTED";
            current.status = nextStatus;
            current.reviewStatus = "REJECTED";
          }
          // Only move room back to ACTIVE if no other tasks are still DELIVERED
          const hasOtherDelivered = Object.values(state.charter?.tasks ?? {})
            .some((t) => t.id !== taskId && t.status === "DELIVERED");
          if (!hasOtherDelivered) {
            state.status = "ACTIVE";
            state.phase = "2";
          }
        }
        break;
      }
      case "TASK_CANCELLED": {
        const task = state.charter?.tasks[String(event.payload.taskId ?? "")];
        if (task) {
          task.status = "CANCELLED";
          task.reviewStatus = null;
        }
        break;
      }
      case "SETTLEMENT_PROPOSED": {
        state.settlement = {
          proposalId: String(event.payload.proposalId ?? ""),
          status: "PENDING_REVIEW",
          allocations: (event.payload.allocations as Record<string, number>) ?? {}
        };
        state.status = "IN_SETTLEMENT";
        state.phase = "4";
        break;
      }
      case "SETTLEMENT_FINAL":
      case "ROOM_SETTLED": {
        if (state.settlement) {
          state.settlement.status = "FINAL";
        }
        state.status = "SETTLED";
        state.phase = "5";
        break;
      }
      case "DISPUTE_FILED":
      case "DISPUTE_PANELED":
      case "DISPUTE_RESOLVED":
      case "DISPUTE_ESCALATED": {
        const disputeId = String(event.payload.disputeId ?? "");
        const current = state.disputes[disputeId] ?? {
          disputeId,
          status: "COOLING_OFF",
          category: String(event.payload.category ?? ""),
          subType: String(event.payload.subType ?? "")
        };
        if (event.eventType === "DISPUTE_PANELED") {
          current.status = "UNDER_REVIEW";
        } else if (event.eventType === "DISPUTE_RESOLVED") {
          current.status = "RESOLVED";
        } else if (event.eventType === "DISPUTE_ESCALATED") {
          current.status = "ESCALATED_TO_MANUAL";
        } else {
          // DISPUTE_FILED: new disputes enter cooling-off, not immediately OPEN
          current.status = "COOLING_OFF";
        }
        state.disputes[disputeId] = current;
        if (event.eventType === "DISPUTE_RESOLVED") {
          const nextRoomStatus = event.payload.nextRoomStatus as RoomStatus | null | undefined;
          const nextRoomPhase = event.payload.nextRoomPhase as string | null | undefined;
          state.status = nextRoomStatus ?? (state.settlement ? "IN_SETTLEMENT" : "ACTIVE");
          state.phase = nextRoomPhase ?? (state.status === "IN_SETTLEMENT" ? "4" : "2");
        } else {
          state.status = "DISPUTED";
        }
        break;
      }
      case "ROOM_FAILED": {
        state.status = "FAILED";
        break;
      }
      default:
        break;
    }
  }

  return state;
}
