# neo-poc — an Appian-style travel approval app on Flowable

A production-shaped re-implementation of a standard Appian application (the **Travel Request /
Travel Expense approval** showcase: *Add Business Trip → receipts branch → supervisor approval →
finance approval → write records*) using our own frontend, backend, database and a **Flowable**
workflow engine instead of the Appian platform.

The point of this repo is the **execution architecture**: how workflow state moves through the
system, where business logic lives, and how Flowable is kept strictly as the orchestration engine.

---

## Architecture

### The decision: hybrid, engine behind the API layer

```
Browser
  │  HTTPS + httpOnly session cookie
  ▼
Next.js  apps/web          presentation + BFF (session, redirects) — no business logic
  │  internal REST (session cookie forwarded server-side)
  ▼
NestJS   apps/api          application/API layer: use-cases, authN/Z, domain rules, owns the app DB
  │  internal REST (service token)        │  async outbox worker
  ▼                                      ▼
Spring Boot apps/workflow (embedded Flowable)     notifications / integrations (app layer)
  │  BPMN: user tasks, service tasks, gateways, timers, history
  ▼
Postgres: schema `flowable` (ACT_*/flw_*)   +   schema `app` (domain data)
```

**Option B, refined into a hybrid.** The frontend only ever talks to the backend; the backend
*drives* the engine (start / complete / query) **and** the engine *calls back* into the backend
for every service task. Option A (frontend → engine → backend) was rejected because it leaks
engine concerns into the UI, couples the product to Flowable's API/version, and puts record/field
authorisation in the wrong layer.

### Workflow ownership (the important rule)

- **Flowable never reads or writes business tables.** It owns only its own `flowable` schema plus
  process variables that hold identifiers/control data (`requestId`, `amount`, `hasReceipts`).
- **All business-data access goes through the NestJS application layer.** Every BPMN service task
  is a thin Java adapter that calls an internal NestJS endpoint; none of them run SQL.
- Enforced at the database level: separate Postgres roles, **no cross-schema grants**
  (`bash scripts/verify-db-isolation.sh` proves it).

### Sync vs async

| Synchronous (user waiting) | Asynchronous / event-driven |
| --- | --- |
| login/session, all page reads | email + in-app notifications |
| submit-and-start (returns at first wait state) | receipt document generation (`flowable:async`) |
| complete a user task (returns at next wait state) | SLA reminders / escalation timers |
| dashboard/task inbox reads | long service tasks, integrations, retries |

Cross-service consistency uses a **transactional outbox**: the domain row and a `workflow.startProcess`
job are committed in one transaction, then a worker starts the process (immediately for snappy UX,
with polling retry if it fails). Process starts are idempotent on `businessKey`.

### Who owns the truth

The engine is the source of truth for **process state**; the application owns **business data**.
Because service-task side effects commit in the application layer, a rolled-back engine transaction
can leave a request projection disagreeing with the engine. A **reconciliation job**
(`ReconciliationService`, every `RECONCILIATION_INTERVAL_SECONDS`) re-derives `status` /
`workflowStatus` / `currentTaskKey` from the engine for every non-terminal request and repairs any
drift, recording an `RECONCILED` audit event. It can also be triggered on demand:
`POST /api/internal/reconciliation/run` (service token).

Two rules make that drift rare in the first place: engine **commands are never wrapped in an ambient
transaction** (the command commits, then state is read back — a failure while mapping the response
can't roll back work that already succeeded), and the app-side effect handlers (booking, status,
notifications, audit) are **idempotent** so a retried service task converges instead of duplicating.
Reconciliation deliberately does **not** trust the app's own `workflowStatus` to decide what to
check, because that value is exactly what can be wrong.

### Execution lifecycle (one operation, end to end)

1. Employee opens a page → RSC calls NestJS through the BFF (cookie-authenticated).
2. NestJS guards resolve identity → groups → permissions.
3. Employee submits the form → Server Action → `Requests.submit()` (business rules, totals).
4. NestJS writes `travel_requests` + an outbox job in one transaction, then starts the process
   (`businessKey = requestId`).
5. Flowable runs: `recordSubmission` → `hasReceipts?`
   - **yes** → async `generateReceiptDocument` → `employeeSignAndSubmit` user task
   - **no** → straight on
