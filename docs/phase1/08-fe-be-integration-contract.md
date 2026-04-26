# Agentic Room Network — Phase 1 FE-BE Integration Contract

**Version:** 1.0  
**Status:** Locked coordination boundary for parallel FE/BE work  
**Last updated:** 2026-04-21

## Purpose

This document defines the contract between:

- the **backend lane**, which owns domain rules, API translation, persistence, and jobs
- the **frontend lane**, which owns the Next.js web application and user-facing workflows

Its goal is to stop both sides from reverse-engineering each other's assumptions from partially complete code.

From this point forward:

- FE must build against the contracts in this document
- BE must make the runtime satisfy the contracts in this document
- if either side changes the contract, this document must be updated first

## Source of Truth Order

Use the following order when deciding what is canonical:

1. [04-system-design.md](04-system-design.md) for business and protocol behavior
2. `packages/contracts/src/index.ts` for internal domain command schemas
3. This document for FE/BE translation rules and normalized web-facing contracts
4. [07-fe-implementation-contract.md](07-fe-implementation-contract.md) for FE rendering and component rules

## Ownership Matrix

| Area | Owner | Notes |
|---|---|---|
| `packages/domain` | BE | Domain services, state transitions, job processing |
| `packages/contracts` | BE | Internal command schemas and shared enums |
| `packages/db` | BE | Schema and persistence |
| `apps/api` | BE | HTTP translation, auth, request/response shaping |
| `apps/web` | FE | UI flows, view models, web-side adapters, route composition |
| `docs/phase1/08-fe-be-integration-contract.md` | Shared | Must be updated before contract changes land |

## Current Raw Truth vs Locked Coordination Rule

The current `main` branch contains a few known mismatches. This table locks how agents should coordinate from now on.

| Area | Current raw truth on `main` | Locked coordination rule |
|---|---|---|
| Browser mutations | `mutateJson` already calls `/api-proxy/*`, but no proxy route exists yet | FE must keep browser mutations behind same-origin proxy routes; do not expose raw API keys in the browser |
| Actor identity | API authenticates `x-api-key`, but most routes do not inject actor fields expected by domain commands | BE must translate authenticated identity into domain command fields, overwrite any spoofed actor fields from the body, and FE must not send `actorId` or `actorRole` |
| Room detail shape | Domain snapshot returns nested envelope (`room`, `mission`, `members`, etc.) | FE must normalize the snapshot into FE view models before rendering |
| Ratings | Domain supports numeric peer/requester ratings only | FE must adapt the UI to the numeric contract; do not invent comments or unsupported payload fields |
| Settlement proposal | Settlement is system-generated in domain | FE must trigger proposal generation, not submit manual allocation arrays |
| Dispute evidence | Domain snapshot does not currently return rich evidence arrays in room detail | FE must not assume evidence objects are available in snapshot responses unless BE extends the contract and updates this doc |

## Transport and Authentication Contract

### Server-Side Reads

Server-rendered reads in the web app should continue to use `fetchJson` from `apps/web/src/lib/api.ts` with:

- `API_BASE_URL` as the primary server-to-server base URL
- `NEXT_PUBLIC_API_BASE_URL` only as an optional fallback if explicitly needed
- `cache: "no-store"` for runtime-sensitive room/admin views

### Browser-Side Reads

Client polling and client-triggered reads must **not** require the browser to know a secret API key.

Preferred rule:

- browser-side reads should hit same-origin Next endpoints or route handlers
- those server-side handlers may call the API and attach secrets if needed

Do not hardcode secret-bearing backend calls in client components.

### Browser-Side Mutations

All browser-side mutations must go through a same-origin proxy path:

- canonical path prefix: `/api-proxy/*`
- proxy implementation lives in the Next app
- proxy is responsible for forwarding the request to the API and attaching `x-api-key`

The browser must **never** set `x-api-key` directly.

### API Authentication Translation

The external web-to-API contract is:

