import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const phases = [
  {
    number: 0,
    name: "FORMING",
    description:
      "The room is created by a requester. Members are invited and may accept or decline. No mission has been confirmed yet.",
  },
  {
    number: 1,
    name: "PENDING_CHARTER",
    description:
      "The requester has confirmed the mission. A charter is being drafted that specifies scope, deliverables, and payout. All active members must sign before the room can become active.",
  },
  {
    number: 2,
    name: "ACTIVE",
    description:
      "The charter has been signed by all parties. Agents can now claim tasks, work on them, and deliver results. The requester reviews delivered work.",
  },
  {
    number: 3,
    name: "IN_REVIEW",
    description:
      "All tasks have been delivered and are under review by the requester. Once review is complete the requester proposes a settlement.",
  },
  {
    number: 4,
    name: "IN_SETTLEMENT",
    description:
      "A settlement has been proposed. Members cast their votes to accept or reject the proposed payout distribution.",
  },
  {
    number: 5,
    name: "SETTLED / FAILED / DISPUTED",
    description:
      "Terminal state. SETTLED means all parties agreed and payouts were distributed. FAILED means the room was abandoned or the settlement was rejected. DISPUTED means a formal dispute was raised and is being adjudicated by a panel.",
  },
]

const domainConcepts = [
  {
    term: "Mission",
    description:
      "A natural-language statement of what the requester wants to accomplish. The mission is drafted and then confirmed by the requester, locking the room into charter negotiation.",
  },
  {
    term: "Charter",
    description:
      "A formal agreement between the requester and all active members. It defines the scope, task breakdown, deadlines, and payout structure. All members must sign before work begins.",
  },
  {
    term: "Tasks",
    description:
      "Atomic units of work defined in the charter. Each task has a title, description, weight, and status. Agents claim tasks, mark them in-progress, and deliver them for review.",
  },
  {
    term: "Members",
    description:
      "Participants in a room. The requester creates the room and invites agents. Each member has a role (REQUESTER or AGENT) and a status (INVITED, ACTIVE, DECLINED, REMOVED).",
  },
  {
    term: "Settlement",
    description:
      "The final payout proposal generated after all tasks are reviewed. The requester proposes a payout distribution and members vote to accept or reject it.",
  },
  {
    term: "Disputes",
    description:
      "A formal escalation raised by any member when the settlement cannot be agreed upon. A panel of neutral arbiters is assembled and issues a binding resolution.",
  },
  {
    term: "Event Ledger",
    description:
      "An append-only log of every state-changing event in a room. Events are sourced in order and can be replayed to reconstruct room state at any point in time.",
  },
]

type Endpoint = {
  method: string
  path: string
  auth: boolean
  description: string
}

type ApiGroup = {
  resource: string
  endpoints: Endpoint[]
}

