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
- Character selection with activity balancing
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

Run One Action executes exactly one scheduler iteration — one character, one
weighted action — through the same executor path as a scheduled tick. It does
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
- Logs can be filtered by character, action, status, and execution source.
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
  job — character (specific or Any Resident) × action (forced or Automatic),
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
  (07-1 models HALTED as terminal, so it touches the allowed-transitions
  table).
- **Naming**: UI labels "Run One Action" / "Custom Action"; executionSource
  `scheduled | one-action | custom`; glossary gains **Iteration** and **Tick**.

## Implementation Record

Status: In Progress (07-1 delivered; 07-2 triaged 2026-08-13 — see Triage
Decisions below; scheduler implementation and 07-3 admin API remain)

### Senior-Level Summary

07-1 delivers the persisted simulation lifecycle: a
`WorldSimulationConfigRepository` port backed by a Prisma adapter, a pure state
machine for the RUNNING/PAUSED/HALTED lifecycle, and a
`SimulationLifecycleService` that enforces the rules against persisted state.
The lifecycle vocabulary (`SimulationState`) is a plain union in the domain so
ports and services never depend on the generated Prisma enum; only the Prisma
adapter maps to and from the database enum. The state machine owns the rules:
scheduled ticks run only while RUNNING, manual work (Run One Action / Custom
Action) is allowed in RUNNING and PAUSED and rejected in HALTED, and
HALTED is terminal for the MVP. The service always reads configuration from the
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
- HALTED is modeled as terminal for the MVP; if product later requires
  re-enabling a halted simulation, the allowed-transitions table is the single
  place to change.