6. `notifyManager` → `managerApproval` user task (candidate group `supervisors`, SLA timers armed).
7. Supervisor opens the inbox (NestJS queries Flowable, returns app-shaped DTOs) and decides.
8. Flowable evaluates the gateway → `evaluatePolicy` (finance threshold) → optional `financeApproval`
   → `finalizeRequest` → `notifyOutcome` → end.
9. NestJS keeps the request projection in sync and records `approval_decisions` + `audit_events`.
10. Frontend reflects the new state via `revalidatePath`.

### Service boundaries

| Concern | Owner |
| --- | --- |
| Presentation, forms, client state | `apps/web` |
| Session cookie, redirect gating, request shaping | `apps/web` BFF (`proxy.ts`, Server Actions) |
| REST contract, validation, authN/Z | `apps/api` controllers + guards |
| Use-cases, business rules, domain data | `apps/api` services (Requests, Tasks, Notifications, Identity…) |
| BPMN runtime: user tasks, gateways, timers, history | `apps/workflow` (Flowable) |
| Engine schema + domain schema | Postgres `flowable` / `app` |
| Emails, doc gen, integrations, retries | app-layer worker (outbox) |

---

## Appian → this implementation

| Appian | Here |
| --- | --- |
| Site / Page | Next.js App Router pages + role-aware nav |
| SAIL interface / Form | React form + shared zod schema (`packages/contracts`) |
| Record type / Record | Postgres table (`app` schema) + Prisma model + list/detail pages |
| Report | dashboard aggregation (server-side in NestJS) |
| **Process Model** | **BPMN 2.0** (`apps/workflow/.../processes/travelRequestApproval.bpmn20.xml`) |
| Process start form | `/requests/new` Server Action → `startProcess` |
| User Input Task | Flowable **user task** + our task form keyed by `formKey` |
| Script Task / Smart Service | Flowable **service task** → `JavaDelegate` adapter → NestJS service |
| Gateways / conditional flow | BPMN **exclusive gateways** on process variables |
| Timer events | BPMN **boundary timer events** (reminder + interrupting escalation) |
| Process variables | Flowable process variables (IDs/control data only) |
| Expression Rule / Business Rule | `InternalService.evaluatePolicy()` in NestJS (finance threshold) |
| Constant | env/config (`FINANCE_APPROVAL_THRESHOLD`, …) |
| Group / Permission | Identity module (users · groups · permissions) + guards |
| User task security | NestJS task-level authorisation (defence in depth over candidate groups) |
| Notification (News / email) | `notifications` table + centre, pushed live over SSE |
| Integration object | `IntegrationsService` + a `TravelBookingProvider` port, recorded in `integration_logs` |
| Process history / Audit | Flowable `ACT_HI_*` + `app.audit_events` |
| Attachments | `attachments` table + local file storage, streamed to the browser through the BFF |

**Deliberate deviation:** Flowable **Open Source** implements business rules in a Business Rule
Task via Drools `.drl` files — DMN decision tables wired into BPMN are an enterprise feature. The
finance-approval rule is therefore implemented in the application layer (which is also where the
architecture says business logic belongs), not as a DMN task.

---

## Repository layout

```
apps/
  api/                 NestJS application layer (auth, requests, tasks, notifications, workflow client, outbox)
    prisma/            domain schema + seed
  web/                 Next.js 16 app (App Router, Server Actions, proxy.ts)
  workflow/            Spring Boot service with embedded Flowable + BPMN/processes
packages/
  contracts/           shared zod schemas + types (used by api and web)
  ui/                  shadcn "base-nova" component library
infra/postgres/init/   schema + role bootstrap (isolation)
scripts/               verify-db-isolation.sh, e2e-travel-request.sh
docker-compose.yml     Postgres 17 + workflow service
```

---

## Running it

Prerequisites: Node 20+, pnpm, Docker.

```bash
pnpm install
docker compose up -d                            # Postgres + Flowable workflow service (:8081)
pnpm --filter api db:push                        # create the app schema
pnpm --filter api db:seed                        # groups + demo users
pnpm dev                                         # api (:3001) + web (:3000)
```

### Without Docker (local Postgres + Maven)

Prerequisites: Node 20+, pnpm, a local PostgreSQL, plus JDK 21+ and Maven for the workflow service.

1. Create the `neo` database and bootstrap the roles/schemas (as the Postgres superuser):

