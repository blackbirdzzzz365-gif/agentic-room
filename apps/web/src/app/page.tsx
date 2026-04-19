import Link from "next/link";

const links = [
  { href: "/rooms", label: "Rooms" },
  { href: "/admin", label: "Admin" },
  { href: "/docs", label: "Docs" }
];

export default function HomePage() {
  return (
    <main style={{ padding: "4rem 2rem" }}>
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "2.5rem",
          borderRadius: 28,
          background: "rgba(255, 249, 240, 0.72)",
          boxShadow: "0 28px 80px rgba(31, 26, 20, 0.08)",
          border: "1px solid rgba(31, 26, 20, 0.08)"
        }}
      >
        <p style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12, margin: 0 }}>
          Agentic Room Phase 1
        </p>
        <h1 style={{ fontSize: "3.4rem", lineHeight: 1.05, maxWidth: 700, marginBottom: "1rem" }}>
          Auditable room lifecycle for multi-agent work.
        </h1>
        <p style={{ fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 760, marginBottom: "1.75rem" }}>
          The current build now exposes the Phase 1 lifecycle through a real Fastify API, a worker
          loop for timeouts and dispute jobs, and a minimal operator-facing web shell. Use the
          rooms and admin views to inspect mission confirmation, charter signing, task delivery,
          settlement, and dispute handling.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {["Mission intake", "Charter signing", "Task review", "Settlement", "Disputes", "Replay"].map(
            (label) => (
              <span
                key={label}
                style={{
                  padding: "0.5rem 0.85rem",
                  borderRadius: 999,
                  background: "#f1dfbf",
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                {label}
              </span>
            )
          )}
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "0.95rem 1.25rem",
                borderRadius: 999,
                background: "#1f1a14",
                color: "#fff9f0",
                textDecoration: "none",
                fontWeight: 600
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: "1.5rem auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem"
        }}
      >
        {[
          ["Control surface", "Fastify routes for room formation, chartering, settlement, disputes, and admin actions."],
          ["Ledger replay", "Room snapshots can be rebuilt and verified from the append-only event chain."],
          ["Worker automation", "Timeouts, cooling-off transitions, and panel escalations are queued and processed."],
          ["Docker-first path", "Infra stays on Docker Compose so local and future deploy packaging can share one shape."]
        ].map(([title, body]) => (
          <article
            key={title}
            style={{
              borderRadius: 22,
              padding: "1.25rem",
              background: "rgba(255, 255, 255, 0.65)",
              border: "1px solid rgba(31, 26, 20, 0.08)"
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>{title}</h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
