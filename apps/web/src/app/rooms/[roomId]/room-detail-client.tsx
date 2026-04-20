"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  FileTextIcon,
  UsersIcon,
  ClipboardListIcon,
  ShieldAlertIcon,
  CalendarIcon,
  WalletIcon,
  CheckCircle2Icon,
  ActivityIcon,
} from "lucide-react";

import { mutateJson } from "@/lib/api";
import type {
  RoomSnapshot,
  Task,
  TaskStatus,
  Member,
  Dispute,
} from "@/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import StatusBadge from "@/components/shared/status-badge";
import PhaseStepper from "@/components/shared/phase-stepper";
import TokenText from "@/components/shared/token-text";
import EmptyState from "@/components/shared/empty-state";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(id: string): string {
  return id.slice(0, 2).toUpperCase();
}

const EFFORT_COLORS: Record<string, string> = {
  S: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  M: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  L: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  XL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RoomDetailClient({ room }: { room: RoomSnapshot }) {
  const router = useRouter();

  const doneTasks = room.tasks.filter(
    (t) => t.status === "ACCEPTED" || t.status === "DELIVERED"
  ).length;
  const completionPct =
    room.tasks.length > 0
      ? Math.round((doneTasks / room.tasks.length) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-background">
      {/* ── Page shell ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/rooms">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Rooms
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {room.name}
              </h1>
              <StatusBadge status={room.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              ID: <span className="font-mono">{room.id}</span>
            </p>
          </div>
        </div>

        {/* Phase stepper */}
        <div className="mb-8 rounded-xl border border-border/60 bg-card px-6 py-5">
          <PhaseStepper currentPhase={room.phase} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="mb-6 flex h-auto w-full flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
              {[
                "overview",
                "mission",
                "charter",
                "tasks",
                "members",
                "settlement",
                "disputes",
                "events",
              ].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="capitalize rounded-lg px-3 py-1.5 text-sm"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          {/* ── Overview Tab ──────────────────────────────────────────────── */}
          <TabsContent value="overview">
            <OverviewTab room={room} completionPct={completionPct} />
          </TabsContent>

          {/* ── Mission Tab ───────────────────────────────────────────────── */}
          <TabsContent value="mission">
            <MissionTab room={room} onSuccess={() => router.refresh()} />
          </TabsContent>

          {/* ── Charter Tab ───────────────────────────────────────────────── */}
          <TabsContent value="charter">
            <CharterTab room={room} onSuccess={() => router.refresh()} />
          </TabsContent>

          {/* ── Tasks Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="tasks">
            <TasksTab room={room} onSuccess={() => router.refresh()} />
          </TabsContent>

          {/* ── Members Tab ───────────────────────────────────────────────── */}
          <TabsContent value="members">
            <MembersTab room={room} onSuccess={() => router.refresh()} />
          </TabsContent>

          {/* ── Settlement Tab ────────────────────────────────────────────── */}
          <TabsContent value="settlement">
            <SettlementTab room={room} onSuccess={() => router.refresh()} />
          </TabsContent>

          {/* ── Disputes Tab ──────────────────────────────────────────────── */}
          <TabsContent value="disputes">
            <DisputesTab room={room} onSuccess={() => router.refresh()} />
          </TabsContent>

          {/* ── Events Tab ────────────────────────────────────────────────── */}
          <TabsContent value="events">
            <EventsTab room={room} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({
  room,
  completionPct,
}: {
  room: RoomSnapshot;
  completionPct: number;
}) {
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<WalletIcon className="h-5 w-5" />}
          label="Budget"
          value={
            room.budgetTotal != null
              ? room.budgetTotal.toLocaleString()
              : "—"
          }
        />
        <StatCard
          icon={<CalendarIcon className="h-5 w-5" />}
          label="Deadline"
          value={formatDate(room.executionDeadlineAt)}
        />
        <StatCard
          icon={<UsersIcon className="h-5 w-5" />}
          label="Members"
          value={String(room.members.length)}
        />
        <StatCard
          icon={<CheckCircle2Icon className="h-5 w-5" />}
          label="Tasks done"
          value={`${completionPct}%`}
          sub={
            <Progress
              value={completionPct}
              className="mt-2 h-1.5 w-full"
            />
          }
        />
      </div>

      {/* Quick summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Mission summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Mission</CardTitle>
          </CardHeader>
          <CardContent>
            {room.mission ? (
              <div className="space-y-2">
                <StatusBadge status={room.mission.status} size="sm" />
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {room.mission.objective}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No mission drafted yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Charter summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Charter</CardTitle>
          </CardHeader>
          <CardContent>
            {room.charter ? (
              <div className="space-y-2">
                <StatusBadge status={room.charter.status} size="sm" />
                <p className="text-sm text-muted-foreground">
                  {room.charter.tasks.length} task
                  {room.charter.tasks.length !== 1 ? "s" : ""} defined &mdash;{" "}
                  {room.charter.baselineSplit}% baseline split,{" "}
                  {room.charter.discretionaryPoolPct}% discretionary pool.
                </p>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(room.charter.signatures).length} of{" "}
                  {room.members.filter((m) => m.status === "ACTIVE").length}{" "}
                  active members signed.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No charter created yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent events preview */}
      {(room.events ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Recent Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(room.events ?? []).slice(-5).reverse().map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="mt-0.5 inline-flex shrink-0 items-center rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {ev.type}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDateTime(ev.createdAt)}
                    {ev.actorId && (
                      <> &mdash; <span className="font-medium text-foreground">{ev.actorId}</span></>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
          {value}
        </p>
        {sub}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISSION TAB
// ═══════════════════════════════════════════════════════════════════════════════

function MissionTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [constraints, setConstraints] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleDraft = async () => {
    if (!objective.trim()) {
      toast.error("Objective is required");
      return;
    }
    setSubmitting(true);
    const { error } = await mutateJson(`/api/rooms/${room.id}/mission/draft`, {
      objective: objective.trim(),
      deliverables: deliverables
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      successCriteria: successCriteria
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      constraints: constraints
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed to draft mission", { description: error });
    } else {
      toast.success("Mission drafted");
      setDraftOpen(false);
      onSuccess();
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/mission/confirm`
    );
    setConfirming(false);
    if (error) {
      toast.error("Failed to confirm mission", { description: error });
    } else {
      toast.success("Mission confirmed");
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Mission</h2>
        <div className="flex gap-2">
          {room.mission?.status === "DRAFT" && (
            <Button
              size="sm"
              variant="default"
              onClick={handleConfirm}
              disabled={confirming}
              className="gap-1.5"
            >
              {confirming && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
              Confirm Mission
            </Button>
          )}
          <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <FileTextIcon className="h-3.5 w-3.5" />
                Draft Mission
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Draft Mission</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="m-objective">Objective *</Label>
                  <Textarea
                    id="m-objective"
                    placeholder="Describe the mission objective…"
                    rows={3}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-deliverables">
                    Deliverables{" "}
                    <span className="text-muted-foreground text-xs">
                      (comma-separated)
                    </span>
                  </Label>
                  <Textarea
                    id="m-deliverables"
                    placeholder="Report, Dashboard, Analysis…"
                    rows={2}
                    value={deliverables}
                    onChange={(e) => setDeliverables(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-success">
                    Success Criteria{" "}
                    <span className="text-muted-foreground text-xs">
                      (comma-separated)
                    </span>
                  </Label>
                  <Textarea
                    id="m-success"
                    placeholder="95% accuracy, delivered on time…"
                    rows={2}
                    value={successCriteria}
                    onChange={(e) => setSuccessCriteria(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-constraints">
                    Constraints{" "}
                    <span className="text-muted-foreground text-xs">
                      (comma-separated)
                    </span>
                  </Label>
                  <Textarea
                    id="m-constraints"
                    placeholder="No external APIs, budget cap…"
                    rows={2}
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setDraftOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleDraft} disabled={submitting} className="gap-1.5">
                  {submitting && (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Save Draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {room.mission ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  Objective
                </CardTitle>
                <StatusBadge status={room.mission.status} size="sm" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">
                <TokenText text={room.mission.objective} speed={5} />
              </p>
            </CardContent>
          </Card>

          {(room.mission.deliverables ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Deliverables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {room.mission.deliverables!.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {d}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {(room.mission.successCriteria ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Success Criteria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {room.mission.successCriteria!.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {(room.mission.constraints ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Constraints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {room.mission.constraints!.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<FileTextIcon />}
          title="No mission drafted"
          description="Draft the mission objective, deliverables, and success criteria to guide agents in this room."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraftOpen(true)}
              className="gap-1.5"
            >
              <FileTextIcon className="h-3.5 w-3.5" />
              Draft Mission
            </Button>
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARTER TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface CharterTaskRow {
  title: string;
  effortEstimate: "S" | "M" | "L" | "XL";
  weight: number;
}

function CharterTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [baselineSplit, setBaselineSplit] = useState("70");
  const [discretionaryPoolPct, setDiscretionaryPoolPct] = useState("30");
  const [charterTasks, setCharterTasks] = useState<CharterTaskRow[]>([
    { title: "", effortEstimate: "M", weight: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [declining, setDeclining] = useState(false);

  const addTask = () =>
    setCharterTasks((prev) => [
      ...prev,
      { title: "", effortEstimate: "M", weight: 1 },
    ]);

  const removeTask = (i: number) =>
    setCharterTasks((prev) => prev.filter((_, idx) => idx !== i));

  const updateTask = (
    i: number,
    field: keyof CharterTaskRow,
    value: string | number
  ) =>
    setCharterTasks((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t))
    );

  const handleCreate = async () => {
    if (charterTasks.some((t) => !t.title.trim())) {
      toast.error("All tasks must have a title");
      return;
    }
    setSubmitting(true);
    const { error } = await mutateJson(`/api/rooms/${room.id}/charters`, {
      baselineSplit: Number(baselineSplit),
      discretionaryPoolPct: Number(discretionaryPoolPct),
      tasks: charterTasks.map((t) => ({
        title: t.title.trim(),
        effortEstimate: t.effortEstimate,
        weight: Number(t.weight),
        description: "",
      })),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed to create charter", { description: error });
    } else {
      toast.success("Charter created");
      setCreateOpen(false);
      onSuccess();
    }
  };

  const handleSign = async () => {
    if (!room.charter) return;
    setSigning(true);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/charters/${room.charter.id}/sign`
    );
    setSigning(false);
    if (error) {
      toast.error("Failed to sign charter", { description: error });
    } else {
      toast.success("Charter signed");
      onSuccess();
    }
  };

  const handleDecline = async () => {
    if (!room.charter) return;
    setDeclining(true);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/charters/${room.charter.id}/decline`
    );
    setDeclining(false);
    if (error) {
      toast.error("Failed to decline charter", { description: error });
    } else {
      toast.success("Charter declined");
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Charter</h2>
        {!room.charter && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <PlusIcon className="h-3.5 w-3.5" />
                Create Charter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Charter</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-2">
                <div className="space-y-5 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-baseline">Baseline Split %</Label>
                      <Input
                        id="c-baseline"
                        type="number"
                        min={0}
                        max={100}
                        value={baselineSplit}
                        onChange={(e) => setBaselineSplit(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-pool">Discretionary Pool %</Label>
                      <Input
                        id="c-pool"
                        type="number"
                        min={0}
                        max={100}
                        value={discretionaryPoolPct}
                        onChange={(e) =>
                          setDiscretionaryPoolPct(e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Tasks</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={addTask}
                        className="gap-1"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add Task
                      </Button>
                    </div>

                    {charterTasks.map((task, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-lg border border-border/60 p-3"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs">Title</Label>
                          <Input
                            placeholder="Task title…"
                            value={task.title}
                            onChange={(e) =>
                              updateTask(i, "title", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Effort</Label>
                          <Select
                            value={task.effortEstimate}
                            onValueChange={(v) =>
                              updateTask(i, "effortEstimate", v)
                            }
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["S", "M", "L", "XL"].map((e) => (
                                <SelectItem key={e} value={e}>
                                  {e}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Weight</Label>
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            value={task.weight}
                            onChange={(e) =>
                              updateTask(i, "weight", Number(e.target.value))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={charterTasks.length === 1}
                          onClick={() => removeTask(i)}
                          className="text-destructive hover:text-destructive"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setCreateOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={submitting} className="gap-1.5">
                  {submitting && (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Create Charter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {room.charter && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSign}
              disabled={signing}
              className="gap-1.5"
            >
              {signing && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
              Sign
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDecline}
              disabled={declining}
              className="gap-1.5"
            >
              {declining && (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              )}
              Decline
            </Button>
          </div>
        )}
      </div>

      {room.charter ? (
        <div className="space-y-5">
          {/* Charter meta */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  Charter Summary
                </CardTitle>
                <StatusBadge status={room.charter.status} size="sm" />
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Baseline Split</dt>
                  <dd className="font-semibold">{room.charter.baselineSplit}%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Discretionary Pool</dt>
                  <dd className="font-semibold">
                    {room.charter.discretionaryPoolPct}%
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-semibold">
                    {formatDate(room.charter.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tasks defined</dt>
                  <dd className="font-semibold">{room.charter.tasks.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Charter tasks table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Task Definitions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">
                        Title
                      </th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">
                        Effort
                      </th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">
                        Weight
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.charter.tasks.map((t, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{t.title}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              EFFORT_COLORS[t.effortEstimate] ?? ""
                            }`}
                          >
                            {t.effortEstimate}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {t.weight}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Signatures */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Signatures
              </CardTitle>
              <CardDescription>
                {Object.keys(room.charter.signatures).length} of{" "}
                {room.members.length} members signed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {room.members.map((m) => {
                  const sig = room.charter!.signatures[m.memberId];
                  const signed = sig && "signedAt" in sig;
                  const declined = sig && "declinedAt" in sig;
                  return (
                    <div
                      key={m.memberId}
                      className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {initials(m.memberId)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-mono">{m.memberId}</span>
                      </div>
                      {signed ? (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          Signed {formatDate((sig as { signedAt: string }).signedAt)}
                        </span>
                      ) : declined ? (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                          Declined {formatDate((sig as { declinedAt: string }).declinedAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<ClipboardListIcon />}
          title="No charter yet"
          description="Create a charter to define tasks, effort estimates, and token split parameters."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Create Charter
            </Button>
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const KANBAN_COLUMNS: TaskStatus[] = [
  "OPEN",
  "CLAIMED",
  "DELIVERED",
  "ACCEPTED",
  "REJECTED",
];

function TasksTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const tasksByStatus = (status: TaskStatus) =>
    room.tasks.filter((t) => t.status === status);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col}
            status={col}
            tasks={tasksByStatus(col)}
            roomId={room.id}
            onSuccess={onSuccess}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  roomId,
  onSuccess,
}: {
  status: TaskStatus;
  tasks: Task[];
  roomId: string;
  onSuccess: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <StatusBadge status={status} size="sm" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </div>
      <div className="min-h-[120px] space-y-2 rounded-xl border border-border/50 bg-muted/30 p-2">
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No tasks
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              roomId={roomId}
              onSuccess={onSuccess}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  roomId,
  onSuccess,
}: {
  task: Task;
  roomId: string;
  onSuccess: () => void;
}) {
  const [claiming, setClaiming] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverNotes, setDeliverNotes] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleClaim = async () => {
    setClaiming(true);
    const { error } = await mutateJson(
      `/api/rooms/${roomId}/tasks/${task.id}/claim`
    );
    setClaiming(false);
    if (error) {
      toast.error("Failed to claim task", { description: error });
    } else {
      toast.success("Task claimed");
      onSuccess();
    }
  };

  const handleDeliver = async () => {
    setDelivering(true);
    const { error } = await mutateJson(
      `/api/rooms/${roomId}/tasks/${task.id}/deliver`,
      { deliverableUrl: deliverableUrl.trim(), notes: deliverNotes.trim() }
    );
    setDelivering(false);
    if (error) {
      toast.error("Failed to deliver task", { description: error });
    } else {
      toast.success("Task delivered");
      setDeliverOpen(false);
      onSuccess();
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    const { error } = await mutateJson(
      `/api/rooms/${roomId}/tasks/${task.id}/accept`,
      { feedback: reviewFeedback.trim() || undefined }
    );
    setAccepting(false);
    if (error) {
      toast.error("Failed to accept task", { description: error });
    } else {
      toast.success("Task accepted");
      setReviewOpen(false);
      onSuccess();
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    const { error } = await mutateJson(
      `/api/rooms/${roomId}/tasks/${task.id}/reject`,
      { feedback: reviewFeedback.trim() || undefined }
    );
    setRejecting(false);
    if (error) {
      toast.error("Failed to reject task", { description: error });
    } else {
      toast.success("Task rejected");
      setReviewOpen(false);
      onSuccess();
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
      <p className="mb-2 text-xs font-medium leading-snug text-foreground">
        {task.title}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {task.effortEstimate && (
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              EFFORT_COLORS[task.effortEstimate] ?? ""
            }`}
          >
            {task.effortEstimate}
          </span>
        )}
        {task.assigneeId && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
            {task.assigneeId.slice(0, 12)}
          </span>
        )}
      </div>

      {/* Task actions */}
      <div className="flex flex-wrap gap-1">
        {task.status === "OPEN" && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? <Loader2Icon className="h-3 w-3 animate-spin" /> : "Claim"}
          </Button>
        )}

        {task.status === "CLAIMED" && (
          <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                Deliver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Deliver Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="d-url">Deliverable URL</Label>
                  <Input
                    id="d-url"
                    placeholder="https://…"
                    value={deliverableUrl}
                    onChange={(e) => setDeliverableUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="d-notes">Notes</Label>
                  <Textarea
                    id="d-notes"
                    rows={3}
                    placeholder="Describe the deliverable…"
                    value={deliverNotes}
                    onChange={(e) => setDeliverNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeliverOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDeliver} disabled={delivering} className="gap-1.5">
                  {delivering && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {task.status === "DELIVERED" && (
          <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                Review
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Review Delivery</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {task.deliverableUrl && (
                  <p className="text-sm">
                    <span className="font-medium">URL: </span>
                    <a
                      href={task.deliverableUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      {task.deliverableUrl}
                    </a>
                  </p>
                )}
                {task.notes && (
                  <p className="text-sm text-muted-foreground">{task.notes}</p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="r-feedback">Feedback (optional)</Label>
                  <Textarea
                    id="r-feedback"
                    rows={3}
                    placeholder="Feedback for the contributor…"
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejecting || accepting}
                  className="gap-1.5"
                >
                  {rejecting && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                  Reject
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={accepting || rejecting}
                  className="gap-1.5"
                >
                  {accepting && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                  Accept
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function MembersTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState<string>("CONTRIBUTOR");
  const [submitting, setSubmitting] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!memberId.trim()) {
      toast.error("Member ID is required");
      return;
    }
    setSubmitting(true);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/members/invite`,
      { memberId: memberId.trim(), role }
    );
    setSubmitting(false);
    if (error) {
      toast.error("Failed to invite member", { description: error });
    } else {
      toast.success("Invitation sent");
      setInviteOpen(false);
      setMemberId("");
      onSuccess();
    }
  };

  const handleAccept = async (m: Member) => {
    setActingOn(m.memberId);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/members/${m.memberId}/accept`
    );
    setActingOn(null);
    if (error) {
      toast.error("Failed to accept invitation", { description: error });
    } else {
      toast.success("Invitation accepted");
      onSuccess();
    }
  };

  const handleDecline = async (m: Member) => {
    setActingOn(m.memberId);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/members/${m.memberId}/decline`
    );
    setActingOn(null);
    if (error) {
      toast.error("Failed to decline invitation", { description: error });
    } else {
      toast.success("Invitation declined");
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <PlusIcon className="h-3.5 w-3.5" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-id">Member ID</Label>
                <Input
                  id="inv-id"
                  placeholder="agent:member-001"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="inv-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["COORDINATOR", "CONTRIBUTOR", "REVIEWER", "OBSERVER"].map(
                      (r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setInviteOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={submitting} className="gap-1.5">
                {submitting && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {room.members.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No members yet"
          description="Invite agents to collaborate in this room."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Member
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Joined
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {room.members.map((m) => (
                  <tr
                    key={m.memberId}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {initials(m.memberId)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-mono text-xs">{m.memberId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.role} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(m.joinedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {m.status === "INVITED" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleAccept(m)}
                            disabled={actingOn === m.memberId}
                          >
                            {actingOn === m.memberId ? (
                              <Loader2Icon className="h-3 w-3 animate-spin" />
                            ) : (
                              "Accept"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDecline(m)}
                            disabled={actingOn === m.memberId}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTLEMENT TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface AllocationRow {
  memberId: string;
  amount: string;
}

function SettlementTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [proposeOpen, setProposeOpen] = useState(false);
  const [allocations, setAllocations] = useState<AllocationRow[]>([
    { memberId: "", amount: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteRationale, setVoteRationale] = useState("");
  const [voting, setVoting] = useState<"APPROVE" | "REJECT" | null>(null);

  const addAllocation = () =>
    setAllocations((prev) => [...prev, { memberId: "", amount: "" }]);
  const removeAllocation = (i: number) =>
    setAllocations((prev) => prev.filter((_, idx) => idx !== i));
  const updateAllocation = (
    i: number,
    field: keyof AllocationRow,
    value: string
  ) =>
    setAllocations((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a))
    );

  const handlePropose = async () => {
    const parsed = allocations.map((a) => ({
      memberId: a.memberId.trim(),
      amount: Number(a.amount),
    }));
    if (parsed.some((a) => !a.memberId || isNaN(a.amount))) {
      toast.error("All allocation rows must have a member ID and amount");
      return;
    }
    setSubmitting(true);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/settlement/propose`,
      { allocations: parsed }
    );
    setSubmitting(false);
    if (error) {
      toast.error("Failed to propose settlement", { description: error });
    } else {
      toast.success("Settlement proposed");
      setProposeOpen(false);
      onSuccess();
    }
  };

  const handleVote = async (vote: "APPROVE" | "REJECT") => {
    setVoting(vote);
    const { error } = await mutateJson(
      `/api/rooms/${room.id}/settlement/vote`,
      { vote, rationale: voteRationale.trim() || undefined }
    );
    setVoting(null);
    if (error) {
      toast.error("Failed to submit vote", { description: error });
    } else {
      toast.success(`Vote ${vote.toLowerCase()}d`);
      setVoteOpen(false);
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Settlement</h2>
        {!room.settlement && (
          <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <PlusIcon className="h-3.5 w-3.5" />
                Propose Settlement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Propose Settlement</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[55vh] pr-2">
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Allocations</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={addAllocation}
                        className="gap-1"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add Row
                      </Button>
                    </div>
                    {allocations.map((a, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
                      >
                        <Input
                          placeholder="agent:member-id"
                          value={a.memberId}
                          onChange={(e) =>
                            updateAllocation(i, "memberId", e.target.value)
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          className="w-28"
                          placeholder="Amount"
                          value={a.amount}
                          onChange={(e) =>
                            updateAllocation(i, "amount", e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={allocations.length === 1}
                          onClick={() => removeAllocation(i)}
                          className="text-destructive hover:text-destructive"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setProposeOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handlePropose} disabled={submitting} className="gap-1.5">
                  {submitting && (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Propose
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {room.settlement && (
          <Dialog open={voteOpen} onOpenChange={setVoteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                Vote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Vote on Settlement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="v-rationale">
                    Rationale{" "}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="v-rationale"
                    rows={3}
                    placeholder="Explain your vote…"
                    value={voteRationale}
                    onChange={(e) => setVoteRationale(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => handleVote("REJECT")}
                  disabled={!!voting}
                  className="gap-1.5"
                >
                  {voting === "REJECT" && (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={() => handleVote("APPROVE")}
                  disabled={!!voting}
                  className="gap-1.5"
                >
                  {voting === "APPROVE" && (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Approve
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {room.settlement ? (
        <div className="space-y-5">
          {/* Status */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  Settlement Status
                </CardTitle>
                <StatusBadge status={room.settlement.status} size="sm" />
              </div>
              <CardDescription>
                Proposed {formatDate(room.settlement.proposedAt)}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Allocations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Allocations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">
                      Member
                    </th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {room.settlement.allocations.map((a) => (
                    <tr
                      key={a.memberId}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {a.memberId}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">
                        {a.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Votes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Votes</CardTitle>
              <CardDescription>
                {Object.keys(room.settlement.votes).length} vote
                {Object.keys(room.settlement.votes).length !== 1 ? "s" : ""}{" "}
                cast
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(room.settlement.votes).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No votes cast yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {(Object.entries(room.settlement.votes) as Array<[string, { vote: "APPROVE" | "REJECT"; rationale?: string }]>).map(
                    ([memberId, v]) => (
                      <div
                        key={memberId}
                        className="flex items-start justify-between rounded-lg border border-border/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {initials(memberId)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-mono text-xs">{memberId}</p>
                            {v.rationale && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {v.rationale}
                              </p>
                            )}
                          </div>
                        </div>
                        <StatusBadge
                          status={v.vote === "APPROVE" ? "ACTIVE" : "REJECTED"}
                          size="sm"
                        />
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<WalletIcon />}
          title="No settlement proposed"
          description="Propose a token allocation settlement when the room tasks are complete."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setProposeOpen(true)}
              className="gap-1.5"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Propose Settlement
            </Button>
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPUTES TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface EvidenceRow {
  type: string;
  description: string;
}

function DisputesTab({
  room,
  onSuccess,
}: {
  room: RoomSnapshot;
  onSuccess: () => void;
}) {
  const [fileOpen, setFileOpen] = useState(false);
  const [category, setCategory] = useState<string>("OPERATIONAL");
  const [subType, setSubType] = useState("");
  const [respondentId, setRespondentId] = useState("");
  const [remedySought, setRemedySought] = useState("");
  const [evidence, setEvidence] = useState<EvidenceRow[]>([
    { type: "", description: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addEvidence = () =>
    setEvidence((prev) => [...prev, { type: "", description: "" }]);
  const removeEvidence = (i: number) =>
    setEvidence((prev) => prev.filter((_, idx) => idx !== i));
  const updateEvidence = (
    i: number,
    field: keyof EvidenceRow,
    value: string
  ) =>
    setEvidence((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e))
    );

  const handleFile = async () => {
    if (!respondentId.trim()) {
      toast.error("Respondent ID is required");
      return;
    }
    setSubmitting(true);
    const { error } = await mutateJson(`/api/rooms/${room.id}/disputes`, {
      category,
      subType: subType.trim() || undefined,
      respondentId: respondentId.trim(),
      remedySought: remedySought.trim() || undefined,
      evidence: evidence
        .filter((e) => e.type.trim() || e.description.trim())
        .map((e) => ({ type: e.type.trim(), description: e.description.trim() })),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed to file dispute", { description: error });
    } else {
      toast.success("Dispute filed");
      setFileOpen(false);
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Disputes</h2>
        <Dialog open={fileOpen} onOpenChange={setFileOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <ShieldAlertIcon className="h-3.5 w-3.5" />
              File Dispute
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>File Dispute</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="d-category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="d-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPERATIONAL">OPERATIONAL</SelectItem>
                        <SelectItem value="ECONOMIC">ECONOMIC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="d-subtype">Sub-type</Label>
                    <Input
                      id="d-subtype"
                      placeholder="e.g. TASK_QUALITY"
                      value={subType}
                      onChange={(e) => setSubType(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-respondent">Respondent ID *</Label>
                  <Input
                    id="d-respondent"
                    placeholder="agent:member-001"
                    value={respondentId}
                    onChange={(e) => setRespondentId(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-remedy">Remedy Sought</Label>
                  <Textarea
                    id="d-remedy"
                    rows={2}
                    placeholder="Describe the desired resolution…"
                    value={remedySought}
                    onChange={(e) => setRemedySought(e.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Evidence</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={addEvidence}
                      className="gap-1"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                  {evidence.map((e, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-lg border border-border/50 p-3"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Input
                          className="w-28"
                          placeholder="LOG / URL…"
                          value={e.type}
                          onChange={(ev) =>
                            updateEvidence(i, "type", ev.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          rows={2}
                          placeholder="Describe the evidence…"
                          value={e.description}
                          onChange={(ev) =>
                            updateEvidence(i, "description", ev.target.value)
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={evidence.length === 1}
                        onClick={() => removeEvidence(i)}
                        className="mt-5 text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setFileOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleFile} disabled={submitting} className="gap-1.5">
                {submitting && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                File Dispute
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {room.disputes.length === 0 ? (
        <EmptyState
          icon={<ShieldAlertIcon />}
          title="No disputes"
          description="File a dispute if you believe there has been a breach of agreement or unfair outcome."
        />
      ) : (
        <div className="space-y-3">
          {room.disputes.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} />
          ))}
        </div>
      )}
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: Dispute }) {
  return (
    <Card>
      <Accordion type="single" collapsible>
        <AccordionItem value={dispute.id} className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex flex-1 flex-wrap items-center gap-3 text-left">
              <StatusBadge status={dispute.status} size="sm" />
              <Badge variant="outline" className="text-xs font-mono">
                {dispute.category}
              </Badge>
              {dispute.subType && (
                <span className="text-xs text-muted-foreground">
                  {dispute.subType}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                vs{" "}
                <span className="font-mono font-medium text-foreground">
                  {dispute.respondentId}
                </span>
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(dispute.filedAt)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {dispute.remedySought && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Remedy Sought
                  </p>
                  <p className="text-sm leading-relaxed">{dispute.remedySought}</p>
                </div>
              )}

              {dispute.resolution && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Resolution
                  </p>
                  <p className="text-sm leading-relaxed">{dispute.resolution}</p>
                </div>
              )}

              {dispute.evidence.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Evidence ({dispute.evidence.length})
                  </p>
                  <div className="space-y-2">
                    {dispute.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                      >
                        <p className="text-xs font-semibold">{ev.type}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ev.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(dispute.panelIds ?? []).length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Panel
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dispute.panelIds!.map((pid) => (
                      <span
                        key={pid}
                        className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs"
                      >
                        {pid}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function EventsTab({ room }: { room: RoomSnapshot }) {
  const events = (room.events ?? []).slice().reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Events</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon />}
          title="No events yet"
          description="Events are recorded as room lifecycle actions occur."
        />
      ) : (
        <ScrollArea className="h-[600px] pr-2">
          <Accordion type="multiple" className="space-y-2">
            {events.map((ev, i) => (
              <AccordionItem
                key={ev.id}
                value={ev.id}
                className="rounded-xl border border-border/60 bg-card px-0"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex flex-1 flex-wrap items-center gap-3 text-left">
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      #{events.length - i}
                    </span>
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                      {ev.type}
                    </span>
                    {ev.actorId && (
                      <span className="text-xs text-muted-foreground">
                        by{" "}
                        <span className="font-mono font-medium text-foreground">
                          {ev.actorId}
                        </span>
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(ev.createdAt)}
                    </span>
                  </div>
                </AccordionTrigger>
                {ev.payload && Object.keys(ev.payload).length > 0 && (
                  <AccordionContent className="px-4 pb-4">
                    <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </AccordionContent>
                )}
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      )}
    </div>
  );
}
