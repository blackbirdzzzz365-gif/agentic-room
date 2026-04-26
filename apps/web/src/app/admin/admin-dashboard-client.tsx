"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "lucide-react";

import { mutateJson, readProxyJson } from "@/lib/api";
import type {
  AdminDispute,
  AdminRoom,
  IntegritySummary,
  Job,
  Metrics,
} from "@/types";
import EmptyState from "@/components/shared/empty-state";
import KpiCard from "@/components/shared/kpi-card";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const OVERRIDE_STATUSES = ["ACTIVE", "FAILED", "SETTLED", "DISPUTED"] as const;
const ROOM_PHASES = ["0", "1", "2", "3", "4", "5"] as const;
const NEXT_ROOM_STATUSES = [
  "ACTIVE",
  "IN_SETTLEMENT",
  "DISPUTED",
  "FAILED",
  "SETTLED",
] as const;

const overrideRoomSchema = z.object({
  status: z.enum(OVERRIDE_STATUSES),
  phase: z.enum(ROOM_PHASES),
  reason: z.string().min(1, "Reason is required"),
});

const assignPanelSchema = z.object({
  panelistsText: z
    .string()
    .min(1, "Enter at least one panelist")
    .refine((value) => {
      const ids = value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      return ids.length > 0 && ids.length <= 3;
    }, "Provide 1 to 3 panelist IDs"),
});

const resolveDisputeSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  rationale: z.string().min(1, "Rationale is required"),
  remedy: z.string().min(1, "Remedy is required"),
  nextRoomStatus: z.enum(NEXT_ROOM_STATUSES).optional(),
});

type OverrideRoomValues = z.infer<typeof overrideRoomSchema>;
type AssignPanelValues = z.infer<typeof assignPanelSchema>;
type ResolveDisputeValues = z.infer<typeof resolveDisputeSchema>;

interface Props {
  rooms: AdminRoom[];
  jobs: Job[];
  disputes: AdminDispute[];
  metrics: Metrics | null;
  integrity: IntegritySummary | null;
  loadErrors: string[];
}