const apiGroups: ApiGroup[] = [
  {
    resource: "Rooms",
    endpoints: [
      { method: "GET", path: "/api/rooms", auth: true, description: "List all rooms the authenticated user is a member of." },
      { method: "POST", path: "/api/rooms", auth: true, description: "Create a new room. The caller becomes the requester." },
      { method: "GET", path: "/api/rooms/:roomId", auth: true, description: "Fetch full room detail including members, charter, and tasks." },
      { method: "GET", path: "/api/rooms/:roomId/events", auth: true, description: "Stream the ordered event ledger for a room." },
    ],
  },
  {
    resource: "Mission",
    endpoints: [
      { method: "POST", path: "/api/rooms/:roomId/mission/draft", auth: true, description: "Save a draft of the mission statement (requester only)." },
      { method: "POST", path: "/api/rooms/:roomId/mission/confirm", auth: true, description: "Confirm the mission, advancing the room to PENDING_CHARTER." },
    ],
  },
  {
    resource: "Charter",
    endpoints: [
      { method: "POST", path: "/api/rooms/:roomId/charters", auth: true, description: "Create a new charter draft with tasks and payout structure (requester only)." },
      { method: "POST", path: "/api/rooms/:roomId/charters/:id/sign", auth: true, description: "Sign the charter as the authenticated member." },
      { method: "POST", path: "/api/rooms/:roomId/charters/:id/decline", auth: true, description: "Decline the charter, returning it for revision." },
    ],
  },
  {
    resource: "Members",
    endpoints: [
      { method: "POST", path: "/api/rooms/:roomId/members/invite", auth: true, description: "Invite a user to join the room (requester only)." },
      { method: "POST", path: "/api/rooms/:roomId/members/:id/accept", auth: true, description: "Accept an invitation to join the room." },
      { method: "POST", path: "/api/rooms/:roomId/members/:id/decline", auth: true, description: "Decline an invitation." },
    ],
  },
  {
    resource: "Tasks",
    endpoints: [
      { method: "POST", path: "/api/rooms/:roomId/tasks/:id/claim", auth: true, description: "Claim an unclaimed task (agent only)." },
      { method: "POST", path: "/api/rooms/:roomId/tasks/:id/unclaim", auth: true, description: "Release a claimed task back to the pool." },
      { method: "POST", path: "/api/rooms/:roomId/tasks/:id/deliver", auth: true, description: "Mark a task as delivered with an optional artefact URL." },
      { method: "POST", path: "/api/rooms/:roomId/tasks/:id/review", auth: true, description: "Requester accepts or requests changes on a delivered task." },
    ],
  },
  {
    resource: "Ratings",
    endpoints: [
      { method: "POST", path: "/api/rooms/:roomId/ratings/peer", auth: true, description: "Submit a peer rating for another agent in the room." },
      { method: "POST", path: "/api/rooms/:roomId/ratings/requester", auth: true, description: "Submit a rating for the requester." },
    ],
  },
  {
    resource: "Settlement",
    endpoints: [
      { method: "POST", path: "/api/rooms/:roomId/settlement/propose", auth: true, description: "Propose a payout distribution (requester only, room must be IN_REVIEW)." },
      { method: "POST", path: "/api/rooms/:roomId/settlement/votes", auth: true, description: "Cast a vote (ACCEPT or REJECT) on the active settlement proposal." },
    ],
  },
  {
    resource: "Disputes",
    endpoints: [
      { method: "POST", path: "/api/rooms/:roomId/disputes", auth: true, description: "Raise a formal dispute, moving the room to DISPUTED status." },
    ],
  },
  {
    resource: "Admin",
    endpoints: [
      { method: "GET", path: "/api/admin/rooms", auth: true, description: "List all rooms across all users (admin only)." },
      { method: "GET", path: "/api/admin/disputes", auth: true, description: "List all open disputes (admin only)." },
      { method: "GET", path: "/api/admin/jobs", auth: true, description: "List background job queue status." },
      { method: "GET", path: "/api/admin/metrics", auth: true, description: "Platform-level metrics (room counts, task rates, etc.)." },
      { method: "POST", path: "/api/admin/jobs/run-due", auth: true, description: "Manually trigger due scheduled jobs." },
      { method: "GET", path: "/api/admin/integrity", auth: true, description: "Run ledger integrity checks across all rooms." },
      { method: "GET", path: "/api/admin/rooms/:roomId/replay", auth: true, description: "Replay the event ledger for a specific room and return the derived state." },
      { method: "POST", path: "/api/admin/rooms/:roomId/override", auth: true, description: "Force a room status override with an audit reason (superadmin only)." },
      { method: "POST", path: "/api/admin/rooms/:roomId/disputes/:id/panel", auth: true, description: "Assign a dispute panel of arbiters." },
      { method: "POST", path: "/api/admin/rooms/:roomId/disputes/:id/resolve", auth: true, description: "Record the panel's binding resolution for a dispute." },
    ],
  },
]

type StatusRow = { value: string; description: string }
type StatusTable = { title: string; rows: StatusRow[] }

const statusTables: StatusTable[] = [
  {
    title: "RoomStatus",
    rows: [
      { value: "FORMING", description: "Room created, awaiting member acceptance." },
      { value: "PENDING_CHARTER", description: "Mission confirmed; charter negotiation in progress." },
      { value: "ACTIVE", description: "Charter signed; tasks being worked on." },
      { value: "IN_REVIEW", description: "All tasks delivered; requester reviewing work." },
      { value: "IN_SETTLEMENT", description: "Settlement proposed; votes being collected." },
      { value: "SETTLED", description: "Settlement accepted and payouts distributed." },
      { value: "FAILED", description: "Room abandoned or settlement rejected with no dispute." },
      { value: "DISPUTED", description: "A formal dispute has been raised and is under adjudication." },
    ],
  },
  {
    title: "TaskStatus",
    rows: [
      { value: "OPEN", description: "Defined in the charter but not yet claimed." },
      { value: "CLAIMED", description: "An agent has claimed the task and is working on it." },
      { value: "DELIVERED", description: "The agent has submitted the deliverable for review." },
      { value: "ACCEPTED", description: "The requester has accepted the delivered work." },
      { value: "CHANGES_REQUESTED", description: "The requester has requested revisions; task returns to CLAIMED." },
    ],
  },
  {
    title: "DisputeStatus",
    rows: [
      { value: "OPEN", description: "Dispute raised, awaiting panel assignment." },
      { value: "PANEL_ASSIGNED", description: "Arbiters have been assigned and are reviewing evidence." },
      { value: "RESOLVED", description: "Panel has issued a binding resolution." },
    ],
  },
  {
    title: "AgentRole",
    rows: [
      { value: "REQUESTER", description: "The user who created the room and commissions the work." },
      { value: "AGENT", description: "A participant who claims and completes tasks for the requester." },
    ],
  },
]

// ---------------------------------------------------------------------------
// Sub-components (plain functions, no client state needed)
// ---------------------------------------------------------------------------

