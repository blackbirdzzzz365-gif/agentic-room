const docs = [
  {
    path: "docs/phase1/01-brd.md",
    label: "BRD",
    body: "Locked business contract for the Agentic Room Phase 1 scope."
  },
  {
    path: "docs/phase1/02-user-stories.md",
    label: "User Stories",
    body: "Story-level behavior and acceptance framing for the MVP."
  },
  {
    path: "docs/phase1/03-solution-architecture.md",
    label: "Solution Architecture",
    body: "High-level service boundaries and collaboration model."
  },
  {
    path: "docs/phase1/04-system-design.md",
    label: "System Design",
    body: "Write model, APIs, algorithms, worker jobs, and operational rules."
  },
  {
    path: "docs/phases/phase-1/checkpoints/README.md",
    label: "Checkpoints",
    body: "Execution plan and validation workflow from CP0 to the final hardening pass."
  }
];

export default function DocsPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1>Implementation Docs</h1>
      <p style={{ maxWidth: 760, lineHeight: 1.7 }}>
        These files are the implementation contract for the repo. The app shell surfaces them here
        so operators have one place to cross-check scope, architecture, and checkpoint expectations.
      </p>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem"
        }}
      >
        {docs.map((doc) => (
          <article
            key={doc.path}
            style={{
              padding: "1rem",
              borderRadius: 18,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(31,26,20,0.08)"
            }}
          >
            <h2 style={{ marginTop: 0 }}>{doc.label}</h2>
            <p>{doc.body}</p>
            <code>{doc.path}</code>
          </article>
        ))}
      </section>
    </main>
  );
}