```bash
createdb -U postgres neo
psql -U postgres -d neo -f infra/postgres/init/01-init.sql
```

2. Run the workflow service against that database (default port `5432`). It is a plain Spring
   Boot app, so Maven runs it directly — no container needed:

```bash
mvn -f apps/workflow/pom.xml -DskipTests spring-boot:run \
  -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:postgresql://localhost:5432/neo --spring.datasource.username=flowable --spring.datasource.password=flowable"
```

3. Point `apps/api/.env` at the same database, then create the app schema, seed and start the app.
   Note the `@workspace/contracts` package ships compiled output, so build it once before `dev`:

```bash
pnpm --filter @workspace/contracts build
pnpm --filter api db:push
pnpm --filter api db:seed
pnpm dev
```

Open <http://localhost:3000> and sign in with any of (password `password`):

| Account | Role |
| --- | --- |
| `employee1@neo.dev` | employee |
| `manager1@neo.dev` | employee + supervisor |
| `finance1@neo.dev` | finance |

Submit a request as the employee, then switch to the manager account to approve it. Requests above
`FINANCE_APPROVAL_THRESHOLD` (default 1000) also require finance approval. Approved requests are
booked through the integration and get a booking reference; receipt requests add an employee
sign-off step where a signed document can be attached.

The UI keeps itself current: the sidebar shows a **Live** indicator and refreshes server components
whenever the notification stream reports a change.

### Verifying

```bash
pnpm run verify          # typecheck + lint + build + schema isolation + end-to-end workflow
pnpm run test:workflow   # engine-side JUnit tests (in-memory H2, no external services)
```

Individually, with the stack up (`docker compose up -d`, `pnpm --filter api dev`):

```bash
pnpm run typecheck && pnpm run lint && pnpm run build   # all workspaces
bash scripts/verify-db-isolation.sh                  # engine/domain schema isolation
bash scripts/e2e-travel-request.sh                   # both scenarios, integrations, attachments, authz
```

The end-to-end script also guards two bugs found in practice: completing a task whose variables
contain a null value must succeed and must not roll back, and the engine's 404/403 must survive the
trip to the UI rather than becoming a 503.

The SLA timers can be shortened for testing:

```bash
MANAGER_REMINDER_DURATION=PT4S MANAGER_ESCALATION_DURATION=PT9S pnpm --filter api dev
```

---

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://app:app@localhost:5433/neo?schema=app` | domain schema |
| `JWT_SECRET` | dev value | session signing |
| `WORKFLOW_BASE_URL` | `http://localhost:8081` | Flowable service |
| `WORKFLOW_INTERNAL_TOKEN` | `dev-internal-token` | service-to-service auth (both directions) |
| `WORKFLOW_PROCESS_KEY` | `travelRequestApproval` | process to start |
| `FINANCE_APPROVAL_THRESHOLD` | `1000` | finance-approval business rule |
| `MANAGER_REMINDER_DURATION` | `PT48H` | SLA reminder timer |
| `MANAGER_ESCALATION_DURATION` | `PT120H` | SLA escalation timer |
| `RECONCILIATION_INTERVAL_SECONDS` | `15` | projection reconciliation cadence (`0` disables) |
| `STORAGE_DIR` (api) | `./storage` | where uploaded attachments are written |
| `API_BASE_URL` (web) | `http://localhost:3001/api` | BFF → API |

---

## Known limitations / next steps

- **Dual-write window.** A service-task side effect committed in the app layer can outlive a rolled
  back engine transaction. Handlers are idempotent, the engine is the source of truth, and the
  reconciliation job converges the projection — but the window between the side effect and the
  repair is non-zero. An engine-side outbox would close it completely.
- Reconciliation reads the engine for every non-terminal request; at scale this should be driven by
  engine events (the event registry) rather than polling. The SSE stream likewise reads on an
  interval server-side (it only *pushes* on change) rather than subscribing to engine events.
- Attachments are written to local disk (`STORAGE_DIR`); swap `AttachmentsService` for object
  storage in production.
- The booking provider is a deterministic mock (`MockTravelBookingProvider`); wire a real HTTP client
  behind the same `TravelBookingProvider` port.
- Flowable's Identity engine is intentionally disabled — our Identity module is the source of truth;
  Flowable treats `assignee`/`candidateGroups` as opaque strings.