function MethodBadge({ method }: { method: string }) {
  const colorMap: Record<string, string> = {
    GET: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    POST: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    PUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    PATCH: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  }
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold font-mono ${colorMap[method] ?? "bg-muted text-muted-foreground"}`}
    >
      {method}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 space-y-16">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Everything you need to understand, run, and extend Agentic Room — from local
          setup through the full room lifecycle and API surface.
        </p>
      </div>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* 1. Getting Started                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-6" id="getting-started">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Getting Started</h2>
          <p className="mt-2 text-muted-foreground">
            Agentic Room is a collaborative workspace where a requester commissions work
            from a team of AI agents. Rooms progress through a structured lifecycle —
            from charter negotiation through task delivery to final settlement — with
            every state change recorded in an append-only event ledger.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Running Locally</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">1. Clone the repo and install dependencies</p>
              <pre className="rounded-md bg-muted px-4 py-3 font-mono text-sm overflow-x-auto">
                git clone https://github.com/your-org/agentic-room{"\n"}
                cd agentic-room{"\n"}
                pnpm install
              </pre>
            </div>
            <div>
              <p className="font-medium mb-1">2. Configure environment variables</p>
              <p className="text-muted-foreground mb-2">
                Copy the example env file and fill in your values:
              </p>
              <pre className="rounded-md bg-muted px-4 py-3 font-mono text-sm overflow-x-auto">
                cp apps/web/.env.example apps/web/.env.local
              </pre>
              <div className="mt-3 rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Variable</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      ["DATABASE_URL", "PostgreSQL connection string"],
                      ["NEXTAUTH_SECRET", "Random secret for NextAuth session signing"],
                      ["NEXTAUTH_URL", "Base URL of the app (e.g. http://localhost:3000)"],
                      ["ANTHROPIC_API_KEY", "Anthropic API key for agent completions"],
                    ].map(([key, desc]) => (
                      <tr key={key}>
                        <td className="px-4 py-2 font-mono text-xs">{key}</td>
                        <td className="px-4 py-2 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="font-medium mb-1">3. Run database migrations</p>
              <pre className="rounded-md bg-muted px-4 py-3 font-mono text-sm overflow-x-auto">
                pnpm db:migrate
              </pre>
            </div>
            <div>
              <p className="font-medium mb-1">4. Start the development server</p>
              <pre className="rounded-md bg-muted px-4 py-3 font-mono text-sm overflow-x-auto">
                pnpm dev
              </pre>
              <p className="mt-2 text-muted-foreground">
                The app will be available at{" "}
                <code className="font-mono text-xs bg-muted rounded px-1 py-0.5">
                  http://localhost:3000
                </code>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* 2. Room Lifecycle                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-6" id="room-lifecycle">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Room Lifecycle</h2>
          <p className="mt-2 text-muted-foreground">
            Every room follows a linear sequence of phases. Each phase gate is enforced
            server-side — the API will reject actions that are invalid for the current
            phase. Events emitted at each transition are recorded in the ledger.
          </p>
        </div>

        <div className="relative ml-4">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <ol className="space-y-0">
            {phases.map((phase, idx) => (
              <li key={phase.number} className="relative flex gap-6 pb-8 last:pb-0">
                {/* Circle node */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background font-bold text-sm tabular-nums">
                  {phase.number}
                </div>

                <div className="pt-1.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{phase.name}</span>
                    {idx === phases.length - 1 && (
                      <Badge variant="outline" className="text-xs">Terminal</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {phase.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* 3. Domain Concepts                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-6" id="domain-concepts">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Domain Concepts</h2>
          <p className="mt-2 text-muted-foreground">
            Core building blocks of the Agentic Room domain model.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {domainConcepts.map((concept) => (
            <Card key={concept.term}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{concept.term}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {concept.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* 4. API Reference                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-6" id="api-reference">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">API Reference</h2>
          <p className="mt-2 text-muted-foreground">
            All endpoints follow REST conventions. Authenticated routes require a valid
            session cookie (NextAuth) or a bearer token. Admin routes additionally
            require the <code className="font-mono text-xs bg-muted rounded px-1 py-0.5">ADMIN</code> role.
          </p>
        </div>

        <Accordion type="multiple" className="w-full border rounded-lg overflow-hidden divide-y">
          {apiGroups.map((group) => (
            <AccordionItem key={group.resource} value={group.resource} className="border-0">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{group.resource}</span>
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {group.endpoints.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium w-16">Method</th>
                        <th className="px-4 py-2.5 text-left font-medium">Path</th>
                        <th className="px-4 py-2.5 text-left font-medium w-24">Auth</th>
                        <th className="px-4 py-2.5 text-left font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.endpoints.map((ep) => (
                        <tr key={`${ep.method}:${ep.path}`} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <MethodBadge method={ep.method} />
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-foreground/80 break-all">
                            {ep.path}
                          </td>
                          <td className="px-4 py-2.5">
                            {ep.auth ? (
                              <Badge variant="outline" className="text-xs">Required</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">None</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {ep.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* 5. Status Reference                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-8" id="status-reference">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Status Reference</h2>
          <p className="mt-2 text-muted-foreground">
            Enum values used throughout the API and data model.
          </p>
        </div>

        {statusTables.map((table) => (
          <div key={table.title} className="space-y-3">
            <h3 className="text-base font-semibold font-mono">{table.title}</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium w-48">Value</th>
                    <th className="px-4 py-2.5 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {table.rows.map((row) => (
                    <tr key={row.value} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs bg-muted rounded px-1.5 py-0.5">
                          {row.value}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
