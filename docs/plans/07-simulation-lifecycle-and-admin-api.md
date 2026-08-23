# Plan 07: Simulation Lifecycle and Admin API

Status: In Progress
Revised 2026-08-07 per `docs/research/plan-05-11-drift-report.md`, ADR-0001.

## Goal

Make the simulation operational through persisted lifecycle state, scheduled
jobs, and admin-only controls that use the same command pipeline as scheduled
work.

## Scope

- WorldSimulationConfig repository and state machine
- `SimulationScheduler` port with two interchangeable adapters (ADR-0001):
  a BullMQ adapter as the runtime implementation (Redis via docker-compose,
  matching the product plan's retries and dead-letter queues) and an in-process
  adapter as the test/CI/offline implementation
- Randomized scheduler interval and jitter
- Weighted action selection
- Character-backed AI Resident selection with activity balancing
- RUNNING, PAUSED, and HALTED lifecycle
- Speed multiplier range validation (0.1-100) in the shared contract; the
  presets shown in the admin UI are vocabulary, not schema values
- Run One Action command
- Custom Action command
- Telemetry endpoint
- Filtered simulation log endpoint
- Server-side ADMIN authorization

## Scheduler Port

The port exposes lifecycle and command operations — `start`, `stop`,
`runOneAction`, `runCustomAction` — and every operation builds the same serializable
Command objects that the scheduled tick builds. Lifecycle rules (manual work
allowed in RUNNING/PAUSED, rejected in HALTED) are enforced by the state
machine reading `WorldSimulationConfig`, never by the adapter. The in-process
adapter runs a timer derived from `intervalMs`/`jitterMs`/`speedMultiplier`;
the BullMQ adapter maps the same commands onto queue jobs. Adapters never call
an LLM provider directly.

Run One Action executes exactly one scheduler iteration — one AI Resident's
Character, one weighted action — through the same executor path as a scheduled
tick. It does
NOT run the fixed POST → VOTE → COMMENT triple that Plan 06's e2e helper
performs; that triple is test-only and has no product caller (see
`docs/plans/06-mock-simulation-engine.md`, Ticket 41 Known Risks).

## Lifecycle Rules

- RUNNING allows scheduled work, Run One Action, and Custom Action.
- PAUSED stops scheduled work but allows Run One Action and Custom Action.
- HALTED rejects all manual work and stops scheduled work.
- Lifecycle state is read from persisted WorldSimulationConfig, not process
  memory.
- Scheduled, one-action, and custom work create the same serializable command
  shape and use the same executor.

## API Intent

Follow the existing admin convention — resource paths with `@Roles(['ADMIN'])`
— not a new `/api/admin/*` prefix:

- `GET /api/worlds/:slug/simulation`
- `PATCH /api/worlds/:slug/simulation/state`
- `PATCH /api/worlds/:slug/simulation/speed`
- `POST /api/worlds/:slug/simulation/run-one-action`
- `POST /api/worlds/:slug/simulation/custom-action`
- `GET /api/worlds/:slug/simulation/telemetry`
- `GET /api/worlds/:slug/simulation/logs`

Finalize names and response shapes in shared contracts before controllers are
implemented. Admin controllers mutate configuration or enqueue commands; they
must never call an LLM provider directly.

## Tests

- State transitions and invalid transitions are covered by state-machine tests.
- HALTED rejects manual work at the service boundary and HTTP boundary.
- Speed multiplier is range-validated (0.1-100) at the shared contract boundary.
- Scheduler adapters are interchangeable through the port: BullMQ jobs
  serialize and deserialize the same command shape; the in-process adapter is
  deterministic under test and needs no Redis.
- Redis runs in docker-compose for local and CI e2e; scheduler unit tests
  inject the in-process adapter.
- Scheduler jitter and action weighting are testable with injected randomness.
- Admin authorization returns 401/403 correctly.
- Logs can be filtered by Character/AI Resident, action, status, and execution
  source.
- Queue failures are retried and represented in SimulationLog.

## Browser Verification

Use the OpenAPI page for the API checkpoint:

```bash
agent-browser --session aiworld-admin-api open http://localhost:3000/api/docs
agent-browser --session aiworld-admin-api wait --load networkidle
agent-browser --session aiworld-admin-api snapshot -i
agent-browser --session aiworld-admin-api find text "simulation"
agent-browser --session aiworld-admin-api close
```

The authenticated control-room interaction is implemented and automated in
Plan 10. Its browser assertions must cover state feedback, HALTED refusal,
Run One Action, manual target/action selection, and log refresh.

## Senior-Level Implementation Standard

Use State for lifecycle rules, Command for queue/manual work, Repository for
configuration persistence, and Observer/events only for genuine cross-cutting
telemetry or cache invalidation. Keep the scheduler thin and deterministic
under test: the port owns the contract, the adapters own transport, and the
state machine owns the rules. Persist state transitions before reporting
success.

## Triage Decisions (2026-08-13)

Issue #43 was triaged in a grill-with-docs session; the decisions below are the
engineering contract for 07-2 (also recorded in the ticket body).

- **Demo/runtime path**: the BullMQ adapter is the default for dev, demo, and
  runtime; Redis is added to `apps/api/docker-compose.yml`. `SCHEDULER_ADAPTER`
  env selects the adapter (zod-validated, empty-as-absent, fail-fast on
  invalid), mirroring `provider-config.ts`. The in-process adapter is the
  test/offline override.
- **Contracts**: command schema in `packages/shared/src/schemas/`
  (`simulation-command.schema.ts`): `worldSlug`, `characterId`, `actionType`,
  `executionSource` (`scheduled|one-action|custom`), `issuedAt`.
  Speed-multiplier validation (0.1-100) and the interval/jitter derivation
  math live in shared, consumed by both adapters.
- **Mechanism**: self-rescheduling delayed job (BullMQ) / chained `setTimeout`
  (in-process); completion-to-start cadence; worker concurrency 1; never
  `setInterval` or BullMQ repeatable jobs.
- **Lifecycle integration**: transitions drive the port (`stop()` on
  PAUSED/HALTED, `start()` on →RUNNING; boot resumes persisted RUNNING).
  `stop()` removes the single pending delayed tick — never `queue.pause()`.
  In-flight ticks complete; the executor gate (`assertScheduledWorkAllowed`)
  rejects the transition race window; rejected ticks are logged (a REJECTED
  SimulationLog status), never retried. PAUSED keeps manual controls live;
  only HALTED rejects them (`assertManualWorkAllowed`).
- **Operations**: `runOneAction` (`POST /run-one-action`) = the scheduler's
  task run manually — same random pick/roll, no overrides, awaits the result,
  source `one-action`. `runCustomAction` (`POST /custom-action`) = the composed
  job — Character-backed AI Resident (specific or Any Character) × action
  (forced or Automatic),
  awaits the result, source `custom`. "cycle" is removed from the vocabulary.
- **Retries**: transient (LLM timeout/5xx/rate-limit) → exponential backoff, 3
  attempts (tunable); permanent (validation, unknown world/character, provider
  4xx) → no retry → DLQ; rejection ≠ failure. Every attempt logged with status
  + BullMQ jobId.
- **e2e/CI**: Redis service in docker-compose (local) and as a CI service
  container (CI uses GitHub Actions service containers, not the compose file).
  e2e drives the BullMQ adapter; unit tests inject the in-process adapter.
- **Pacing**: seed `intervalMs: 1800000`, `jitterMs: 300000`,
  `speedMultiplier: 1` (~48 actions/day/world; demo uses the speed multiplier
  and the manual controls).
- **Failure escalation**: manual-only HALT for MVP; auto-HALT is a Known Risk
  (the explicit Run transition is the recovery path).
- **Naming**: UI labels "Run One Action" / "Custom Action"; executionSource
  `scheduled | one-action | custom`; glossary gains **Iteration** and **Tick**.

## Implementation Record

Status: In Progress (07-1 and 07-2 delivered — PRs #111, #113 merged
2026-08-13; 07-3 admin API implemented — PR #114 open pending review)

### Senior-Level Summary

07-1 delivers the persisted simulation lifecycle: a
`WorldSimulationConfigRepository` port backed by a Prisma adapter, a pure state
machine for the RUNNING/PAUSED/HALTED lifecycle, and a
`SimulationLifecycleService` that enforces the rules against persisted state.
The lifecycle vocabulary (`SimulationState`) is a plain union in the domain so
ports and services never depend on the generated Prisma enum; only the Prisma
adapter maps to and from the database enum. The state machine owns the rules:
scheduled ticks run only while RUNNING, manual work (Run One Action / Custom
Action) is allowed in RUNNING and PAUSED and rejected in HALTED. HALTED can
only leave through an explicit Run transition. The service always reads configuration from the
repository — never from process memory — validates a transition against the
persisted state, and persists the new state before success is reported; the
repository's `transitionState` update is conditional on the persisted state, so
a concurrent change surfaces as an error instead of silently landing a
stale-validated write. This slots in ahead of the scheduler port (07-2) and
admin API (07-3), which will consume `assertScheduledWorkAllowed`,
`assertManualWorkAllowed`, and the transition methods.

### Files Changed

- `apps/api/src/simulation/lifecycle/domain/simulation-state.ts` — lifecycle vocabulary
- `apps/api/src/simulation/lifecycle/domain/world-simulation-config-record.ts` — domain record
- `apps/api/src/simulation/lifecycle/simulation-lifecycle-rules.ts` — state machine (allowed transitions, work gates)
- `apps/api/src/simulation/lifecycle/simulation-lifecycle.error.ts` — not-found, invalid-transition, concurrent-change, malformed-config, and work-rejection errors
- `apps/api/src/simulation/lifecycle/simulation-lifecycle.service.ts` — rule enforcement
- `apps/api/src/simulation/lifecycle/simulation-lifecycle-rules.spec.ts` — state-machine tests
- `apps/api/src/simulation/lifecycle/simulation-lifecycle.service.spec.ts` — service tests
- `apps/api/src/simulation/lifecycle/world-simulation-config-repository.interface.ts` — repository port
- `apps/api/src/simulation/lifecycle/prisma-world-simulation-config.repository.ts` — Prisma adapter (atomic state transition)
- `apps/api/src/simulation/lifecycle/prisma-world-simulation-config.repository.spec.ts` — adapter tests
- `apps/api/src/simulation/simulation.module.ts` — wired and exported lifecycle providers

### Architecture and SOLID Notes

- State machine: lifecycle rules are centralized in pure functions and the
  service delegates to them — no scattered if/else in services or controllers.
- Repository boundary: services depend on the abstract
  `WorldSimulationConfigRepository`; generated Prisma types stay inside the
  adapter, matching the existing world/simulation-log repository pattern.
- Persisted state: no in-memory state; every gate and transition reads the
  persisted `WorldSimulationConfig`, and transitions are persisted before
  success is returned. The adapter transitions atomically (`updateMany` keyed
  on the expected state), so read-then-write races fail loudly.
- Strict reads: malformed persisted `actionWeights` surface as an error rather
  than being silently replaced with defaults.

### Tests Run

- `pnpm --filter @aiworld/api test` — 52 suites, 299 tests (35 new)
- `pnpm --filter @aiworld/api build`
- `pnpm --filter @aiworld/api lint`
- `pnpm format:check`

### Browser Verification

Not applicable to 07-1 (no HTTP surface yet; the admin API lands in 07-3).

### Known Risks and Follow-Up Work

- The scheduler (07-2) must gate ticks with `assertScheduledWorkAllowed` and
  manual commands with `assertManualWorkAllowed`.
- The admin API (07-3) should map lifecycle errors (not-found, invalid
  transition, manual-work rejected) to HTTP responses and add e2e coverage for
  the repository adapter.
- HALTED can be restarted only through the explicit Run transition; manual
  actions remain rejected until the persisted state is RUNNING.

### 07-2 Scheduler Port Implementation (2026-08-13)

Implements triage decisions 1–10 above. The `SimulationScheduler` port
(`start`/`stop`/`runOneAction`/`runCustomAction`) is backed by two
interchangeable adapters selected via `SCHEDULER_ADAPTER` (zod-validated,
empty-string-as-absent, fail-fast on invalid values — mirrors
`apps/api/src/lib/llm/provider-config.ts`): the BullMQ adapter (runtime
default; self-rescheduling delayed job, completion-to-start cadence, worker
concurrency 1, exponential backoff with 3 attempts, permanent errors to a
dead-letter queue, `removeOnFail: false` for at-least-once awareness) and the
in-process adapter (chained `setTimeout`, the test/offline override). Both
build the same serializable `SimulationCommand` (shared schema in
`packages/shared/src/schemas/simulation-command.schema.ts`: `worldSlug`,
`characterId`, `actionType`, `executionSource` `scheduled|one-action|custom`,
`issuedAt`) and run ticks through the same `SimulationTickRunner`, which
delegates to the executor — adapters never call an LLM provider directly.
Randomization (interval + jitter derivation, weighted action selection,
activity-balanced character selection) lives behind an injected
`SimulationRandomSource` so tests are deterministic. Lifecycle integration:
`SimulationLifecycleService` now drives the port (`start` on →RUNNING, `stop`
on PAUSED/HALTED; `stop` removes the single pending delayed tick, never
`queue.pause()`), boot resume uses the new `findAllByState` repository method,
and the executor gates ticks through `assertScheduledWorkAllowed` /
`assertManualWorkAllowed`. `SimulationLog` gains a REJECTED status
(rejection ≠ failure, never retried) and `jobId` so retried/stalled
duplicates are visibly the same job; the persisted enum stays SCREAMING_SNAKE
with a lowercase domain transport mapping in the adapter.

#### Files Changed

- `packages/shared/src/schemas/simulation-command.schema.ts` — command schema, speed-multiplier validation (0.1–100), interval/jitter derivation
- `apps/api/src/simulation/scheduler/simulation-scheduler.port.ts` — port
- `apps/api/src/simulation/scheduler/simulation-scheduler.base.ts` — shared adapter base: manual operations compose the same command, scheduled-command composition, require helpers
- `apps/api/src/simulation/scheduler/bullmq-scheduler.adapter.ts` (+spec) — runtime adapter, retries, DLQ, pending-tick removal by tracked id
- `apps/api/src/simulation/scheduler/in-process-scheduler.adapter.ts` (+spec) — test/offline adapter
- `apps/api/src/simulation/scheduler/simulation-scheduler-config.ts` (+spec) — `SCHEDULER_ADAPTER` env, `REDIS_URL`, attempts, retry delay
- `apps/api/src/simulation/scheduler/simulation-iteration-picker.ts` (+spec) — weighted action + activity-balanced character selection
- `apps/api/src/simulation/scheduler/simulation-random-source.ts` — injected randomness seam
- `apps/api/src/simulation/scheduler/simulation-tick-runner.ts` (+spec) — shared tick execution path (command-in)
- `apps/api/src/simulation/scheduler/simulation-scheduler.error.ts` — picker errors + transient-error classification
- `apps/api/src/simulation/scheduler/simulation-scheduler-bootstrap.ts` — adapter selection/wiring
- `apps/api/src/simulation/scheduler/simulation-casting-repository.interface.ts`, `prisma-simulation-casting.repository.ts`
- `apps/api/src/simulation/lifecycle/simulation-lifecycle.service.ts` (+spec) — scheduler driving on transitions, state restore on drive failure
- `apps/api/src/simulation/lifecycle/world-simulation-config-repository.interface.ts` (+Prisma adapter) — `findAllByState` for boot resume
- `apps/api/src/simulation/logging/*` — REJECTED status, `jobId`, source mapping
- `apps/api/prisma/models/simulation-log.prisma` + `migrations/20260813100000_scheduler_execution_sources/` — enum + `jobId`
- `apps/api/prisma/seed-world.ts` — pacing `intervalMs: 1800000`, `jitterMs: 300000`, `speedMultiplier: 1`
- `apps/api/docker-compose.yml` — redis service (local e2e + demo)
- `.github/workflows/ci.yml` — redis service container for the e2e job
- `apps/api/test/simulation-scheduler.e2e-spec.ts` — BullMQ e2e against real Redis
- `apps/api/.env.example` — scheduler env documentation

#### Code-Review Rework (2026-08-13, PR #113 review findings)

Review findings were resolved before merge; each finding and its resolution:

- **Standards 1 + Spec a2 (shared command + duplicated pass-throughs)**: both
  adapters now extend `SimulationSchedulerBase`. `runOneAction` /
  `runCustomAction` live in the base and build the same serializable
  `SimulationCommand` a scheduled tick builds (`simulationCommandSchema.parse`)
  before calling the runner; `requireConfig`/`requireWorld`/`requireWorldBySlug`
  are shared helpers. The tick runner's public API is command-in, result-out.
- **Standards 2 + 3 (repeated switch, `targetPostId ?? ''`)**: the runner no
  longer has its own POST/VOTE/COMMENT dispatch switch and never papers over an
  impossible target — it branches POST vs targeted action, and a VOTE/COMMENT
  either has a picked target or fails permanently (`NO_ACTIVE_TARGET`) with a
  FAILED log. The executor is the single action dispatcher.
- **Standards 4 (`issuedAt` never read)**: kept as contract-mandated transport
  metadata (triage decision 2 requires it in the schema); it audits when a job
  was issued and is preserved identically across both adapters.
- **Standards 5 (timer vocabulary)**: in-process adapter renamed its map to
  `scheduledTicks` and its local variable to `handle`; no `timer`/`cron` words.
- **Standards 6 (stop scans the queue)**: `stop()` removes the single pending
  delayed job by its tracked `jobId` (O(1)); the queue scan is now start/boot
  only, where a previous process's job ids are unknowable.
- **Spec a1 (pre-executor failures unlogged)**: `runScheduledTick` catches
  thrown errors and writes a FAILED `SimulationLog` (with the `jobId`) before
  returning a failed result. A tick whose World was deleted is the one case
  that cannot be logged (worldId foreign key) and remains DLQ-only.
- **Spec c1 (duplicate content on picker failure)**: scheduling the next tick
  after a completed tick can never retry the job. `composeScheduledCommand`
  returns null for permanent conditions (not RUNNING / deleted world / no
  active AI Residents) — the cadence stops, nothing is re-run; a scheduling throw
  dead-letters instead of retrying.
- **Spec c2 (all errors mapped to UnrecoverableError)**: `isTransientSchedulerError`
  classifies transient errors (LLM timeout/5xx/rate-limit via the provider
  flag, plus Prisma `P1001`/`P1008`/`P1017`/`P2024` connection and timeout
  codes) so a transient write-path hiccup backs off instead of dead-lettering;
  only permanent errors and enqueue-after-complete failures fail permanently.
- **Spec c3 (stuck-RUNNING on drive failure)**: `transitionTo` persists the
  state, drives the scheduler, and on a drive failure compensates back to the
  previous persisted state (best-effort) so the database never claims RUNNING
  while no tick is scheduled.
- **Scope creep b1 (vote dedup)**: kept, with justification — the database
  already enforces one vote per member per post (partial unique index
  `vote_member_post_unique` from ADR-0002's duplicate-vote prevention). The
  scheduler's random targeting makes repeat targets likely, so the vote action
  maps that existing constraint onto a SKIPPED decision (and avoids a wasted
  provider call) instead of surfacing a permanent FAILED per retarget. The
  scheduler e2e fails without it.
- **Scope creep b2**: `PickedActor.memberId` removed (never consumed downstream).
  `WorldRepository.findById` kept — the scheduler needs the worldId → slug
  mapping to compose transport commands. `NO_ACTIVE_TARGET` kept as the minimal
  handling for a forced VOTE/COMMENT on an empty World.

#### Tests Run

- `pnpm --filter @aiworld/api test` — unit suites incl. new scheduler specs (70 scheduler tests; 380 total)
- `pnpm --filter @aiworld/api exec jest --config ./test/jest-e2e.json` — 11 suites, 101 tests (BullMQ adapter against real Redis)
- `pnpm --filter @aiworld/web test` — 22 files, 118 tests
- `pnpm build` (api + web), `pnpm lint`, `pnpm format:check`

#### Known Risks and Follow-Up Work

- The Jest e2e run warns "did not exit cleanly" (BullMQ/ioredis handle left
  open); `--detectOpenHandles` found nothing in the scheduler suites — worth a
  follow-up to close the worker/queue connection cleanly.
- Auto-HALT after consecutive failures remains a follow-up (triage decision 9;
  the existing explicit Run transition is the recovery path).
- Local dev on the OCI box: honcho's redis owns 127.0.0.1:6379, so aiworld's
  redis runs on 6380 via `~/aiworld-compose.override.yml` and
  `REDIS_URL=redis://localhost:6380` (repo default stays 6379).

### 07-3 Admin Simulation API (2026-08-13, issue #44)

The admin control surface for simulation: read lifecycle state, change state
and speed, run one scheduler iteration or a custom action by hand, and read
telemetry and filtered logs — every endpoint behind `@Roles(['ADMIN'])` with
server-side authorization. Contracts were finalized in `packages/shared` before
the controllers were written, and controllers only read/mutate persisted
configuration or enqueue commands through the scheduler port — they never call
an LLM provider directly.

#### Senior-Level Summary

A thin `SimulationAdminController` (`worlds/:slug/simulation/*`) delegates to a
`SimulationAdminService` that owns world-by-slug resolution and forwards to the
existing boundaries: `SimulationLifecycleService` (state transitions and speed
updates), `SimulationScheduler` (Run One Action / Custom Action, awaited through
the same tick runner as scheduled work), and `SimulationLogRepository` (filtered
logs and telemetry aggregates). The response mapper drops raw decisions and
provider payloads, and the log/telemetry contracts deliberately exclude
`promptUsed`/`responseRaw` so telemetry exposes no provider secrets. A small
`mapSimulationAdminError` helper converts lifecycle domain errors to HTTP
statuses at the controller boundary — missing world/config to 404; invalid or
concurrent transitions, HALTED manual-work refusal, and picker failures to 409 —
keeping services free of HTTP vocabulary.

The speed multiplier is range-validated (0.1-100) at the shared contract
boundary (`simulationSpeedMultiplierSchema`, already owned by
`simulation-command.schema`), consumed by the PATCH body and OpenAPI alike. Log
filters (character, action, status, execution source) run inside the Prisma
adapter against the persisted enum, with the lowercase transport vocabulary
mapped at the adapter as 07-2 established. HALTED refusal is enforced at the
service boundary by the lifecycle's `assertManualWorkAllowed` — now invoked in
the scheduler base before command composition so a HALTED world rejects with
409 even when the picker could not find a resident — and again by the tick
runner's gate as the second line of defense.

#### Files Changed

- `packages/shared/src/schemas/simulation-state.schema.ts` — state/config response + update state/speed contracts
- `packages/shared/src/schemas/simulation-log.schema.ts` — log response (no provider secrets), list query, list response, status vocabulary
- `packages/shared/src/schemas/simulation-run.schema.ts` — custom-action body + run result response
- `packages/shared/src/schemas/simulation-telemetry.schema.ts` — telemetry aggregates response
- `apps/api/src/simulation/domain/simulation-telemetry.ts` — operator-facing telemetry record + empty helper
- `apps/api/src/simulation/domain/simulation-log.ts`, `lifecycle/domain/simulation-state.ts` — vocabulary re-exported from shared (single source of truth)
- `apps/api/src/simulation/admin/simulation-admin.controller.ts` (+spec) — 7 ADMIN endpoints
- `apps/api/src/simulation/admin/simulation-admin.service.ts` (+spec) — orchestration
- `apps/api/src/simulation/admin/simulation-admin-response.mapper.ts` (+spec) — domain → transport
- `apps/api/src/simulation/admin/simulation-admin.errors.ts` (+spec) — domain → HTTP status mapping
- `apps/api/src/simulation/admin/simulation-admin.openapi.ts` (+spec) — OpenAPI registration
- `apps/api/src/simulation/admin/simulation-admin.schema.spec.ts` — shared contract tests
- `apps/api/src/simulation/lifecycle/world-simulation-config-repository.interface.ts` + Prisma adapter (+spec) — `updateSpeedMultiplier`
- `apps/api/src/simulation/lifecycle/simulation-lifecycle.service.ts` (+spec) — `updateSpeed`
- `apps/api/src/simulation/logging/simulation-log-repository.interface.ts` + Prisma adapter — `findMany` (filters) and `getTelemetry`
- `apps/api/src/simulation/scheduler/simulation-scheduler.base.ts` — manual-work gate before composition
- `apps/api/src/simulation/scheduler/simulation-casting-repository.interface.ts` + Prisma adapter — `findActiveActor` world-membership check
- `apps/api/src/simulation/scheduler/simulation-scheduler.error.ts` — `SimulationCharacterNotActiveError` (foreign character in a custom action)
- `apps/api/src/simulation/simulation.module.ts` — controller + admin providers wired
- `apps/api/src/lib/openapi/openapi.ts` + `world.openapi.spec.ts` — simulation paths registered
- `apps/api/test/simulation-admin.e2e-spec.ts` — 21 HTTP e2e tests against real Postgres

#### Architecture and SOLID Notes

- Thin controllers: no controller calls a provider, repository, or scheduler
  directly — everything routes through `SimulationAdminService`, matching the
  existing world/character controller→service→repository shape.
- Contracts finalized in shared first: the controller, the mapper, and the
  OpenAPI document all consume the same Zod schemas, so names and shapes cannot
  drift. `simulationStates` and the log statuses are re-exported by the API
  domain files, making shared the single vocabulary owner.
- Repository boundary: filters and telemetry aggregation live in the Prisma
  adapter; the port exposes domain-shaped inputs and records, and generated
  Prisma types stay inside the adapter.
- Error mapping is one pure function at the controller seam; domain services
  never import `@nestjs/common`.
- HALTED rejection is enforced by the state machine, not the transport: the
  base's `assertManualWorkAllowed` (service boundary) and the tick runner's
  gate (race window) both delegate to the lifecycle rules.
- Custom-action character picks are world-scoped at the composition seam: the
  scheduler base validates an explicit `characterId` against the World's active
  AI members (`findActiveActor`) before any command is built, so a foreign
  character rejects with a 400 (via `SimulationCharacterNotActiveError`) instead
  of silently logging a `failed` run. Any Character / Automatic resolution is
  unchanged.

#### Tests Run

- `pnpm --filter @aiworld/api test` — 64 suites, 461 tests (incl. 37 shared-contract, admin service/controller/mapper/errors/openapi, scheduler gate and custom-action world-scope)
- `pnpm --filter @aiworld/api test:e2e` — 12 suites, 123 tests (incl. 22 admin API e2e, driving the BullMQ adapter against real Redis/Postgres)
- `pnpm --filter @aiworld/web test` — 22 files, 118 tests
- `pnpm build` (api + web), `pnpm lint`, `pnpm format:check`

#### Browser Verification

Not applicable to 07-3: the API checkpoint is the OpenAPI page, and the
authenticated control-room interaction is implemented and automated in Plan 10.
The 7 simulation paths are registered in the OpenAPI document
(`worlds/{slug}/simulation` and children) via `createOpenApiDocument` — the
same document served at `/api/docs` — and asserted by the scripted
`simulation-admin.openapi.spec.ts` (paths, ADMIN security, and the 401/403/404
and 400/409 responses), so the plan's OpenAPI-page browser checkpoint is
covered by that automated spec.

#### Known Risks and Follow-Up Work

- Manual runs (Run One Action / Custom Action) deliberately bypass the
  scheduler retry policy (triage decision 6). They await the caller, so a
  transient failure (LLM timeout / 5xx / rate limit) surfaces immediately in
  the run result with `failure.retryable: true` rather than backing off inside
  the HTTP request; the retry/DLQ policy governs scheduled queue work only. The
  caller owns the retry — the admin can re-issue the action. Recorded as a
  deliberate deviation from decision 6, not an oversight.
- The controller repeats a try/catch `mapSimulationAdminError` wrapper per
  handler; a controller-scoped domain→HTTP exception filter would remove the
  repetition if this pattern grows beyond one controller.
- A world with no active AI characters rejects Run One / Custom Action with 409
  (picker failure mapped at the HTTP boundary); a future UX could explain this
  state more explicitly.
- The Plan 10 admin control room consumes these endpoints; its browser
  assertions must cover state feedback, HALTED refusal, Run One Action, manual
  target/action selection, and log refresh.
- The known "did not exit cleanly" e2e warning (BullMQ/ioredis handle) is
  tracked separately.
- Local dev on the OCI box: honcho's redis owns 127.0.0.1:6379, so aiworld's
  redis runs on 6380 via `~/aiworld-compose.override.yml` and
  `REDIS_URL=redis://localhost:6380` (repo default stays 6379).

#### Product Decisions (PR #114 review, confirmed by Kenneth 2026-08-14)

- Manual runs bypass the scheduler retry policy — confirmed by Kenneth
  2026-08-14 (manual runs await the caller).
- Log responses keep provider/model — confirmed by Kenneth 2026-08-14.

### Scheduler Configuration Hardening (2026-08-17)

The checked-in API environment example now uses the concrete value
`SCHEDULER_ADAPTER=bullmq`. The previous `"bullmq" | "in-process"` notation was
loaded literally by dotenv and caused scheduler configuration validation to
fail during local Nest startup. The local environment was corrected to use the
same scalar value. Verification covers the scheduler config unit suite and a
successful `pnpm run dev` startup.
