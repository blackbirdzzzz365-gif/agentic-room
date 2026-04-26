"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  ScaleIcon,
  SendIcon,
  ShieldAlertIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { mutateJson } from "@/lib/api";
import type {
  AgentRole,
  Dispute,
  EffortEstimate,
  Member,
  RoomSnapshot,
  SettlementVote,
  Task,
  TaskStatus,
} from "@/types";
import EmptyState from "@/components/shared/empty-state";
import KpiCard from "@/components/shared/kpi-card";
import PhaseStepper from "@/components/shared/phase-stepper";
import StatusBadge from "@/components/shared/status-badge";
import TokenText from "@/components/shared/token-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const MEMBER_ROLES = [
  "COORDINATOR",
  "CONTRIBUTOR",
  "REVIEWER",
  "OBSERVER",
  "PANELIST",
  "ADMIN",
] as const satisfies readonly AgentRole[];

const EFFORT_OPTIONS = ["S", "M", "L", "XL"] as const satisfies readonly EffortEstimate[];
const TASK_COLUMNS: TaskStatus[] = [
  "OPEN",
  "CLAIMED",
  "DELIVERED",
  "ACCEPTED",
  "REJECTED",
  "REQUEUED",
];
const DISPUTE_EVIDENCE_TYPES = [
  "ROOM_EVENT_REF",
  "ARTIFACT_REF",
  "TASK_RECORD_REF",
  "CONSENSUS_ROUND_REF",
] as const;
const DISPUTE_CATEGORIES = ["OPERATIONAL", "ECONOMIC"] as const;
const PEER_SIGNALS = [
  { label: "Negative (-1)", value: -1 },
  { label: "Neutral (0)", value: 0 },
  { label: "Positive (+1)", value: 1 },
] as const;
const SETTLEMENT_VOTES = ["ACCEPT", "REJECT", "ABSTAIN"] as const satisfies readonly SettlementVote[];

const DEFAULT_TIMEOUT_RULES = {
  invitationWindowHours: 48,
  charterSignWindowHours: 24,
  taskClaimWindowHours: 24,
  taskDeliveryWindowHours: 72,
  reviewWindowHours: 24,
  settlementVoteWindowHours: 48,
  disputeCoolingOffHours: 12,
  panelReviewWindowHours: 72,
  disputeResolutionWindowHours: 120,
} as const;

const missionSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
  deliverablesText: z
    .string()
    .min(1, "Add at least one deliverable"),
  successCriteriaText: z.string().optional(),
  constraintsText: z.string().optional(),
  outOfScopeText: z.string().optional(),
});

const inviteMemberSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  identityRef: z.string().optional(),
  role: z.enum(MEMBER_ROLES),
});

const charterSchema = z
  .object({
    bonusPoolPct: z.coerce
      .number()
      .min(0, "Must be at least 0")
      .max(0.2, "Use a ratio between 0 and 0.20"),
    malusPoolPct: z.coerce
      .number()
      .min(0, "Must be at least 0")
      .max(0.1, "Use a ratio between 0 and 0.10"),
    settlementQuorumRatio: z.coerce
      .number()
      .min(0, "Minimum is 0")
      .max(1, "Maximum is 1"),
    settlementAcceptRatio: z.coerce
      .number()
      .min(0, "Minimum is 0")
      .max(1, "Maximum is 1"),
    baselineSplit: z
      .array(
        z.object({
          memberId: z.string().min(1, "Member ID is required"),
          share: z.coerce.number().min(0, "Share must be at least 0"),
        })
      )
      .min(1, "Add at least one baseline participant"),
    tasks: z
      .array(
        z.object({
          title: z.string().min(1, "Title is required"),
          description: z.string().min(1, "Description is required"),
          deliverableSpec: z.string().min(1, "Deliverable spec is required"),
          effortEstimate: z.enum(EFFORT_OPTIONS),
          weight: z.coerce.number().positive("Weight must be greater than 0"),
          dependenciesText: z.string().optional(),
        })
      )
      .min(1, "Add at least one task"),
  })
  .superRefine((values, ctx) => {
    const total = values.baselineSplit.reduce((sum, item) => sum + item.share, 0);
    if (Math.abs(total - 1) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Baseline shares should sum to 1.00",
        path: ["baselineSplit"],
      });
    }
  });

const declineCharterSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

const deliverTaskSchema = z.object({
  contentRef: z.string().min(1, "Deliverable URL or ref is required"),
  contentType: z.string().min(1, "Content type is required"),
});

const reviewTaskSchema = z.object({
  verdict: z.enum(["ACCEPTED", "REJECTED"]),
  notes: z.string().min(1, "Review notes are required"),
});

const peerRatingSchema = z.object({
  targetId: z.string().min(1, "Choose a member"),
  signal: z.coerce.number().int().min(-1).max(1),
});

const requesterRatingSchema = z.object({
  targetId: z.string().min(1, "Choose a member"),
  rating: z.coerce.number().int().min(0).max(10),
});

const settlementVoteSchema = z
  .object({
    vote: z.enum(SETTLEMENT_VOTES),
    reason: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.vote === "REJECT" && !values.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reason is required for reject votes",
        path: ["reason"],
      });
    }
  });

