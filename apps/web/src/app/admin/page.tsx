import { fetchJson } from "@/lib/api";
import {
  normalizeAdminDisputes,
  normalizeAdminRooms,
  normalizeIntegrity,
  normalizeJobs,
  normalizeMetrics,
} from "@/lib/admin-adapters";
import AdminDashboardClient from "./admin-dashboard-client";

export default async function AdminPage() {
  const [roomsPayload, jobsPayload, disputesPayload, metricsPayload, integrityPayload] =
    await Promise.all([
      fetchJson<unknown>("/api/admin/rooms"),
      fetchJson<unknown>("/api/admin/jobs?limit=50"),
      fetchJson<unknown>("/api/admin/disputes"),
      fetchJson<unknown>("/api/admin/metrics"),
      fetchJson<unknown>("/api/admin/integrity"),
    ]);

  const rooms = normalizeAdminRooms(roomsPayload);
  const jobs = normalizeJobs(jobsPayload);
  const disputes = normalizeAdminDisputes(disputesPayload);
  const metrics = normalizeMetrics(metricsPayload);
  const integrity = normalizeIntegrity(integrityPayload);
  const loadErrors = [
    roomsPayload === null ? "rooms" : null,
    jobsPayload === null ? "jobs" : null,
    disputesPayload === null ? "disputes" : null,
    metricsPayload === null ? "metrics" : null,
    integrityPayload === null ? "integrity" : null,
  ].filter((value): value is string => value !== null);

  return (
    <AdminDashboardClient
      rooms={rooms}
      jobs={jobs}
      disputes={disputes}
      metrics={metrics}
      integrity={integrity}
      loadErrors={loadErrors}
    />
  );
}
