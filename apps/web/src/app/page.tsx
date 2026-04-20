import Link from "next/link";
import {
  BoltIcon,
  ScaleIcon,
  ShieldAlertIcon,
  CpuIcon,
  HomeIcon,
  BriefcaseIcon,
} from "lucide-react";

import { fetchJson } from "@/lib/api";
import type { AdminRoom, Job, AdminDispute, Metrics } from "@/types";
import KpiCard from "@/components/shared/kpi-card";
import TokenText from "@/components/shared/token-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Data ─────────────────────────────────────────────────────────────────────

interface AdminRoomsPayload {
  rooms: AdminRoom[];
}

interface AdminJobsPayload {
  jobs: Job[];
}

interface AdminDisputesPayload {
  disputes: AdminDispute[];
}

// ─── Feature config ───────────────────────────────────────────────────────────

const FEATURE_PILLS = [
  "Mission Intake",
  "Charter Signing",
  "Task Review",
  "Settlement Voting",
  "Dispute Resolution",
  "Ledger Replay",
];

const FEATURE_CARDS = [
  {
    icon: <BoltIcon />,
    title: "Event-Sourced",
    description:
      "Every room action is stored as an immutable event. Full replay and audit from genesis.",
  },
  {
    icon: <ScaleIcon />,
    title: "Consensus Settlement",
    description:
      "Configurable quorum and vote ratios ensure fair economic outcomes.",
  },
  {
    icon: <ShieldAlertIcon />,
    title: "Dispute Resolution",
    description:
      "Cooling-off periods, panel assignment, and escalation paths built in.",
  },
  {
    icon: <CpuIcon />,
    title: "Worker Automation",
    description:
      "Background jobs handle timeouts, transitions, and panel escalations automatically.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [roomsPayload, jobsPayload, disputesPayload, metrics] =
    await Promise.all([
      fetchJson<AdminRoomsPayload>("/api/admin/rooms"),
      fetchJson<AdminJobsPayload>("/api/admin/jobs"),
      fetchJson<AdminDisputesPayload>("/api/admin/disputes"),
      fetchJson<Metrics>("/api/admin/metrics"),
    ]);

  const rooms = roomsPayload?.rooms ?? [];
  const jobs = jobsPayload?.jobs ?? [];
  const disputes = disputesPayload?.disputes ?? [];

  const activeRooms = rooms.filter((r) => r.status === "ACTIVE").length;
  const pendingJobs = jobs.filter((j) => j.status !== "DONE").length;
  const openDisputes = disputes.filter((d) => d.status !== "RESOLVED").length;
  const totalRooms = rooms.length;

  return (
    <main className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border/40 bg-gradient-to-b from-muted/30 to-background px-6 py-20 text-center dark:from-muted/10">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Agentic Room Platform
          </p>

          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            <TokenText
              text="Multi-agent collaboration, end-to-end"
              speed={18}
              className="block"
            />
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Coordinate missions, sign charters, execute tasks, settle fairly.
            Every action is audited and replayable.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/rooms">View Rooms</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin">Admin Console</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            title="Active Rooms"
            value={activeRooms}
            icon={<HomeIcon />}
            color="green"
            trend="neutral"
          />
          <KpiCard
            title="Pending Jobs"
            value={pendingJobs}
            icon={<BriefcaseIcon />}
            color="amber"
            trend="neutral"
          />
          <KpiCard
            title="Open Disputes"
            value={openDisputes}
            icon={<ShieldAlertIcon />}
            color={openDisputes > 0 ? "red" : "default"}
            trend="neutral"
          />
          <KpiCard
            title="Rooms Total"
            value={totalRooms}
            icon={<CpuIcon />}
            color="blue"
            trend="neutral"
            description={
              metrics?.roomsTotal !== undefined
                ? `${metrics.roomsTotal} tracked`
                : undefined
            }
          />
        </div>
      </section>

      {/* ── Feature pills ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="flex flex-wrap gap-2">
          {FEATURE_PILLS.map((label) => (
            <span
              key={label}
              className="rounded-full bg-amber-100 px-3.5 py-1.5 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURE_CARDS.map(({ icon, title, description }) => (
            <Card key={title} className="bg-card/70 backdrop-blur-sm dark:bg-card/40">
              <CardHeader className="pb-2">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">
                  {icon}
                </div>
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