function formatDate(iso?: string) {
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

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 12)}…` : value;
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function LoadErrorsBanner({ loadErrors }: { loadErrors: string[] }) {
  if (loadErrors.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      Admin data is partial. Failed sections: {loadErrors.join(", ")}.
    </div>
  );
}

function RunDueJobsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRun = async () => {
    const { error } = await mutateJson("/api/admin/jobs/run-due", { limit: 25 });

    if (error) {
      toast.error("Failed to trigger due jobs", { description: error });
      return;
    }

    toast.success("Due jobs triggered");
    startTransition(() => router.refresh());
  };

  return (
    <Button
      onClick={handleRun}
      disabled={isPending}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <RefreshCwIcon className="h-4 w-4" />}
      Run Due Jobs
    </Button>
  );
}

function ReplayDialog({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const loadReplay = async () => {
    setLoading(true);
    setError(null);

    const response = await readProxyJson<unknown>(`/api/admin/rooms/${roomId}/replay`);

    setLoading(false);
    if (response.error) {
      setError(response.error);
      return;
    }

    setResult(response.data);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      void loadReplay();
    } else {
      setError(null);
      setResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Replay
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Replay Room</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {roomId}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Loading replay snapshot…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <ScrollArea className="h-96 rounded-xl border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-all text-xs leading-relaxed text-muted-foreground">
              {JSON.stringify(result, null, 2)}
            </pre>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverrideRoomDialog({
  room,
}: {
  room: AdminRoom;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<OverrideRoomValues>({
    resolver: zodResolver(overrideRoomSchema),
    defaultValues: {
      status: "ACTIVE",
      phase: String(room.phase) as (typeof ROOM_PHASES)[number],
      reason: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(`/api/admin/rooms/${room.id}/override`, {
      status: values.status,
      phase: values.phase,
      reason: values.reason,
    });

    if (error) {
      toast.error("Failed to override room", { description: error });
      return;
    }

    toast.success("Room override submitted");
    setOpen(false);
    form.reset({
      status: "ACTIVE",
      phase: String(room.phase) as (typeof ROOM_PHASES)[number],
      reason: "",
    });
    startTransition(() => router.refresh());
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Override
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Room State</DialogTitle>
          <DialogDescription>{room.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`override-status-${room.id}`}>Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`override-status-${room.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OVERRIDE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`override-phase-${room.id}`}>Phase</Label>
              <Controller
                control={form.control}
                name="phase"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`override-phase-${room.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_PHASES.map((phase) => (
                        <SelectItem key={phase} value={phase}>
                          Phase {phase}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`override-reason-${room.id}`}>Reason</Label>
            <Textarea
              id={`override-reason-${room.id}`}
              rows={3}
              placeholder="Explain why this manual override is needed."
              {...form.register("reason")}
            />
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
            <Button type="submit" disabled={isPending || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : null}
              Apply Override
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignPanelDialog({
  dispute,
}: {
  dispute: AdminDispute;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<AssignPanelValues>({
    resolver: zodResolver(assignPanelSchema),
    defaultValues: {
      panelistsText: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const panelists = values.panelistsText
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    const { error } = await mutateJson(
      `/api/admin/rooms/${dispute.roomId}/disputes/${dispute.id}/panel`,
      { panelists }
    );

    if (error) {
      toast.error("Failed to assign dispute panel", { description: error });
      return;
    }

    toast.success("Dispute panel assigned");
    setOpen(false);
    form.reset();
    startTransition(() => router.refresh());
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Assign Panel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Dispute Panel</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {dispute.id}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`panelists-${dispute.id}`}>
              Panelists (comma or newline separated)
            </Label>
            <Textarea
              id={`panelists-${dispute.id}`}
              rows={4}
              placeholder="agent:panel-001&#10;agent:panel-002&#10;agent:panel-003"
              {...form.register("panelistsText")}
            />
            {form.formState.errors.panelistsText && (
              <p className="text-xs text-destructive">
                {form.formState.errors.panelistsText.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : null}
              Assign Panel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDisputeDialog({
  dispute,
}: {
  dispute: AdminDispute;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ResolveDisputeValues>({
    resolver: zodResolver(resolveDisputeSchema),
    defaultValues: {
      summary: "",
      rationale: "",
      remedy: "",
      nextRoomStatus: undefined,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await mutateJson(
      `/api/admin/rooms/${dispute.roomId}/disputes/${dispute.id}/resolve`,
      {
        resolution: {
          summary: values.summary,
          rationale: values.rationale,
          remedy: values.remedy,
        },
        nextRoomStatus: values.nextRoomStatus,
      }
    );

    if (error) {
      toast.error("Failed to resolve dispute", { description: error });
      return;
    }

    toast.success("Dispute resolution submitted");
    setOpen(false);
    form.reset();
    startTransition(() => router.refresh());
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Resolve</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Dispute</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {dispute.id}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`resolution-summary-${dispute.id}`}>Summary</Label>
            <Textarea
              id={`resolution-summary-${dispute.id}`}
              rows={2}
              {...form.register("summary")}
            />
            {form.formState.errors.summary && (
              <p className="text-xs text-destructive">
                {form.formState.errors.summary.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`resolution-rationale-${dispute.id}`}>Rationale</Label>
            <Textarea
              id={`resolution-rationale-${dispute.id}`}
              rows={3}
              {...form.register("rationale")}
            />
            {form.formState.errors.rationale && (
              <p className="text-xs text-destructive">
                {form.formState.errors.rationale.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`resolution-remedy-${dispute.id}`}>Remedy</Label>
            <Textarea
              id={`resolution-remedy-${dispute.id}`}
              rows={2}
              {...form.register("remedy")}
            />
            {form.formState.errors.remedy && (
              <p className="text-xs text-destructive">
                {form.formState.errors.remedy.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`resolution-next-${dispute.id}`}>
              Next Room Status (optional)
            </Label>
            <Controller
              control={form.control}
              name="nextRoomStatus"
              render={({ field }) => (
                <Select
                  value={field.value ?? "UNCHANGED"}
                  onValueChange={(value) =>
                    field.onChange(value === "UNCHANGED" ? undefined : value)
                  }
                >
                  <SelectTrigger id={`resolution-next-${dispute.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNCHANGED">Leave unchanged</SelectItem>
                    {NEXT_ROOM_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
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
            <Button type="submit" disabled={isPending || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : null}
              Resolve Dispute
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OverviewTab({
  rooms,
  jobs,
  disputes,
  metrics,
}: Pick<Props, "rooms" | "jobs" | "disputes" | "metrics">) {
  const pendingJobs = jobs.filter((job) => job.status !== "DONE").length;
  const openDisputes = disputes.filter((dispute) => dispute.status !== "RESOLVED").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Rooms Total"
          value={metrics?.roomsTotal ?? rooms.length}
          icon={<WorkflowIcon />}
          color="blue"
          description="All rooms visible to the admin lane"
        />
        <KpiCard
          title="Rooms Active"
          value={metrics?.roomsActive ?? rooms.filter((room) => room.status === "ACTIVE").length}
          icon={<CheckCircle2Icon />}
          color="green"
          description="Rooms currently executing or reviewing work"
        />
        <KpiCard
          title="Open Disputes"
          value={metrics?.disputesOpen ?? openDisputes}
          icon={<AlertTriangleIcon />}
          color={openDisputes > 0 ? "red" : "default"}
          description="Disputes not yet resolved"
        />
        <KpiCard
          title="Pending Jobs"
          value={pendingJobs}
          icon={<ShieldCheckIcon />}
          color={pendingJobs > 0 ? "amber" : "default"}
          description={
            metrics?.failedJobs !== undefined
              ? `${metrics.failedJobs} failed job${metrics.failedJobs === 1 ? "" : "s"}`
              : undefined
          }
        />
      </div>

      <div className="flex justify-end">
        <RunDueJobsButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent Rooms"
          description="Quick access to the latest rooms in the stack."
        >
          {rooms.length === 0 ? (
            <EmptyState title="No rooms found" className="px-0 py-8" />
          ) : (
            <div className="space-y-3">
              {rooms.slice(0, 5).map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="truncate text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {room.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Phase {room.phase} • Updated {formatDate(room.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={room.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent Disputes"
          description="Current operational and economic escalations."
        >
          {disputes.length === 0 ? (
            <EmptyState title="No disputes found" className="px-0 py-8" />
          ) : (
            <div className="space-y-3">
              {disputes.slice(0, 5).map((dispute) => (
                <div
                  key={dispute.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/rooms/${dispute.roomId}`}
                      className="truncate text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {dispute.category}
                      {dispute.subType ? ` • ${dispute.subType}` : ""}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Room {shortId(dispute.roomId)} • Filed {formatDate(dispute.filedAt)}
                    </p>
                  </div>
                  <StatusBadge status={dispute.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function RoomsTab({ rooms }: { rooms: AdminRoom[] }) {
  return (
    <Panel
      title="Rooms"
      description="Replay room state or apply manual override actions."
      action={<RunDueJobsButton />}
    >
      {rooms.length === 0 ? (
        <EmptyState title="No rooms found" className="px-0 py-10" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Room</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Counts</th>
                <th className="px-3 py-3">Updated</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="px-3 py-4">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {room.name}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {room.id}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge status={room.status} size="sm" />
                  </td>
                  <td className="px-3 py-4 text-xs text-muted-foreground">
                    {room.memberCount} members • {room.taskCount} tasks • {room.disputeCount} disputes
                  </td>
                  <td className="px-3 py-4 text-xs text-muted-foreground">
                    {formatDate(room.updatedAt)}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-2">
                      <ReplayDialog roomId={room.id} />
                      <OverrideRoomDialog room={room} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function DisputesTab({ disputes }: { disputes: AdminDispute[] }) {
  return (
    <Panel
      title="Disputes"
      description="Assign panels and resolve disputes with contract-compliant payloads."
    >
      {disputes.length === 0 ? (
        <EmptyState title="No disputes found" className="px-0 py-10" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Dispute</th>
                <th className="px-3 py-3">Room</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Respondent</th>
                <th className="px-3 py-3">Filed</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disputes.map((dispute) => (
                <tr key={dispute.id}>
                  <td className="px-3 py-4">
                    <p className="font-semibold text-foreground">
                      {dispute.category}
                      {dispute.subType ? ` • ${dispute.subType}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dispute.remedySought ?? "No remedy summary yet"}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <Link
                      href={`/rooms/${dispute.roomId}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {shortId(dispute.roomId)}
                    </Link>
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge status={dispute.status} size="sm" />
                  </td>
                  <td className="px-3 py-4 font-mono text-xs text-muted-foreground">
                    {shortId(dispute.respondentId)}
                  </td>
                  <td className="px-3 py-4 text-xs text-muted-foreground">
                    {formatDate(dispute.filedAt)}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-2">
                      <AssignPanelDialog dispute={dispute} />
                      <ResolveDisputeDialog dispute={dispute} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function JobsTab({ jobs }: { jobs: Job[] }) {
  return (
    <Panel
      title="Jobs"
      description="Inspect queued and completed background jobs."
      action={<RunDueJobsButton />}
    >
      {jobs.length === 0 ? (
        <EmptyState title="No jobs found" className="px-0 py-10" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Job</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Run At</th>
                <th className="px-3 py-3">Room</th>
                <th className="px-3 py-3">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-3 py-4">
                    <p className="font-semibold text-foreground">{job.type}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {shortId(job.id)}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge status={job.status} size="sm" />
                  </td>
                  <td className="px-3 py-4 text-xs text-muted-foreground">
                    {formatDate(job.runAt)}
                  </td>
                  <td className="px-3 py-4 font-mono text-xs text-muted-foreground">
                    {job.roomId ? shortId(job.roomId) : "—"}
                  </td>
                  <td className="px-3 py-4 text-xs text-muted-foreground">
                    {job.attempts ?? 0}
                    {job.maxAttempts ? ` / ${job.maxAttempts}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function IntegrityTab({ integrity }: { integrity: IntegritySummary | null }) {
  return (
    <div className="space-y-6">
      <Panel
        title="Integrity Summary"
        description="Derived from `/api/admin/integrity` results."
      >
        {!integrity ? (
          <EmptyState
            title="Integrity data unavailable"
            description="The API did not return integrity results for this refresh."
            className="px-0 py-8"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Verified"
              value={integrity.valid ? "Yes" : "No"}
              color={integrity.valid ? "green" : "red"}
            />
            <KpiCard
              title="Rooms Checked"
              value={integrity.checkedRoomCount}
              color="blue"
            />
            <KpiCard
              title="Invalid Rooms"
              value={integrity.invalidRoomCount}
              color={integrity.invalidRoomCount > 0 ? "red" : "default"}
            />
            <KpiCard
              title="Events Verified"
              value={integrity.totalEvents}
              color="amber"
            />
          </div>
        )}
      </Panel>

      {integrity && integrity.results.length > 0 && (
        <Panel
          title="Per-Room Results"
          description="Event-chain verification results for each room."
        >
          <div className="space-y-3">
            {integrity.results.map((result) => (
              <div
                key={result.roomId}
                className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/rooms/${result.roomId}`}
                    className="font-mono text-sm text-foreground hover:text-primary"
                  >
                    {result.roomId}
                  </Link>
                  <StatusBadge status={result.ok ? "ACTIVE" : "FAILED"} size="sm" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {result.eventCount} event{result.eventCount === 1 ? "" : "s"} verified
                </p>
                {result.errors.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <ul className="space-y-1 text-xs text-destructive">
                      {result.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

export default function AdminDashboardClient({
  rooms,
  jobs,
  disputes,
  metrics,
  integrity,
  loadErrors,
}: Props) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl">
        <LoadErrorsBanner loadErrors={loadErrors} />

        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Admin Console
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Operational view for room health, queued jobs, disputes, integrity,
            and manual intervention paths.
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-xl bg-muted/60 p-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="integrity">Integrity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              rooms={rooms}
              jobs={jobs}
              disputes={disputes}
              metrics={metrics}
            />
          </TabsContent>

          <TabsContent value="rooms">
            <RoomsTab rooms={rooms} />
          </TabsContent>

          <TabsContent value="disputes">
            <DisputesTab disputes={disputes} />
          </TabsContent>

          <TabsContent value="jobs">
            <JobsTab jobs={jobs} />
          </TabsContent>

          <TabsContent value="integrity">
            <IntegrityTab integrity={integrity} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
