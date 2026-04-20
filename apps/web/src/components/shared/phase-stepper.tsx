import { cn } from "@/lib/utils";

const PHASE_LABELS = [
  "Forming",
  "Charter",
  "Active",
  "Review",
  "Settlement",
  "Settled",
] as const;

interface PhaseStepperProps {
  currentPhase: number;
  className?: string;
}

export default function PhaseStepper({
  currentPhase,
  className,
}: PhaseStepperProps) {
  return (
    <nav
      aria-label="Room lifecycle phases"
      className={cn("w-full", className)}
    >
      <ol className="flex items-start">
        {PHASE_LABELS.map((label, index) => {
          const isCompleted = index < currentPhase;
          const isCurrent = index === currentPhase;
          const isFuture = index > currentPhase;
          const isLast = index === PHASE_LABELS.length - 1;

          return (
            <li key={label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Left connector */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    index === 0 ? "invisible" : "",
                    isCompleted || isCurrent
                      ? "bg-primary"
                      : "bg-muted-foreground/20"
                  )}
                />

                {/* Step circle */}
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                    isCompleted &&
                      "bg-primary text-primary-foreground shadow-sm",
                    isCurrent &&
                      "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md",
                    isFuture &&
                      "bg-muted text-muted-foreground border border-muted-foreground/20"
                  )}
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 8l3.5 3.5L13 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span>{index}</span>
                  )}
                </div>

                {/* Right connector */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    isLast ? "invisible" : "",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              </div>

              {/* Label */}
              <span
                className={cn(
                  "mt-2 text-center text-xs leading-tight",
                  isCompleted && "font-medium text-foreground",
                  isCurrent && "font-semibold text-primary",
                  isFuture && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