- FE sends business payload only
- API authenticates the caller with `x-api-key`
- API derives actor identity from the key
- API injects `actorId` and any other required actor fields before calling domain services

This means:

- `apps/web` does not own actor injection
- `apps/api` does own actor injection
- internal domain schemas are allowed to remain actor-aware even if the FE-facing HTTP payload is actor-agnostic

### CORS and Headers

If the API continues to accept browser-originated calls in development, the API must allow `x-api-key` in CORS. If all browser calls move behind Next proxy routes, the browser will not need that header directly.

Either way, FE must not depend on direct secret-bearing browser access.

### Environment Variables

Current canonical env values for web/API coordination:

- `API_BASE_URL`: server-side base URL for the web app to reach the API
- `API_PORT`: API listen port
- `WEB_PORT`: Next app port
- `AGENT_API_KEYS`: API-side map of key to actor identity; values may be legacy actor ID strings or `{ "actorId": "string", "actorRole": "ADMIN | COORDINATOR | CONTRIBUTOR | REVIEWER | OBSERVER | PANELIST" }`
- `AGENT_API_KEY`: web-server-side proxy key used by `/api-proxy/*`; the value must be one key present in `AGENT_API_KEYS`

Do not rely on undocumented env names. The browser must not receive either API key variable.

## Canonical Read Contracts

### Room List

### Endpoint

`GET /api/rooms`

### Response

```json
{
  "rooms": [
    {
      "id": "uuid",
      "name": "Design Sprint Alpha",
      "status": "ACTIVE",
      "phase": 2,
      "memberCount": 4,
      "taskCount": 7,
      "disputeCount": 0,
      "budgetTotal": 12000,
      "executionDeadlineAt": "2026-04-30T12:00:00.000Z",
      "createdAt": "2026-04-18T10:00:00.000Z",
      "updatedAt": "2026-04-20T08:00:00.000Z"
    }
  ]
}
```

This response already maps closely to the FE `RoomSummary` shape.

### Room Detail Snapshot

### Endpoint

`GET /api/rooms/:roomId`

### Raw response shape

The backend currently returns a nested envelope shaped like:

```json
{
  "room": { "...": "..." },
  "mission": { "...": "..." } | null,
  "members": [{ "...": "..." }],
  "charter": { "...": "..." } | null,
  "tasks": [{ "...": "..." }],
  "artifacts": [{ "...": "..." }],
  "settlement": { "...": "..." } | null,
  "disputes": [{ "...": "..." }],
  "events": [{ "...": "..." }],
  "projection": { "...": "..." },
  "verification": { "...": "..." }
}
```

### FE normalization rule

The FE must normalize this envelope into its own `RoomSnapshot` view model before rendering.

Recommended location:

- route-local adapter near `apps/web/src/app/rooms/[roomId]`
- or a dedicated adapter module under `apps/web/src/lib`

### Snapshot mapping table

