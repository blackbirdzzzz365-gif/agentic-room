"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { mutateJson } from "@/lib/api";
import type { AdminRoom, Job, AdminDispute, Metrics, RoomStatus } from "@/types";
import StatusBadge from "@/components/shared/status-badge";
import KpiCard from "@/components/shared/kpi-card";
import EmptyState from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROOM_STATUSES: RoomStatus[] = [
  "FORMING",
  "PENDING_CHARTER",
  "ACTIVE",
  "IN_REVIEW",
  "IN_SETTLEMENT",
  "SETTLED",
  "FAILED",
  "DISPUTED",
];

const ALL_DISPUTE_STATUSES = [
  "COOLING_OFF",
  "OPEN",
  "PANEL_ASSIGNED",
  "UNDER_REVIEW",
  "RESOLVED",
  "ESCALATED_TO_MANUAL",
] as const;

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  rooms: AdminRoom[];
  jobs: Job[];
  disputes: AdminDispute[];
  metrics: Metrics | null;
  integrity: { valid: boolean; error?: string; chainLength?: number } | null;
}

// ─── Helper icons ─────────────────────────────────────────────────────────────

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 7l9-4 9 4M4 21V7M20 21V7M9 21V13h6v8" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="12" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCheckmark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconLoader() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

function IconMoreVertical() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
  );
}

// ─── Run Due Jobs Button ───────────────────────────────────────────────────────

function RunDueJobsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleRun() {
    const { error } = await mutateJson("/api/admin/jobs/run-due");
    if (error) {
      toast.error(`Failed to run due jobs: ${error}`);
    } else {
      toast.success("Due jobs triggered successfully");
      startTransition(() => router.refresh());
    }
  }

  return (
    <Button onClick={handleRun} disabled={isPending} variant="outline" size="sm" className="gap-2">
      {isPending ? <IconLoader /> : null}
      Run Due Jobs
    </Button>
  );
}

// ─── Replay Dialog ────────────────────────────────────────────────────────────

