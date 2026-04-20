import { fetchJson } from "@/lib/api";
import type { AdminRoom, Job, AdminDispute, Metrics } from "@/types";
import AdminDashboardClient from "./admin-dashboard-client";

export default async function AdminPage() {
  const [roomsPayload, jobsPayload, disputesPayload, metrics, integrity] =
    await Promise.all([
      fetchJson<{ rooms: AdminRoom[] }>("/api/admin/rooms"),
      fetchJson<{ jobs: Job[] }>("/api/admin/jobs?limit=50"),
      fetchJson<{ disputes: AdminDispute[] }>("/api/admin/disputes"),
      fetchJson<Metrics>("/api/admin/metrics"),
      fetchJson<{ valid: boolean; error?: string; chainLength?: number }>(
        "/api/admin/integrity"
      ),
    ]);

  const rooms = roomsPayload?.rooms ?? [];
  const jobs = jobsPayload?.jobs ?? [];
  const disputes = disputesPayload?.disputes ?? [];

  return (
    <AdminDashboardClient
      rooms={rooms}
      jobs={jobs}
      disputes={disputes}
      metrics={metrics ?? null}
      integrity={integrity ?? null}
    />
  );
}