| Raw field | FE field | Rule |
|---|---|---|
| `room.id` | `id` | direct |
| `room.name` | `name` | direct |
| `room.status` | `status` | direct |
| `room.phase` | `phase` | direct |
| `room.requesterId` | `requesterId` | direct |
| `room.coordinatorId` | `coordinatorId` | direct |
| `room.budgetTotal` | `budgetTotal` | direct |
| `room.executionDeadlineAt` | `executionDeadlineAt` | direct |
| `room.createdAt` | `createdAt` | direct |
| `room.updatedAt` | `updatedAt` | direct |
| `mission.structured.objective` | `mission.objective` | direct when mission exists |
| `mission.structured.deliverables` | `mission.deliverables` | default to `[]` if missing |
| `mission.structured.successCriteria` | `mission.successCriteria` | default to `[]` if missing |
| `mission.structured.constraints` | `mission.constraints` | default to `[]` if missing |
| `mission.confirmedAt` | `mission.confirmedAt` | direct |
| `mission.confirmedAt !== null` | `mission.status` | map to `CONFIRMED`, else `DRAFT` |
| `members[*].memberId` | `members[*].id` and `members[*].memberId` | FE may mirror the same value for now |
| `members[*].role` | `members[*].role` | direct |
| `members[*].status` | `members[*].status` | direct |
| `members[*].joinedAt` | `members[*].joinedAt` | direct |
| `charter.id` | `charter.id` | direct |
| `charter.status` | `charter.status` | direct |
| `charter.bonusPoolPct` | `charter.bonusPoolPct` | direct |
| `charter.malusPoolPct` | `charter.malusPoolPct` | direct |
| `charter.consensusConfig` | `charter.consensusConfig` | direct |
| `charter.baselineSplit` | `charter.baselineSplit` | FE may keep raw record or convert only in a route-local view model |
| `tasks[*]` | `tasks[*]` | map to FE task shape, including `assignedTo -> assigneeId` and `artifact.contentRef -> deliverableUrl` if needed |
| `tasks[*]` | `charter.tasks` | derive charter task definitions from tasks until BE exposes charter tasks separately |
| `settlement.allocations` | `settlement.allocations` | if raw allocations are a record, FE may convert to array for charts/tables |
| `settlement.votes[*]` | `settlement.votes` | FE may convert vote array into a record keyed by `agentId` |
| `disputes[*]` | `disputes[*]` | map summary fields only; do not fabricate evidence arrays |
| `events[*].eventType` | `events[*].type` | rename for FE view model |
| `events[*].timestamp` | `events[*].createdAt` | rename for FE view model |

### Important non-assumptions

FE must not assume:

- dispute evidence exists in room snapshot payloads
- charter signatures are returned as a dedicated object
- room detail already matches `apps/web/src/types/index.ts`

Instead:

- derive charter signature status from `members[*].charterSigned` and `members[*].charterSignedAt`
- derive charter task list from `tasks`
- derive view-only convenience fields in adapters

### Events

### Room events

`GET /api/rooms/:roomId/events`

Current BE should return the ordered ledger events for a room. FE may render them directly or via normalized `RoomEvent` shape, but must preserve:

- chronological order
- actor identity where present
- event payload preview

Do not invent event ordering in the UI.

### Admin Reads

### Rooms

`GET /api/admin/rooms`

Response:

```json
{ "rooms": [...] }
```

### Disputes

`GET /api/admin/disputes`

Response:

```json
{ "disputes": [...] }
```

### Jobs

`GET /api/admin/jobs?limit=N`

Response:

```json
{ "jobs": [...] }
```

### Metrics

`GET /api/admin/metrics`

Response is a metrics object. FE should read fields defensively because some metrics may be added over time.

### Integrity

`GET /api/admin/integrity`

Canonical raw response:

```json
{ "results": [...] }
```

The FE may derive:

- global valid/invalid summary
- per-room health cards
- replay/diff sections

But it must not assume the API already returns aggregate booleans unless that is explicitly added and documented here.

### Replay

`GET /api/admin/rooms/:roomId/replay`

Current API reuses room snapshot/replay data. FE may treat it as a replay viewer input, but if BE later returns a richer replay payload, this document must be updated first.

## Canonical Mutation Contracts

The payloads below are the **locked FE-facing HTTP contracts**. If current runtime differs, BE is responsible for aligning the HTTP layer, not FE for guessing.

### Room Creation

### Endpoint

`POST /api/rooms`

### Body

```json
{
  "name": "string",
  "requesterId": "string",
  "coordinatorId": "string",
  "budgetTotal": 10000,
  "executionDeadlineAt": "2026-05-01T00:00:00.000Z"
}
```

### Rule

FE sends business fields only. API injects actor identity.

### Mission Draft

### Endpoint

`POST /api/rooms/:roomId/mission/draft`

### Body

```json
{
  "rawInput": "Natural-language mission description",
  "structured": {
    "objective": "string",
    "deliverables": ["string"],
    "constraints": ["string"],
    "successCriteria": ["string"],
    "outOfScope": ["string"]
  }
}
```