function ReplayDialog({ roomId, trigger }: { roomId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function handleReplay() {
    setLoading(true);
    const { data, error } = await mutateJson<unknown>(`/api/admin/rooms/${roomId}/replay`, undefined, "POST");
    setLoading(false);
    if (error) {
      toast.error(`Replay failed: ${error}`);
    } else {
      setResult(data);
    }
  }

  function handleOpen(val: boolean) {
    setOpen(val);
    if (val) {
      setResult(null);
      handleReplay();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Room Replay — {roomId}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <IconLoader /> Replaying room…
            </div>
          ) : (
            <ScrollArea className="h-80 rounded-md border bg-muted/40 p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Override Status Dialog ────────────────────────────────────────────────────

function OverrideStatusDialog({ roomId, trigger }: { roomId: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RoomStatus>("ACTIVE");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setLoading(true);
    const { error } = await mutateJson(`/api/admin/rooms/${roomId}/override`, { status, reason });
    setLoading(false);
    if (error) {
      toast.error(`Override failed: ${error}`);
    } else {
      toast.success("Room status overridden");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setReason(""); setStatus("ACTIVE"); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Room Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>New Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RoomStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROOM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              placeholder="Explain why this override is needed…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <IconLoader /> : null}
            Apply Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Panel Dialog ───────────────────────────────────────────────────────

function AssignPanelDialog({ roomId, disputeId, trigger }: { roomId: string; disputeId: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panelIdsRaw, setPanelIdsRaw] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const panelIds = panelIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (panelIds.length === 0) {
      toast.error("Enter at least one panel ID");
      return;
    }
    setLoading(true);
    const { error } = await mutateJson(
      `/api/admin/rooms/${roomId}/disputes/${disputeId}/panel`,
      { panelIds }
    );
    setLoading(false);
    if (error) {
      toast.error(`Assign panel failed: ${error}`);
    } else {
      toast.success("Panel assigned");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPanelIdsRaw(""); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Panel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Panel IDs (comma-separated)</Label>
            <Textarea
              placeholder="agent-001, agent-002, agent-003"
              value={panelIdsRaw}
              onChange={(e) => setPanelIdsRaw(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <IconLoader /> : null}
            Assign Panel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Resolve Dispute Dialog ────────────────────────────────────────────────────

function ResolveDisputeDialog({ roomId, disputeId, trigger }: { roomId: string; disputeId: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!resolution.trim()) {
      toast.error("Resolution is required");
      return;
    }
    setLoading(true);
    const { error } = await mutateJson(
      `/api/admin/rooms/${roomId}/disputes/${disputeId}/resolve`,
      { resolution, notes }
    );
    setLoading(false);
    if (error) {
      toast.error(`Resolve failed: ${error}`);
    } else {
      toast.success("Dispute resolved");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResolution(""); setNotes(""); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Dispute</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Resolution</Label>
            <Textarea
              placeholder="Describe the resolution…"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Additional context or notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <IconLoader /> : null}
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ rooms, jobs, disputes }: Pick<Props, "rooms" | "jobs" | "disputes">) {
  const queuedJobs = jobs.filter((j) => j.status !== "DONE");
  const openDisputes = disputes.filter((d) => d.status !== "RESOLVED");
  const settledRooms = rooms.filter((r) => r.status === "SETTLED");
  const recentRooms = [...rooms].slice(0, 5);
  const recentDisputes = [...disputes].slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Rooms"
          value={rooms.length}
          icon={<IconBuilding />}
          color="blue"
          description="All rooms tracked by the system"
        />
        <KpiCard
          title="Queued Jobs"
          value={queuedJobs.length}
          icon={<IconBriefcase />}
          color={queuedJobs.length > 0 ? "amber" : "default"}
          description="Jobs not yet in DONE state"
        />
        <KpiCard
          title="Open Disputes"
          value={openDisputes.length}
          icon={<IconShield />}
          color={openDisputes.length > 0 ? "red" : "default"}
          description="Disputes not yet resolved"
        />
        <KpiCard
          title="Settled Rooms"
          value={settledRooms.length}
          icon={<IconCheckmark />}
          color="green"
          description="Rooms in SETTLED status"
        />
      </div>

      <div className="flex justify-end">
        <RunDueJobsButton />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Rooms</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentRooms.length === 0 ? (
              <EmptyState title="No rooms yet" className="py-10" />
            ) : (
              <div className="divide-y divide-border">
                {recentRooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{room.name}</p>
                      <p className="text-xs text-muted-foreground">Phase {room.phase}</p>
                    </div>
                    <StatusBadge status={room.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Disputes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentDisputes.length === 0 ? (
              <EmptyState title="No disputes yet" className="py-10" />
            ) : (
              <div className="divide-y divide-border">
                {recentDisputes.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-mono text-muted-foreground">{d.roomId}</p>
                      <p className="text-sm font-medium">{d.category}</p>
                    </div>
                    <StatusBadge status={d.status} size="sm" />
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

// ─── Rooms Tab ────────────────────────────────────────────────────────────────

function RoomsTab({ rooms }: { rooms: AdminRoom[] }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "status" | "phase">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = rooms
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        String(r.phase).includes(q)
      );
    })
    .sort((a, b) => {
      let av: string | number = a[sortCol];
      let bv: string | number = b[sortCol];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  function toggleSort(col: "name" | "status" | "phase") {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(true); }
  }

  function SortHeader({ col, label }: { col: "name" | "status" | "phase"; label: string }) {
    return (
      <button
        className="flex items-center gap-1 font-semibold hover:text-foreground transition-colors"
        onClick={() => toggleSort(col)}
      >
        {label}
        {sortCol === col && (
          <span className="text-xs">{sortAsc ? "↑" : "↓"}</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search rooms by name, status, or phase…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">
                  <SortHeader col="name" label="Name" />
                </th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">
                  <SortHeader col="status" label="Status" />
                </th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">
                  <SortHeader col="phase" label="Phase" />
                </th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState title="No rooms found" className="py-12" />
                  </td>
                </tr>
              ) : (
                filtered.map((room) => (
                  <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{room.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={room.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{room.phase}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <IconMoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <ReplayDialog
                            roomId={room.id}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Replay Room
                              </DropdownMenuItem>
                            }
                          />
                          <OverrideStatusDialog
                            roomId={room.id}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Override Status
                              </DropdownMenuItem>
                            }
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Disputes Tab ─────────────────────────────────────────────────────────────

function DisputesTab({ disputes }: { disputes: AdminDispute[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = disputes.filter((d) =>
    statusFilter === "ALL" ? true : d.status === statusFilter
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-sm">Filter by status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {ALL_DISPUTE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Room ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Sub-type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Respondent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Filed At</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No disputes found" className="py-12" />
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/rooms/${d.roomId}`}
                        className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {d.roomId.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3">{d.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.subType ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {d.respondentId.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(d.filedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <IconMoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <AssignPanelDialog
                            roomId={d.roomId}
                            disputeId={d.id}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Assign Panel
                              </DropdownMenuItem>
                            }
                          />
                          <ResolveDisputeDialog
                            roomId={d.roomId}
                            disputeId={d.id}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Resolve
                              </DropdownMenuItem>
                            }
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

function JobStatusDot({ status }: { status: string }) {
  const cls =
    status === "DONE"
      ? "bg-green-500"
      : status === "FAILED"
      ? "bg-red-500"
      : "bg-amber-400";

  const label =
    status === "DONE"
      ? "text-green-700 dark:text-green-400"
      : status === "FAILED"
      ? "text-red-700 dark:text-red-400"
      : "text-amber-700 dark:text-amber-400";

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${label}`}>
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {status}
    </span>
  );
}

function JobsTab({ jobs }: { jobs: Job[] }) {
  const [limit, setLimit] = useState<25 | 50 | 100>(50);

  const visible = jobs.slice(0, limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm shrink-0">Show:</Label>
          <Select
            value={String(limit)}
            onValueChange={(v) => setLimit(Number(v) as 25 | 50 | 100)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 jobs</SelectItem>
              <SelectItem value="50">50 jobs</SelectItem>
              <SelectItem value="100">100 jobs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <RunDueJobsButton />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Job ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Run At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Room ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No jobs found" className="py-12" />
                  </td>
                </tr>
              ) : (
                visible.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {job.id.slice(0, 14)}…
                    </td>
                    <td className="px-4 py-3 font-medium">{job.type}</td>
                    <td className="px-4 py-3">
                      <JobStatusDot status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(job.runAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {job.roomId ? `${job.roomId.slice(0, 12)}…` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        Showing {visible.length} of {jobs.length} jobs
      </p>
    </div>
  );
}

// ─── Integrity Tab ────────────────────────────────────────────────────────────

function IntegrityTab({ integrity }: { integrity: Props["integrity"] }) {
  const router = useRouter();
  const [replayRoomId, setReplayRoomId] = useState("");
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayResult, setReplayResult] = useState<unknown>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  async function handleReplay() {
    if (!replayRoomId.trim()) {
      toast.error("Enter a room ID");
      return;
    }
    setReplayLoading(true);
    setReplayResult(null);
    setReplayError(null);
    const { data, error } = await mutateJson<unknown>(
      `/api/admin/rooms/${replayRoomId.trim()}/replay`,
      undefined,
      "POST"
    );
    setReplayLoading(false);
    if (error) {
      setReplayError(error);
    } else {
      setReplayResult(data);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Status indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                integrity?.valid
                  ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
              }`}
            >
              {integrity?.valid ? (
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
            <div>
              <p className={`text-lg font-bold ${integrity?.valid ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {integrity === null
                  ? "Ledger Integrity: Unknown"
                  : integrity.valid
                  ? "Ledger Integrity: Verified"
                  : "Ledger Integrity: FAILED"}
              </p>
              {integrity?.chainLength != null && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {integrity.chainLength.toLocaleString()} events verified
                </p>
              )}
            </div>
          </div>

          {integrity?.error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/60 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Error</p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-300 font-mono break-all">{integrity.error}</p>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Room Replay section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Room Replay</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Enter Room ID…"
            value={replayRoomId}
            onChange={(e) => setReplayRoomId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleReplay(); }}
            className="max-w-sm"
          />
          <Button onClick={handleReplay} disabled={replayLoading}>
            {replayLoading ? <IconLoader /> : null}
            Replay
          </Button>
        </div>

        {replayError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/60 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-300">{replayError}</p>
          </div>
        )}

        {replayResult !== null && (
          <div className="rounded-lg border">
            <div className="border-b px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 rounded-t-lg">
              Replay Result
            </div>
            <ScrollArea className="h-96 rounded-b-lg">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(replayResult, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function AdminDashboardClient({ rooms, jobs, disputes, metrics: _metrics, integrity }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational view for room health, queued jobs, disputes, and ledger integrity.
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="h-10">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rooms">
              Rooms
              {rooms.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                  {rooms.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="disputes">
              Disputes
              {disputes.filter((d) => d.status !== "RESOLVED").length > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 text-xs tabular-nums">
                  {disputes.filter((d) => d.status !== "RESOLVED").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="jobs">
              Jobs
              {jobs.filter((j) => j.status !== "DONE").length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-xs tabular-nums">
                  {jobs.filter((j) => j.status !== "DONE").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="integrity">
              Integrity
              {integrity !== null && !integrity.valid && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab rooms={rooms} jobs={jobs} disputes={disputes} />
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
