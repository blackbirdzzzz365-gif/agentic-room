import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type KpiColor = "default" | "green" | "red" | "amber" | "blue";
type KpiTrend = "up" | "down" | "neutral";

interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: KpiTrend;
  color?: KpiColor;
  className?: string;
}

const colorConfig: Record<
  KpiColor,
  { iconBg: string; valueText: string }
> = {
  default: {
    iconBg: "bg-muted text-muted-foreground",
    valueText: "text-foreground",
  },
  green: {
    iconBg: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
    valueText: "text-green-700 dark:text-green-400",
  },
  red: {
    iconBg: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
    valueText: "text-red-700 dark:text-red-400",
  },
  amber: {
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    valueText: "text-amber-700 dark:text-amber-400",
  },
  blue: {
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    valueText: "text-blue-700 dark:text-blue-400",
  },
};

function TrendIcon({ trend }: { trend: KpiTrend }) {
  if (trend === "up") {
    return (
      <svg
        className="h-3.5 w-3.5 text-green-500"
        viewBox="0 0 16 16"
        fill="none"
        aria-label="Trending up"
      >
        <path
          d="M2 12l4-4 3 3 5-6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 5h4v4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (trend === "down") {
    return (
      <svg
        className="h-3.5 w-3.5 text-red-500"
        viewBox="0 0 16 16"
        fill="none"
        aria-label="Trending down"
      >
        <path
          d="M2 4l4 4 3-3 5 6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 11h4v-4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="h-3.5 w-3.5 text-muted-foreground"
      viewBox="0 0 16 16"
      fill="none"
      aria-label="Neutral trend"
    >
      <path
        d="M2 8h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function KpiCard({
  title,
  value,
  description,
  icon,
  trend,
  color = "default",
  className,
}: KpiCardProps) {
  const { iconBg, valueText } = colorConfig[color];

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5",
        "shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground truncate">
            {title}
          </p>

          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className={cn(
                "text-3xl font-bold tabular-nums leading-none tracking-tight",
                valueText
              )}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
            {trend && (
              <span className="flex items-center">
                <TrendIcon trend={trend} />
              </span>
            )}
          </div>

          {description && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "[&>svg]:h-5 [&>svg]:w-5",
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