### FE rule

If the UI captures mission fields as separate form inputs, FE must assemble them into the `structured` object and optionally generate a readable `rawInput` summary. Do not send ad-hoc fields like `objective` at the top level.

### Mission Confirm

### Endpoint

`POST /api/rooms/:roomId/mission/confirm`

### Body

Same shape as mission draft.

### Rule

If FE wants a one-click confirm flow for the latest draft, the API may later support using the latest stored draft with an empty body, but that behavior is not canonical until documented here. For now, FE should send the mission payload explicitly.

### Invite Member

### Endpoint

`POST /api/rooms/:roomId/members/invite`

### Body

```json
{
  "memberId": "string",
  "identityRef": "string",
  "role": "COORDINATOR | CONTRIBUTOR | REVIEWER | OBSERVER | PANELIST | ADMIN"
}
```

### FE rule

If the form only captures `memberId`, FE may default `identityRef` to the same value until a richer identity model exists.

### Accept / Decline Invitation

### Endpoints

- `POST /api/rooms/:roomId/members/:memberId/accept`
- `POST /api/rooms/:roomId/members/:memberId/decline`

### Body

Empty object is acceptable.

### Create Charter

### Endpoint

`POST /api/rooms/:roomId/charters`

### Body

```json
{
  "draft": {
    "version": 1,
    "tasks": [
      {
        "title": "string",
        "description": "string",
        "deliverableSpec": "string",
        "effortEstimate": "S",
        "weight": 1,
        "dependencies": []
      }
    ],
    "baselineSplit": {
      "member-id": 0.5
    },
    "bonusPoolPct": 0.1,
    "malusPoolPct": 0.05,
    "consensusConfig": {
      "settlementQuorumRatio": 0.6,
      "settlementAcceptRatio": 0.6666666667
    },
    "timeoutRules": {
      "invitationWindowHours": 48,
      "charterSignWindowHours": 24,
      "taskClaimWindowHours": 24,
      "taskDeliveryWindowHours": 72,
      "reviewWindowHours": 24,
      "settlementVoteWindowHours": 48,
      "disputeCoolingOffHours": 12,
      "panelReviewWindowHours": 72,
      "disputeResolutionWindowHours": 120
    }
  }
}
```

### FE rule

Do not flatten charter form fields at the top level. Wrap them in `draft`.

`bonusPoolPct` is capped at `0.2` and `malusPoolPct` is capped at `0.1`.

### Sign Charter

### Endpoint

`POST /api/rooms/:roomId/charters/:charterId/sign`

### Body

Empty object is acceptable.

### Decline Charter

### Endpoint

`POST /api/rooms/:roomId/charters/:charterId/decline`

### Body

```json
{
  "reason": "string"
}
```

### Claim / Unclaim Task

### Endpoints

- `POST /api/rooms/:roomId/tasks/:taskId/claim`
- `POST /api/rooms/:roomId/tasks/:taskId/unclaim`

### Body

Empty object is acceptable.

### Deliver Task

### Endpoint

`POST /api/rooms/:roomId/tasks/:taskId/deliver`

### Body

```json
{
  "contentRef": "string",
  "contentType": "string"
}
```

### FE rule

If the UI captures a URL and notes separately, map the URL to `contentRef`. Do not send unsupported fields such as `deliverableUrl` or `notes` unless BE extends the contract and this document is updated.

### Review Task

### Endpoint

`POST /api/rooms/:roomId/tasks/:taskId/review`

### Body

```json
{
  "verdict": "ACCEPTED | REJECTED",
  "notes": "string"
}
```

`notes` is required.

### Peer Rating

### Endpoint

`POST /api/rooms/:roomId/ratings/peer`

### Body

```json
{
  "targetId": "string",
  "signal": -1
}
```

### Rule

The canonical Phase 1 contract is a numeric peer signal in the range `-1..1`. FE must not invent `comment` fields or a separate 5-star payload without a contract revision.