const disputeSchema = z.object({
  category: z.enum(DISPUTE_CATEGORIES),
  subType: z.string().min(1, "Sub-type is required"),
  respondentId: z.string().min(1, "Respondent ID is required"),
  remedySought: z.string().min(1, "Remedy sought is required"),
  evidence: z
    .array(
      z.object({
        type: z.enum(DISPUTE_EVIDENCE_TYPES),
        ledgerRef: z.string().min(1, "Ledger reference is required"),
      })
    )
    .min(1, "Add at least one evidence row"),
});

type MissionValues = z.infer<typeof missionSchema>;
type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
type CharterValues = z.infer<typeof charterSchema>;
type DeclineCharterValues = z.infer<typeof declineCharterSchema>;
type DeliverTaskValues = z.infer<typeof deliverTaskSchema>;
type ReviewTaskValues = z.infer<typeof reviewTaskSchema>;
type PeerRatingValues = z.infer<typeof peerRatingSchema>;
type RequesterRatingValues = z.infer<typeof requesterRatingSchema>;
type SettlementVoteValues = z.infer<typeof settlementVoteSchema>;
type DisputeValues = z.infer<typeof disputeSchema>;

function formatDate(iso?: string) {
  if (!iso) {
    return "—";
  }

  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso?: string) {
  if (!iso) {
    return "—";
  }

  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBudget(value?: number) {
  return value !== undefined ? value.toLocaleString() : "—";
}

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 12)}…` : value;
}

function parseListInput(value?: string) {
  return (value ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function stringifyList(items?: string[]) {
  return (items ?? []).join("\n");
}

function buildMissionPayload(values: MissionValues) {
  const deliverables = parseListInput(values.deliverablesText);
  const successCriteria = parseListInput(values.successCriteriaText);
  const constraints = parseListInput(values.constraintsText);
  const outOfScope = parseListInput(values.outOfScopeText);

  return {
    rawInput: [
      `Objective: ${values.objective}`,
      deliverables.length > 0
        ? `Deliverables: ${deliverables.join(", ")}`
        : undefined,
      successCriteria.length > 0
        ? `Success criteria: ${successCriteria.join(", ")}`
        : undefined,
      constraints.length > 0
        ? `Constraints: ${constraints.join(", ")}`
        : undefined,
      outOfScope.length > 0 ? `Out of scope: ${outOfScope.join(", ")}` : undefined,
    ]
      .filter(Boolean)
      .join("\n"),
    structured: {
      objective: values.objective,
      deliverables,
      successCriteria,
      constraints,
      outOfScope,
    },
  };
}

function getBaselineParticipants(room: RoomSnapshot) {
  const preferred = room.members
    .filter((member) => member.status === "ACTIVE")
    .map((member) => member.memberId);
  const fallbacks = [room.requesterId, room.coordinatorId].filter(
    (value): value is string => Boolean(value)
  );
  const combined = [...preferred, ...fallbacks];

  if (combined.length > 0) {
    return Array.from(new Set(combined));
  }

  return Array.from(new Set(room.members.map((member) => member.memberId)));
}

function createBaselineFields(room: RoomSnapshot) {
  const participants = getBaselineParticipants(room);
  if (participants.length === 0) {
    return [{ memberId: "member-id", share: 1 }];
  }

  let remaining = 1;
  return participants.map((memberId, index) => {
    const share =
      index === participants.length - 1
        ? Number(remaining.toFixed(4))
        : Number((1 / participants.length).toFixed(4));
    remaining -= share;

    return {
      memberId,
      share,
    };
  });
}

function useRefreshAction() {
  const router = useRouter();
  return () => router.refresh();
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function DialogSubmitButton({
  submitting,
  children,
}: {
  submitting: boolean;
  children: ReactNode;
}) {
  return (
    <Button type="submit" disabled={submitting} className="gap-2">
      {submitting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

export default function RoomDetailClient({ room }: { room: RoomSnapshot }) {
  const refresh = useRefreshAction();

  const completedTasks = room.tasks.filter((task) =>
    ["ACCEPTED", "DELIVERED"].includes(task.status)
  ).length;
  const completionPct =
    room.tasks.length > 0
      ? Math.round((completedTasks / room.tasks.length) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/rooms">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Rooms
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {room.name}
            </h1>
            <StatusBadge status={room.status} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{room.id}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">
              Budget {formatBudget(room.budgetTotal)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1">
              Deadline {formatDate(room.executionDeadlineAt)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1">
              {room.members.length} members
            </span>
            <span className="rounded-full bg-muted px-3 py-1">
              {room.tasks.length} tasks
            </span>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <PhaseStepper currentPhase={room.phase} />
        </CardContent>
      </Card>

      {room.integrity && !room.integrity.valid && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Replay verification reported {room.integrity.invalidRoomCount} invalid room
          {room.integrity.invalidRoomCount === 1 ? "" : "s"} in the current snapshot.
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <ScrollArea className="w-full">
          <TabsList className="flex h-auto w-full min-w-max gap-2 rounded-xl bg-muted/60 p-2">
            {[
              "overview",
              "mission",
              "members",
              "charter",
              "tasks",
              "settlement",
              "disputes",
              "events",
            ].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-lg capitalize"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        <TabsContent value="overview">
          <OverviewTab room={room} completionPct={completionPct} />
        </TabsContent>
        <TabsContent value="mission">
          <MissionTab room={room} onSuccess={refresh} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab room={room} onSuccess={refresh} />
        </TabsContent>
        <TabsContent value="charter">
          <CharterTab room={room} onSuccess={refresh} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab room={room} onSuccess={refresh} />
        </TabsContent>
        <TabsContent value="settlement">
          <SettlementTab room={room} onSuccess={refresh} />
        </TabsContent>
        <TabsContent value="disputes">
          <DisputesTab room={room} onSuccess={refresh} />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab room={room} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({
  room,
  completionPct,
}: {
  room: RoomSnapshot;
  completionPct: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Budget" value={formatBudget(room.budgetTotal)} color="blue" />
        <KpiCard
          title="Execution Deadline"
          value={formatDate(room.executionDeadlineAt)}
          color="amber"
        />
        <KpiCard title="Members" value={room.members.length} color="green" />
        <KpiCard
          title="Task Progress"
          value={`${completionPct}%`}
          color={completionPct === 100 ? "green" : "default"}
          description={`${room.tasks.filter((task) => task.status === "ACCEPTED").length} accepted`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mission Summary</CardTitle>
            <CardDescription>Current structured mission for this room.</CardDescription>
          </CardHeader>
          <CardContent>
            {room.mission ? (
              <div className="space-y-3">
                <StatusBadge status={room.mission.status} size="sm" />
                <p className="text-sm leading-relaxed text-foreground">
                  <TokenText text={room.mission.objective} speed={4} />
                </p>
                {room.mission.deliverables.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {room.mission.deliverables.map((deliverable) => (
                      <Badge key={deliverable} variant="outline">
                        {deliverable}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<FileTextIcon />}
                title="No mission drafted"
                description="Draft mission structure before the charter is created."
                className="px-0 py-6"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Events</CardTitle>
            <CardDescription>Latest ledger events from this room.</CardDescription>
          </CardHeader>
          <CardContent>
            {room.events.length === 0 ? (
              <EmptyState
                title="No events recorded"
                description="Room events will appear here as the workflow advances."
                className="px-0 py-6"
              />
            ) : (
              <div className="space-y-3">
                {room.events.slice(-5).reverse().map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{event.type}</Badge>
                      {event.actorId && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortId(event.actorId)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DraftMissionDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<MissionValues>({
    resolver: zodResolver(missionSchema),
    defaultValues: {
      objective: room.mission?.objective ?? "",
      deliverablesText: stringifyList(room.mission?.deliverables),
      successCriteriaText: stringifyList(room.mission?.successCriteria),
      constraintsText: stringifyList(room.mission?.constraints),
      outOfScopeText: stringifyList(room.mission?.outOfScope),
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = buildMissionPayload(values);
    const { error } = await mutateJson(`/api/rooms/${room.id}/mission/draft`, payload);

    if (error) {
      toast.error("Failed to draft mission", { description: error });
      return;
    }

    toast.success("Mission draft saved");
    setOpen(false);
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileTextIcon className="h-4 w-4" />
          {room.mission ? "Edit Mission" : "Draft Mission"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Draft Mission</DialogTitle>
          <DialogDescription>
            One item per line for deliverables, success criteria, constraints, and out-of-scope.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mission-objective">Objective</Label>
            <Textarea id="mission-objective" rows={4} {...form.register("objective")} />
            {form.formState.errors.objective && (
              <p className="text-xs text-destructive">
                {form.formState.errors.objective.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mission-deliverables">Deliverables</Label>
              <Textarea id="mission-deliverables" rows={4} {...form.register("deliverablesText")} />
              {form.formState.errors.deliverablesText && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.deliverablesText.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mission-success">Success Criteria</Label>
              <Textarea id="mission-success" rows={4} {...form.register("successCriteriaText")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mission-constraints">Constraints</Label>
              <Textarea id="mission-constraints" rows={4} {...form.register("constraintsText")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mission-oos">Out of Scope</Label>
              <Textarea id="mission-oos" rows={4} {...form.register("outOfScopeText")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Save Draft
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MissionTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const handleConfirm = async () => {
    if (!room.mission) {
      return;
    }

    const payload = {
      rawInput: room.mission.rawInput ?? room.mission.objective,
      structured: {
        objective: room.mission.objective,
        deliverables: room.mission.deliverables,
        successCriteria: room.mission.successCriteria,
        constraints: room.mission.constraints,
        outOfScope: room.mission.outOfScope,
      },
    };

    const { error } = await mutateJson(`/api/rooms/${room.id}/mission/confirm`, payload);

    if (error) {
      toast.error("Failed to confirm mission", { description: error });
      return;
    }

    toast.success("Mission confirmed");
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Mission"
        description="Draft and confirm the structured mission payload before charter creation."
        action={
          <div className="flex flex-wrap gap-2">
            {room.mission?.status === "DRAFT" && (
              <Button onClick={handleConfirm}>Confirm Mission</Button>
            )}
            <DraftMissionDialog room={room} onSuccess={onSuccess} />
          </div>
        }
      />

      {!room.mission ? (
        <EmptyState
          icon={<FileTextIcon />}
          title="No mission drafted"
          description="Create the mission structure first so members can align on the room objective."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Objective</CardTitle>
              <CardDescription>
                <StatusBadge status={room.mission.status} size="sm" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">
                <TokenText text={room.mission.objective} speed={4} />
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deliverables</CardTitle>
            </CardHeader>
            <CardContent>
              {room.mission.deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliverables listed.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {room.mission.deliverables.map((item) => (
                    <li key={item} className="rounded-lg bg-muted/30 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Success Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              {room.mission.successCriteria.length === 0 ? (
                <p className="text-sm text-muted-foreground">No success criteria listed.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {room.mission.successCriteria.map((item) => (
                    <li key={item} className="rounded-lg bg-muted/30 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Constraints</CardTitle>
            </CardHeader>
            <CardContent>
              {room.mission.constraints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No constraints listed.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {room.mission.constraints.map((item) => (
                    <li key={item} className="rounded-lg bg-muted/30 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Out of Scope</CardTitle>
            </CardHeader>
            <CardContent>
              {room.mission.outOfScope.length === 0 ? (
                <p className="text-sm text-muted-foreground">No out-of-scope notes listed.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {room.mission.outOfScope.map((item) => (
                    <li key={item} className="rounded-lg bg-muted/30 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function InviteMemberDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      memberId: "",
      identityRef: "",
      role: "CONTRIBUTOR",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(`/api/rooms/${room.id}/members/invite`, {
      memberId: values.memberId,
      identityRef: values.identityRef?.trim() || values.memberId,
      role: values.role,
    });

    if (error) {
      toast.error("Failed to invite member", { description: error });
      return;
    }

    toast.success("Member invited");
    setOpen(false);
    form.reset();
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            FE sends business identity only. API is responsible for actor injection.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-id">Member ID</Label>
            <Input id="member-id" {...form.register("memberId")} />
            {form.formState.errors.memberId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.memberId.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="identity-ref">Identity Ref (optional)</Label>
            <Input id="identity-ref" {...form.register("identityRef")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-role">Role</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Send Invite
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MembersTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const handleDecision = async (member: Member, action: "accept" | "decline") => {
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/members/${member.memberId}/${action}`,
      {}
    );

    if (error) {
      toast.error(`Failed to ${action} invitation`, { description: error });
      return;
    }

    toast.success(action === "accept" ? "Invitation accepted" : "Invitation declined");
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Members"
        description="Invite collaborators and accept or decline membership invitations."
        action={<InviteMemberDialog room={room} onSuccess={onSuccess} />}
      />

      {room.members.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No members yet"
          description="Invite the initial contributors and reviewers for this room."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {room.members.map((member) => (
                    <tr key={member.memberId}>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-foreground">
                            {member.memberId}
                          </p>
                          {member.identityRef && (
                            <p className="text-xs text-muted-foreground">
                              {member.identityRef}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline">{member.role}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={member.status} size="sm" />
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDate(member.joinedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {member.status === "INVITED" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDecision(member, "accept")}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDecision(member, "decline")}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CreateCharterDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<CharterValues>({
    resolver: zodResolver(charterSchema) as Resolver<CharterValues>,
    defaultValues: {
      bonusPoolPct: 0.1,
      malusPoolPct: 0.05,
      settlementQuorumRatio: 0.6,
      settlementAcceptRatio: 0.6666666667,
      baselineSplit: createBaselineFields(room),
      tasks: [
        {
          title: "",
          description: "",
          deliverableSpec: "",
          effortEstimate: "M",
          weight: 1,
          dependenciesText: "",
        },
      ],
    },
  });

  const baselineFieldArray = useFieldArray({
    control: form.control,
    name: "baselineSplit",
  });
  const taskFieldArray = useFieldArray({
    control: form.control,
    name: "tasks",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(`/api/rooms/${room.id}/charters`, {
      draft: {
        version: 1,
        tasks: values.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          deliverableSpec: task.deliverableSpec,
          effortEstimate: task.effortEstimate,
          weight: task.weight,
          dependencies: parseListInput(task.dependenciesText),
        })),
        baselineSplit: Object.fromEntries(
          values.baselineSplit.map((entry) => [entry.memberId, entry.share])
        ),
        bonusPoolPct: values.bonusPoolPct,
        malusPoolPct: values.malusPoolPct,
        consensusConfig: {
          settlementQuorumRatio: values.settlementQuorumRatio,
          settlementAcceptRatio: values.settlementAcceptRatio,
        },
        timeoutRules: DEFAULT_TIMEOUT_RULES,
      },
    });

    if (error) {
      toast.error("Failed to create charter", { description: error });
      return;
    }

    toast.success("Charter created");
    setOpen(false);
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <ClipboardListIcon className="h-4 w-4" />
          Create Charter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Charter</DialogTitle>
          <DialogDescription>
            Sends the contract-compliant `draft` payload, including baseline split, consensus config, and timeout rules.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="bonus-pool-pct">Bonus Pool Ratio</Label>
              <Input id="bonus-pool-pct" type="number" step="0.01" {...form.register("bonusPoolPct")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="malus-pool-pct">Malus Pool Ratio</Label>
              <Input id="malus-pool-pct" type="number" step="0.01" {...form.register("malusPoolPct")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settlement-quorum">Settlement Quorum Ratio</Label>
              <Input id="settlement-quorum" type="number" step="0.01" {...form.register("settlementQuorumRatio")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settlement-accept">Settlement Accept Ratio</Label>
              <Input id="settlement-accept" type="number" step="0.01" {...form.register("settlementAcceptRatio")} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Baseline Split</h3>
                <p className="text-xs text-muted-foreground">
                  Shares should sum to 1.00.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  baselineFieldArray.append({
                    memberId: "",
                    share: 0,
                  })
                }
              >
                Add Participant
              </Button>
            </div>

            {baselineFieldArray.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <Input
                  placeholder="member-id"
                  {...form.register(`baselineSplit.${index}.memberId`)}
                />
                <Input
                  type="number"
                  step="0.01"
                  {...form.register(`baselineSplit.${index}.share`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={baselineFieldArray.fields.length === 1}
                  onClick={() => baselineFieldArray.remove(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {form.formState.errors.baselineSplit?.root?.message && (
              <p className="text-xs text-destructive">
                {form.formState.errors.baselineSplit.root.message}
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Task Definitions</h3>
                <p className="text-xs text-muted-foreground">
                  Dependencies are optional, one task ID per line.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  taskFieldArray.append({
                    title: "",
                    description: "",
                    deliverableSpec: "",
                    effortEstimate: "M",
                    weight: 1,
                    dependenciesText: "",
                  })
                }
              >
                Add Task
              </Button>
            </div>

            <ScrollArea className="max-h-[50vh] pr-3">
              <div className="space-y-4">
                {taskFieldArray.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        Task {index + 1}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={taskFieldArray.fields.length === 1}
                        onClick={() => taskFieldArray.remove(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        placeholder="Title"
                        {...form.register(`tasks.${index}.title`)}
                      />
                      <Input
                        placeholder="Deliverable spec"
                        {...form.register(`tasks.${index}.deliverableSpec`)}
                      />
                      <Controller
                        control={form.control}
                        name={`tasks.${index}.effortEstimate`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EFFORT_OPTIONS.map((effort) => (
                                <SelectItem key={effort} value={effort}>
                                  {effort}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Input
                        type="number"
                        min={1}
                        placeholder="Weight"
                        {...form.register(`tasks.${index}.weight`)}
                      />
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="Description"
                      {...form.register(`tasks.${index}.description`)}
                    />
                    <Textarea
                      rows={2}
                      placeholder="Dependencies (one task ID per line)"
                      {...form.register(`tasks.${index}.dependenciesText`)}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Create Charter
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeclineCharterDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<DeclineCharterValues>({
    resolver: zodResolver(declineCharterSchema),
    defaultValues: {
      reason: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!room.charter) {
      return;
    }

    const { error } = await mutateJson(
      `/api/rooms/${room.id}/charters/${room.charter.id}/decline`,
      { reason: values.reason }
    );

    if (error) {
      toast.error("Failed to decline charter", { description: error });
      return;
    }

    toast.success("Charter declined");
    setOpen(false);
    form.reset();
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Decline Charter</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Charter</DialogTitle>
          <DialogDescription>
            The decline payload must include a reason.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="charter-decline-reason">Reason</Label>
            <Textarea id="charter-decline-reason" rows={4} {...form.register("reason")} />
            {form.formState.errors.reason && (
              <p className="text-xs text-destructive">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Submit Decline
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CharterTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const handleSign = async () => {
    if (!room.charter) {
      return;
    }

    const { error } = await mutateJson(
      `/api/rooms/${room.id}/charters/${room.charter.id}/sign`,
      {}
    );

    if (error) {
      toast.error("Failed to sign charter", { description: error });
      return;
    }

    toast.success("Charter signed");
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Charter"
        description="Defines the delivery plan, baseline split, and settlement consensus settings."
        action={
          room.charter ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSign}>Sign Charter</Button>
              <DeclineCharterDialog room={room} onSuccess={onSuccess} />
            </div>
          ) : (
            <CreateCharterDialog room={room} onSuccess={onSuccess} />
          )
        }
      />

      {!room.charter ? (
        <EmptyState
          icon={<ClipboardListIcon />}
          title="No charter created"
          description="Create the charter once the mission is confirmed and the baseline contributors are known."
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charter Summary</CardTitle>
              <CardDescription>
                <StatusBadge status={room.charter.status} size="sm" />
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Bonus Pool
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {room.charter.bonusPoolPct}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Malus Pool
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {room.charter.malusPoolPct}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tasks
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {room.charter.tasks.length}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Sign Deadline
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatDate(room.charter.signDeadline)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Created
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatDate(room.charter.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Baseline Split</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(room.charter.baselineSplit).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No baseline split entries in the snapshot.
                  </p>
                ) : (
                  Object.entries(room.charter.baselineSplit).map(([memberId, share]) => (
                    <div
                      key={memberId}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                    >
                      <span className="font-mono text-xs text-foreground">{memberId}</span>
                      <span className="text-sm font-semibold text-foreground">{share}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signature State</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {room.members.map((member) => {
                  const signature = room.charter?.signatures[member.memberId];
                  return (
                    <div
                      key={member.memberId}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                    >
                      <div>
                        <p className="font-mono text-xs text-foreground">{member.memberId}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                      {signature ? (
                        <div className="text-right">
                          <StatusBadge status={signature.status} size="sm" />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(signature.signedAt ?? signature.declinedAt)}
                          </p>
                        </div>
                      ) : (
                        <StatusBadge status="PENDING" size="sm" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Definitions</CardTitle>
            </CardHeader>
            <CardContent>
              {room.charter.tasks.length === 0 ? (
                <EmptyState
                  title="No charter tasks"
                  description="The current snapshot did not expose any charter task definitions."
                  className="px-0 py-8"
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {room.charter.tasks.map((task) => (
                    <div
                      key={task.id ?? task.title}
                      className="rounded-2xl border border-border/60 bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{task.title}</p>
                        <Badge variant="outline">{task.effortEstimate}</Badge>
                        <Badge variant="outline">Weight {task.weight}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>
                      {task.deliverableSpec && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Deliverable: {task.deliverableSpec}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DeliverTaskDialog({
  roomId,
  task,
  onSuccess,
}: {
  roomId: string;
  task: Task;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<DeliverTaskValues>({
    resolver: zodResolver(deliverTaskSchema),
    defaultValues: {
      contentRef: task.deliverableUrl ?? "",
      contentType: task.deliverableContentType ?? "text/uri-list",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(
      `/api/rooms/${roomId}/tasks/${task.id}/deliver`,
      values
    );

    if (error) {
      toast.error("Failed to deliver task", { description: error });
      return;
    }

    toast.success("Task delivered");
    setOpen(false);
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Deliver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deliver Task</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`content-ref-${task.id}`}>Content Ref</Label>
            <Input id={`content-ref-${task.id}`} {...form.register("contentRef")} />
            {form.formState.errors.contentRef && (
              <p className="text-xs text-destructive">
                {form.formState.errors.contentRef.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`content-type-${task.id}`}>Content Type</Label>
            <Input id={`content-type-${task.id}`} {...form.register("contentType")} />
            {form.formState.errors.contentType && (
              <p className="text-xs text-destructive">
                {form.formState.errors.contentType.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Submit Delivery
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewTaskDialog({
  roomId,
  task,
  onSuccess,
}: {
  roomId: string;
  task: Task;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ReviewTaskValues>({
    resolver: zodResolver(reviewTaskSchema),
    defaultValues: {
      verdict: "ACCEPTED",
      notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(
      `/api/rooms/${roomId}/tasks/${task.id}/review`,
      values
    );

    if (error) {
      toast.error("Failed to review task", { description: error });
      return;
    }

    toast.success("Task review submitted");
    setOpen(false);
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Task</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {task.deliverableUrl && (
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Latest deliverable</p>
              <a
                href={task.deliverableUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-primary underline underline-offset-4"
              >
                {task.deliverableUrl}
              </a>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`review-verdict-${task.id}`}>Verdict</Label>
            <Controller
              control={form.control}
              name="verdict"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`review-verdict-${task.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACCEPTED">ACCEPTED</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`review-notes-${task.id}`}>Notes</Label>
            <Textarea id={`review-notes-${task.id}`} rows={4} {...form.register("notes")} />
            {form.formState.errors.notes && (
              <p className="text-xs text-destructive">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Submit Review
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({
  roomId,
  task,
  onSuccess,
}: {
  roomId: string;
  task: Task;
  onSuccess: () => void;
}) {
  const handleSimpleMutation = async (
    path: string,
    successMessage: string
  ) => {
    const { error } = await mutateJson(path, {});

    if (error) {
      toast.error("Task mutation failed", { description: error });
      return;
    }

    toast.success(successMessage);
    onSuccess();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{task.title}</p>
          {task.effortEstimate && <Badge variant="outline">{task.effortEstimate}</Badge>}
          {task.weight !== undefined && <Badge variant="outline">Weight {task.weight}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{task.description}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {task.assigneeId && (
          <span className="rounded-full bg-muted px-2.5 py-1 font-mono">
            {shortId(task.assigneeId)}
          </span>
        )}
        {task.deliveryDeadline && (
          <span className="rounded-full bg-muted px-2.5 py-1">
            Due {formatDate(task.deliveryDeadline)}
          </span>
        )}
      </div>

      {task.deliverableUrl && (
        <a
          href={task.deliverableUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-primary underline underline-offset-4"
        >
          {task.deliverableUrl}
        </a>
      )}

      <div className="flex flex-wrap gap-2">
        {(task.status === "OPEN" || task.status === "REQUEUED") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleSimpleMutation(
                `/api/rooms/${roomId}/tasks/${task.id}/claim`,
                "Task claimed"
              )
            }
          >
            Claim
          </Button>
        )}
        {task.status === "CLAIMED" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleSimpleMutation(
                  `/api/rooms/${roomId}/tasks/${task.id}/unclaim`,
                  "Task unclaimed"
                )
              }
            >
              Unclaim
            </Button>
            <DeliverTaskDialog roomId={roomId} task={task} onSuccess={onSuccess} />
          </>
        )}
        {task.status === "DELIVERED" && (
          <ReviewTaskDialog roomId={roomId} task={task} onSuccess={onSuccess} />
        )}
      </div>
    </div>
  );
}

function TasksTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const tasksByStatus = (status: TaskStatus) =>
    room.tasks.filter((task) => task.status === status);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tasks"
        description="Claim, unclaim, deliver, and review tasks using the FE-BE integration contract."
      />

      {room.tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardListIcon />}
          title="No tasks available"
          description="Tasks appear after the charter is created."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {TASK_COLUMNS.map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <StatusBadge status={status} size="sm" />
                <span className="text-xs text-muted-foreground">
                  {tasksByStatus(status).length}
                </span>
              </div>
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
                {tasksByStatus(status).length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No tasks
                  </p>
                ) : (
                  tasksByStatus(status).map((task) => (
                    <TaskCard
                      key={task.id}
                      roomId={room.id}
                      task={task}
                      onSuccess={onSuccess}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PeerRatingDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const candidateMembers = room.members.filter((member) => member.status === "ACTIVE");
  const form = useForm<PeerRatingValues>({
    resolver: zodResolver(peerRatingSchema) as Resolver<PeerRatingValues>,
    defaultValues: {
      targetId: candidateMembers[0]?.memberId ?? "",
      signal: 1,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(`/api/rooms/${room.id}/ratings/peer`, values);

    if (error) {
      toast.error("Failed to submit peer rating", { description: error });
      return;
    }

    toast.success("Peer rating submitted");
    setOpen(false);
    form.reset();
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Peer Rating</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Peer Rating</DialogTitle>
          <DialogDescription>
            Canonical contract uses numeric signals from -1 to 1.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="peer-target">Target Member</Label>
            <Controller
              control={form.control}
              name="targetId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="peer-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateMembers.map((member) => (
                      <SelectItem key={member.memberId} value={member.memberId}>
                        {member.memberId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="peer-signal">Signal</Label>
            <Controller
              control={form.control}
              name="signal"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger id="peer-signal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PEER_SIGNALS.map((signal) => (
                      <SelectItem key={signal.value} value={String(signal.value)}>
                        {signal.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Submit Rating
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequesterRatingDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const candidateMembers = room.members.filter((member) => member.status === "ACTIVE");
  const form = useForm<RequesterRatingValues>({
    resolver: zodResolver(requesterRatingSchema) as Resolver<RequesterRatingValues>,
    defaultValues: {
      targetId: candidateMembers[0]?.memberId ?? "",
      rating: 8,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/ratings/requester`,
      values
    );

    if (error) {
      toast.error("Failed to submit requester rating", { description: error });
      return;
    }

    toast.success("Requester rating submitted");
    setOpen(false);
    form.reset();
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Requester Rating</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Requester Rating</DialogTitle>
          <DialogDescription>
            Contract range is 0 to 10.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="requester-target">Target Member</Label>
            <Controller
              control={form.control}
              name="targetId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="requester-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateMembers.map((member) => (
                      <SelectItem key={member.memberId} value={member.memberId}>
                        {member.memberId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requester-rating">Rating</Label>
            <Input id="requester-rating" type="number" min={0} max={10} {...form.register("rating")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Submit Rating
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettlementVoteDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<SettlementVoteValues>({
    resolver: zodResolver(settlementVoteSchema),
    defaultValues: {
      vote: "ACCEPT",
      reason: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!room.settlement) {
      return;
    }

    const { error } = await mutateJson(`/api/rooms/${room.id}/settlement/votes`, {
      proposalId: room.settlement.id,
      vote: values.vote,
      reason: values.reason?.trim() || undefined,
    });

    if (error) {
      toast.error("Failed to submit settlement vote", { description: error });
      return;
    }

    toast.success("Settlement vote submitted");
    setOpen(false);
    form.reset();
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Vote on Settlement</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vote on Settlement</DialogTitle>
          <DialogDescription>
            Proposal ID is taken from the current settlement payload.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settlement-vote">Vote</Label>
            <Controller
              control={form.control}
              name="vote"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="settlement-vote">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_VOTES.map((vote) => (
                      <SelectItem key={vote} value={vote}>
                        {vote}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settlement-reason">Reason</Label>
            <Textarea id="settlement-reason" rows={4} {...form.register("reason")} />
            {form.formState.errors.reason && (
              <p className="text-xs text-destructive">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              Submit Vote
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettlementTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const handleProposeSettlement = async () => {
    const { error } = await mutateJson(`/api/rooms/${room.id}/settlement/propose`, {});

    if (error) {
      toast.error("Failed to generate settlement", { description: error });
      return;
    }

    toast.success("Settlement generation requested");
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settlement"
        description="Submit ratings, trigger settlement generation, and vote on the current proposal."
        action={
          <div className="flex flex-wrap gap-2">
            <PeerRatingDialog room={room} onSuccess={onSuccess} />
            <RequesterRatingDialog room={room} onSuccess={onSuccess} />
            {!room.settlement ? (
              <Button onClick={handleProposeSettlement} className="gap-2">
                <ScaleIcon className="h-4 w-4" />
                Generate Settlement
              </Button>
            ) : (
              <SettlementVoteDialog room={room} onSuccess={onSuccess} />
            )}
          </div>
        }
      />

      {!room.settlement ? (
        <EmptyState
          icon={<WalletIcon />}
          title="No settlement proposal yet"
          description="Once tasks and ratings are in place, trigger system-generated settlement from the UI."
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settlement Summary</CardTitle>
              <CardDescription>
                Proposed {formatDateTime(room.settlement.proposedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <StatusBadge status={room.settlement.status} />
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                Proposal {room.settlement.id}
              </span>
              {room.settlement.finalizedAt && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Finalized {formatDate(room.settlement.finalizedAt)}
                </span>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Allocations</CardTitle>
              </CardHeader>
              <CardContent>
                {room.settlement.allocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No allocations returned in the snapshot.</p>
                ) : (
                  <div className="space-y-3">
                    {room.settlement.allocations.map((allocation) => (
                      <div
                        key={allocation.memberId}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                      >
                        <span className="font-mono text-xs text-foreground">
                          {allocation.memberId}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {allocation.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Votes</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(room.settlement.votes).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No votes submitted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(room.settlement.votes).map(([agentId, vote]) => (
                      <div
                        key={agentId}
                        className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-mono text-xs text-foreground">{agentId}</span>
                          <StatusBadge status={vote.vote} size="sm" />
                        </div>
                        {vote.reason && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {vote.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function FileDisputeDialog({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<DisputeValues>({
    resolver: zodResolver(disputeSchema),
    defaultValues: {
      category: "OPERATIONAL",
      subType: "",
      respondentId: room.members[0]?.memberId ?? "",
      remedySought: "",
      evidence: [
        {
          type: "ROOM_EVENT_REF",
          ledgerRef: room.events[room.events.length - 1]?.id ?? "",
        },
      ],
    },
  });

  const evidenceFieldArray = useFieldArray({
    control: form.control,
    name: "evidence",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(`/api/rooms/${room.id}/disputes`, values);

    if (error) {
      toast.error("Failed to file dispute", { description: error });
      return;
    }

    toast.success("Dispute filed");
    setOpen(false);
    onSuccess();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <ShieldAlertIcon className="h-4 w-4" />
          File Dispute
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>File Dispute</DialogTitle>
          <DialogDescription>
            Evidence payload is ledger-oriented: each row requires `{`type, ledgerRef`}`.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dispute-category">Category</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="dispute-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPUTE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispute-respondent">Respondent ID</Label>
              <Input id="dispute-respondent" {...form.register("respondentId")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dispute-subtype">Sub-type</Label>
            <Input id="dispute-subtype" {...form.register("subType")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dispute-remedy">Remedy Sought</Label>
            <Textarea id="dispute-remedy" rows={3} {...form.register("remedySought")} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Evidence</h3>
                <p className="text-xs text-muted-foreground">
                  Use room event IDs, artifact IDs, or other ledger refs exposed in the current snapshot.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  evidenceFieldArray.append({
                    type: "ROOM_EVENT_REF",
                    ledgerRef: "",
                  })
                }
              >
                Add Evidence
              </Button>
            </div>

            {evidenceFieldArray.fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 md:grid-cols-[220px_1fr_auto]"
              >
                <Controller
                  control={form.control}
                  name={`evidence.${index}.type`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISPUTE_EVIDENCE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Input
                  placeholder="Ledger reference"
                  {...form.register(`evidence.${index}.ledgerRef`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={evidenceFieldArray.fields.length === 1}
                  onClick={() => evidenceFieldArray.remove(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <DialogSubmitButton submitting={form.formState.isSubmitting}>
              File Dispute
            </DialogSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function renderResolution(dispute: Dispute) {
  if (!dispute.resolution) {
    return null;
  }

  if (typeof dispute.resolution === "string") {
    return dispute.resolution;
  }

  return JSON.stringify(dispute.resolution, null, 2);
}

function DisputesTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Disputes"
        description="File ledger-backed disputes without inventing richer evidence objects than the contract supports."
        action={<FileDisputeDialog room={room} onSuccess={onSuccess} />}
      />

      {room.disputes.length === 0 ? (
        <EmptyState
          icon={<ShieldAlertIcon />}
          title="No disputes filed"
          description="Use the dispute form when operational or economic issues need formal escalation."
        />
      ) : (
        <div className="space-y-3">
          {room.disputes.map((dispute) => (
            <Card key={dispute.id}>
              <Accordion type="single" collapsible>
                <AccordionItem value={dispute.id} className="border-none">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline">
                    <div className="flex flex-1 flex-wrap items-center gap-3 text-left">
                      <StatusBadge status={dispute.status} size="sm" />
                      <Badge variant="outline">{dispute.category}</Badge>
                      {dispute.subType && (
                        <span className="text-xs text-muted-foreground">
                          {dispute.subType}
                        </span>
                      )}
                      <span className="font-mono text-xs text-muted-foreground">
                        {shortId(dispute.respondentId)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDateTime(dispute.filedAt)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Remedy Sought
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {dispute.remedySought ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Evidence
                        </p>
                        {dispute.evidence.length === 0 ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Snapshot did not include evidence rows.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {dispute.evidence.map((evidence, index) => (
                              <div
                                key={`${evidence.type}-${evidence.ledgerRef}-${index}`}
                                className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                              >
                                <p className="text-xs font-semibold text-foreground">
                                  {evidence.type}
                                </p>
                                <p className="mt-1 font-mono text-xs text-muted-foreground">
                                  {evidence.ledgerRef}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {dispute.panelIds.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Panel
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {dispute.panelIds.map((panelist) => (
                              <Badge key={panelist} variant="outline">
                                {panelist}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {renderResolution(dispute) && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Resolution
                          </p>
                          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                            {renderResolution(dispute)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsTab({ room }: { room: RoomSnapshot }) {
  const events = room.events.slice().reverse();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Events"
        description="Chronological ledger events rendered directly from normalized snapshot data."
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<SendIcon />}
          title="No room events"
          description="Events will stream into the room ledger as actions are completed."
        />
      ) : (
        <ScrollArea className="h-[640px] pr-2">
          <div className="space-y-3">
            {events.map((event, index) => (
              <Card key={event.id}>
                <Accordion type="single" collapsible>
                  <AccordionItem value={event.id} className="border-none">
                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center gap-3 text-left">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{events.length - index}
                        </span>
                        <Badge variant="outline">{event.type}</Badge>
                        {event.actorId && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {shortId(event.actorId)}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <AccordionContent className="px-4 pb-4">
                        <pre className="whitespace-pre-wrap rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </AccordionContent>
                    )}
                  </AccordionItem>
                </Accordion>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
