import { cn } from "@/lib/utils";

type StatusValue =
  | "FORMING"
  | "PENDING_CHARTER"
  | "ACTIVE"
  | "IN_REVIEW"
  | "IN_SETTLEMENT"
  | "SETTLED"
  | "FAILED"
  | "DISPUTED"
  | "OPEN"
  | "CLAIMED"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "REQUEUED"
  | "BLOCKED"
  | "CANCELLED"
  | "COOLING_OFF"
  | "PANEL_ASSIGNED"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "ESCALATED_TO_MANUAL"
  | "PENDING_REVIEW"
  | "MANUAL_REVIEW"
  | "FINAL"
  | "DRAFT"
  | "CONFIRMED"
  | "EXPIRED"
  | "INVITED"
  | "DECLINED"
  | "INACTIVE"
  | "REMOVED"
  | "ACCEPT"
  | "REJECT"
  | "ABSTAIN"
  | "PENDING"
  | "SIGNED"
  | "DONE"
  | "RUNNING"
  | (string & {});

interface StatusConfig {
  label: string;
  classes: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // RoomStatus
  FORMING: {
    label: "Forming",
    classes:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  PENDING_CHARTER: {
    label: "Pending Charter",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  ACTIVE: {
    label: "Active",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  IN_REVIEW: {
    label: "In Review",
    classes: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  IN_SETTLEMENT: {
    label: "In Settlement",
    classes:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  SETTLED: {
    label: "Settled",
    classes:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  FAILED: {
    label: "Failed",
    classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  DISPUTED: {
    label: "Disputed",
    classes:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },

  // TaskStatus
  OPEN: {
    label: "Open",
    classes:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  CLAIMED: {
    label: "Claimed",
    classes:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  DELIVERED: {
    label: "Delivered",
    classes: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  ACCEPTED: {
    label: "Accepted",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  REQUEUED: {
    label: "Requeued",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  BLOCKED: {
    label: "Blocked",
    classes:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  CANCELLED: {
    label: "Cancelled",
    classes:
      "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400",
  },

  // DisputeStatus
  COOLING_OFF: {
    label: "Cooling Off",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  PANEL_ASSIGNED: {
    label: "Panel Assigned",
    classes:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    classes: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  RESOLVED: {
    label: "Resolved",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  ESCALATED_TO_MANUAL: {
    label: "Escalated",
    classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },

  // SettlementStatus
  PENDING_REVIEW: {
    label: "Pending Review",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  MANUAL_REVIEW: {
    label: "Manual Review",
    classes:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  FINAL: {
    label: "Final",
    classes:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  DRAFT: {
    label: "Draft",
    classes:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  CONFIRMED: {
    label: "Confirmed",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  EXPIRED: {
    label: "Expired",
    classes:
      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  INVITED: {
    label: "Invited",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  DECLINED: {
    label: "Declined",
    classes:
      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  INACTIVE: {
    label: "Inactive",
    classes:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  REMOVED: {
    label: "Removed",
    classes:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  ACCEPT: {
    label: "Accept",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  REJECT: {
    label: "Reject",
    classes:
      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  ABSTAIN: {
    label: "Abstain",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  PENDING: {
    label: "Pending",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  SIGNED: {
    label: "Signed",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  DONE: {
    label: "Done",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  RUNNING: {
    label: "Running",
    classes:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

function formatLabel(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: StatusValue;
  size?: "sm" | "default";
  className?: string;
}

export default function StatusBadge({
  status,
  size = "default",
  className,
}: StatusBadgeProps) {
  const config = STATUS_MAP[status];

  const label = config?.label ?? formatLabel(status);
  const colorClasses =
    config?.classes ??
    "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium leading-none",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        colorClasses,
        className
      )}
    >
      {label}
    </span>
  );
}
