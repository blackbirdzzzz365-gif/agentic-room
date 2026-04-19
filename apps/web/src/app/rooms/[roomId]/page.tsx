import Link from "next/link";
import { fetchJson } from "../../../lib/api";

type RoomSnapshot = {
  room: {
    id: string;
    name: string;
    status: string;
    phase: string;
    executionDeadlineAt: string;
  };
  mission: {
    rawInput: string;
    confirmedAt: string | null;
  } | null;
  members: Array<{
    memberId: string;
    role: string;
    status: string;
    charterSigned: boolean;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignedTo: string | null;
    deliveryCount: number;
  }>;
  settlement: {
    status: string;
    allocations: Record<string, number>;
  } | null;
  disputes: Array<{
    id: string;
    status: string;
    category: string;
    subType: string;
  }>;
  verification: {
    ok: boolean;
    errors: string[];
  };
};

export default async function RoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const snapshot = await fetchJson<RoomSnapshot>(`/api/rooms/${roomId}`);

  if (!snapshot) {
    return (
      <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
        <p>
          Room data is unavailable. <Link href="/rooms">Back to rooms</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <Link href="/rooms" style={{ display: "inline-block", marginBottom: "1rem" }}>
        Back to rooms
      </Link>
      <header
        style={{
          padding: "1.5rem",
          borderRadius: 24,
          background: "rgba(255, 255, 255, 0.78)",
          border: "1px solid rgba(31, 26, 20, 0.08)",
          marginBottom: "1rem"
        }}
      >
        <p style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12, marginBottom: 8 }}>
          Phase {snapshot.room.phase}
        </p>
        <h1 style={{ margin: 0 }}>{snapshot.room.name}</h1>
        <p style={{ marginBottom: 0 }}>
          Status {snapshot.room.status}. Execution deadline{" "}
          {new Date(snapshot.room.executionDeadlineAt).toLocaleString()}.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem"
        }}
      >
        <article style={{ padding: "1.25rem", borderRadius: 20, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0 }}>Mission</h2>
          <p>{snapshot.mission?.rawInput ?? "Mission not confirmed yet."}</p>
          <p style={{ marginBottom: 0, color: "#6c6254" }}>
            Confirmed at {snapshot.mission?.confirmedAt ? new Date(snapshot.mission.confirmedAt).toLocaleString() : "n/a"}
          </p>
        </article>

        <article style={{ padding: "1.25rem", borderRadius: 20, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0 }}>Members</h2>
          <ul style={{ paddingLeft: "1.1rem", marginBottom: 0 }}>
            {snapshot.members.map((member) => (
              <li key={member.memberId}>
                {member.memberId} - {member.role} - {member.status} - sign {member.charterSigned ? "yes" : "no"}
              </li>
            ))}
          </ul>
        </article>

        <article style={{ padding: "1.25rem", borderRadius: 20, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0 }}>Ledger Verification</h2>
          <p>{snapshot.verification.ok ? "Hash chain verified." : "Ledger verification failed."}</p>
          {!snapshot.verification.ok && (
            <ul style={{ paddingLeft: "1.1rem", marginBottom: 0 }}>
              {snapshot.verification.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
        <article style={{ padding: "1.25rem", borderRadius: 20, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0 }}>Tasks</h2>
          <ul style={{ paddingLeft: "1.1rem", marginBottom: 0 }}>
            {snapshot.tasks.map((task) => (
              <li key={task.id}>
                {task.title} - {task.status}
                {task.assignedTo ? ` - ${task.assignedTo}` : ""} - deliveries {task.deliveryCount}
              </li>
            ))}
          </ul>
        </article>

        <article style={{ padding: "1.25rem", borderRadius: 20, background: "rgba(255,255,255,0.72)" }}>
          <h2 style={{ marginTop: 0 }}>Settlement & Disputes</h2>
          <p>Settlement: {snapshot.settlement?.status ?? "not proposed"}</p>
          {snapshot.settlement && (
            <ul style={{ paddingLeft: "1.1rem" }}>
              {Object.entries(snapshot.settlement.allocations).map(([agentId, amount]) => (
                <li key={agentId}>
                  {agentId}: {amount}
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginBottom: "0.5rem" }}>Disputes</p>
          <ul style={{ paddingLeft: "1.1rem", marginBottom: 0 }}>
            {snapshot.disputes.length === 0 ? (
              <li>No disputes.</li>
            ) : (
              snapshot.disputes.map((dispute) => (
                <li key={dispute.id}>
                  {dispute.category}/{dispute.subType} - {dispute.status}
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </main>
  );
}
