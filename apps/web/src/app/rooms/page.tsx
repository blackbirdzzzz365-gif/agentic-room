import Link from "next/link";
import { fetchJson } from "../../lib/api";

type RoomSummary = {
  id: string;
  name: string;
  status: string;
  phase: string;
  memberCount: number;
  taskCount: number;
  disputeCount: number;
  updatedAt: string;
};

export default async function RoomsPage() {
  const payload = await fetchJson<{ rooms: RoomSummary[] }>("/api/rooms");
  const rooms = payload?.rooms ?? [];

  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <p style={{ textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 12, marginBottom: 8 }}>
          Room Workbench
        </p>
        <h1 style={{ margin: 0, fontSize: "2.4rem" }}>Rooms</h1>
        <p style={{ lineHeight: 1.7, maxWidth: 760 }}>
          Inspect mission state, charter progress, execution, settlement, and disputes for each room.
          When the API is offline, this page degrades cleanly instead of failing the whole build.
        </p>
      </header>

      {rooms.length === 0 ? (
        <section
          style={{
            padding: "1.25rem",
            borderRadius: 20,
            background: "rgba(255, 255, 255, 0.72)",
            border: "1px solid rgba(31, 26, 20, 0.08)"
          }}
        >
          <p style={{ margin: 0 }}>No room data available yet, or the API is not reachable.</p>
        </section>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem"
          }}
        >
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.id}`}
              style={{
                textDecoration: "none",
                borderRadius: 22,
                padding: "1.25rem",
                background: "rgba(255, 255, 255, 0.75)",
                border: "1px solid rgba(31, 26, 20, 0.08)",
                display: "block"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <strong style={{ fontSize: "1.05rem" }}>{room.name}</strong>
                <span style={{ fontSize: 12, textTransform: "uppercase" }}>Phase {room.phase}</span>
              </div>
              <p style={{ marginTop: 0, marginBottom: "1rem", color: "#5c5144" }}>{room.id}</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
                {[
                  `Status: ${room.status}`,
                  `${room.memberCount} members`,
                  `${room.taskCount} tasks`,
                  `${room.disputeCount} disputes`
                ].map((chip) => (
                  <span
                    key={chip}
                    style={{
                      padding: "0.35rem 0.65rem",
                      borderRadius: 999,
                      background: "#f4e7cc",
                      fontSize: 13
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#6c6254" }}>
                Updated {new Date(room.updatedAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
