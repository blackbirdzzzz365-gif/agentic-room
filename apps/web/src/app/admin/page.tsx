import { fetchJson } from "../../lib/api";

export default async function AdminPage() {
  const [roomsPayload, jobsPayload, disputesPayload, metrics] = await Promise.all([
    fetchJson<{ rooms: Array<{ id: string; name: string; status: string; phase: string }> }>("/api/admin/rooms"),
    fetchJson<{ jobs: Array<{ id: string; type: string; status: string; runAt: string }> }>("/api/admin/jobs"),
    fetchJson<{ disputes: Array<{ id: string; roomId: string; category: string; status: string }> }>(
      "/api/admin/disputes"
    ),
    fetchJson<Record<string, unknown>>("/api/admin/metrics")
  ]);
  const rooms = roomsPayload?.rooms ?? [];
  const jobs = jobsPayload?.jobs ?? [];
  const disputes = disputesPayload?.disputes ?? [];

  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1>Admin Console</h1>
      <p style={{ maxWidth: 760, lineHeight: 1.7 }}>
        Operational view for room health, queued jobs, disputes, and coarse metrics emitted by the
        Phase 1 stack.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <article style={{ padding: "1rem", borderRadius: 18, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Rooms tracked</h2>
          <p style={{ fontSize: "2rem", margin: 0 }}>{rooms.length}</p>
        </article>
        <article style={{ padding: "1rem", borderRadius: 18, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Jobs queued</h2>
          <p style={{ fontSize: "2rem", margin: 0 }}>{jobs.filter((job) => job.status !== "DONE").length}</p>
        </article>
        <article style={{ padding: "1rem", borderRadius: 18, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Open disputes</h2>
          <p style={{ fontSize: "2rem", margin: 0 }}>{disputes.filter((dispute) => dispute.status !== "RESOLVED").length}</p>
        </article>
        <article style={{ padding: "1rem", borderRadius: 18, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Metrics snapshot</h2>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(metrics ?? {}, null, 2)}</pre>
        </article>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Rooms</h2>
        {rooms.length === 0 ? (
          <p>No room data available.</p>
        ) : (
          <ul>
            {rooms.map((room) => (
              <li key={room.id}>
                <strong>{room.name}</strong> - {room.status} / phase {room.phase}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Pending Jobs</h2>
        {jobs.length === 0 ? (
          <p>No pending jobs.</p>
        ) : (
          <ul>
            {jobs.map((job) => (
              <li key={job.id}>
                <code>{job.type}</code> - {job.status} - {job.runAt}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Disputes</h2>
        {disputes.length === 0 ? (
          <p>No disputes.</p>
        ) : (
          <ul>
            {disputes.map((dispute) => (
              <li key={dispute.id}>
                {dispute.roomId} - {dispute.category} - {dispute.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
