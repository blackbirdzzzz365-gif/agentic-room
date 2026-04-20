import Link from "next/link";
import type { RoomSummary } from "@/types";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/shared/status-badge";

interface RoomCardProps {
  room: RoomSummary;
  href: string;
  className?: string;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface CountPillProps {
  label: string;
  value: number;
}

function CountPill({ label, value }: CountPillProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
      {label}
    </span>
  );
}

export default function RoomCard({ room, href, className }: RoomCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl border border-white/20 bg-white/70 p-5 backdrop-blur-sm",
        "dark:border-white/10 dark:bg-white/5",
        "transition-all duration-200",
        "hover:border-white/40 hover:shadow-lg hover:shadow-black/5",
        "dark:hover:border-white/20 dark:hover:shadow-black/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {room.name}
        </h3>
        <StatusBadge status={room.status} size="sm" className="shrink-0 mt-0.5" />
      </div>

      {/* Phase indicator */}
      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-4 rounded-full transition-colors",
                i < room.phase
                  ? "bg-primary"
                  : i === room.phase
                    ? "bg-primary/50"
                    : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Phase {room.phase}/5
        </span>
      </div>

      {/* Count pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CountPill label="members" value={room.memberCount} />
        <CountPill label="tasks" value={room.taskCount} />
        {room.disputeCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            <span className="font-semibold tabular-nums">{room.disputeCount}</span>
            dispute{room.disputeCount === 1 ? "" : "s"}
          </span>
        )}
        {room.budgetTotal !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {room.budgetTotal.toLocaleString()}
            </span>
            budget
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        {room.executionDeadlineAt ? (
          <span className="text-xs text-muted-foreground">
            Due{" "}
            <time dateTime={room.executionDeadlineAt}>
              {formatDate(room.executionDeadlineAt)}
            </time>
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">
          Updated{" "}
          <time dateTime={room.updatedAt}>{formatDate(room.updatedAt)}</time>
        </span>
      </div>
    </Link>
  );
}