### Requester Rating

### Endpoint

`POST /api/rooms/:roomId/ratings/requester`

### Body

```json
{
  "targetId": "string",
  "rating": 8
}
```

### Rule

The canonical requester rating range is `0..10`.

If FE uses a star-based control, it must explicitly map it into this range and document the mapping in code.

### Propose Settlement

### Endpoint

`POST /api/rooms/:roomId/settlement/propose`

### Body

Empty object is acceptable.

### Rule

Settlement is **system-generated** from accepted tasks and ratings. FE must not submit manual `allocations` arrays for the canonical Phase 1 flow.

The route is an idempotent trigger:

- BE may auto-generate the proposal once execution reaches a terminal state
- FE may still call `POST /settlement/propose` safely to ensure proposal generation without synthesizing settlement state client-side

### Vote Settlement

### Endpoint

`POST /api/rooms/:roomId/settlement/votes`

### Body

```json
{
  "proposalId": "uuid",
  "vote": "ACCEPT | REJECT | ABSTAIN",
  "reason": "string"
}
```

### Rule

- `reason` is required for reject votes
- FE must read `proposalId` from the current settlement payload, not synthesize one

### File Dispute

### Endpoint

`POST /api/rooms/:roomId/disputes`

### Body

```json
{
  "category": "OPERATIONAL | ECONOMIC",
  "subType": "string",
  "respondentId": "string",
  "remedySought": "string",
  "evidence": [
    {
      "type": "ROOM_EVENT_REF | ARTIFACT_REF | TASK_RECORD_REF | CONSENSUS_ROUND_REF",
      "ledgerRef": "string"
    }
  ]
}
```

### Rule

Evidence is ledger-oriented in the current contract. FE must not send `{ url, description }` objects unless BE expands the contract and this document is updated.

### Admin Mutations

### Run Due Jobs

`POST /api/admin/jobs/run-due`

Body:

```json
{
  "limit": 25
}
```

`limit` is optional.

### Override Room

`POST /api/admin/rooms/:roomId/override`

Body:

```json
{
  "status": "ACTIVE | FAILED | SETTLED | DISPUTED",
  "phase": "0 | 1 | 2 | 3 | 4 | 5",
  "reason": "string"
}
```

### Assign Dispute Panel

`POST /api/admin/rooms/:roomId/disputes/:disputeId/panel`

Body:

```json
{
  "panelists": ["string", "string", "string"]
}
```

### Resolve Dispute

`POST /api/admin/rooms/:roomId/disputes/:disputeId/resolve`

Body:

```json
{
  "resolution": {
    "summary": "string",
    "rationale": "string",
    "remedy": "string"
  },
  "nextRoomStatus": "ACTIVE | IN_SETTLEMENT | DISPUTED | FAILED | SETTLED"
}
```

`nextRoomStatus` is optional.

## FE Normalization Strategy

The FE should standardize on explicit adapters instead of leaking raw API envelopes through the component tree.

Recommended adapter boundaries:

- room list adapter for `/api/rooms`
- room detail adapter for `/api/rooms/:roomId`
- admin metrics adapter
- integrity adapter

Component rule:

- presentational components consume FE view models
- adapters consume raw API shapes

This keeps future BE hardening from forcing widespread JSX rewrites.

## Contract Change Workflow

If BE changes a route, payload, or response shape:

1. Update this document first.
2. Update the API implementation.
3. Update FE adapters/types.
4. Run end-to-end smoke checks.

If FE wants to send new payload fields:

1. Propose the change here.
2. Get the BE lane to implement it.
3. Only then ship the FE mutation.

## Definition of Done for Integration Work

FE/BE integration work is only done when:

- the API route exists
- the payload contract matches this document
- secrets stay server-side
- FE renders normalized view models, not raw envelopes
- the Docker stack and local web flow both work without hand-edited request payloads

If the runtime and this document differ, fix the runtime or revise the document. Do not rely on hidden tribal knowledge.
