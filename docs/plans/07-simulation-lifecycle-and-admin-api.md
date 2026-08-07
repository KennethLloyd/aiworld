# Plan 07: Simulation Lifecycle and Admin API

Status: Planned
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
- Run One Cycle command
- Manual Trigger Job command
- Telemetry endpoint
- Filtered simulation log endpoint
- Server-side ADMIN authorization

## Scheduler Port

The port exposes lifecycle and command operations — `start`, `stop`,
`runOneCycle`, `triggerJob` — and every operation builds the same serializable
Command objects that the scheduled tick builds. Lifecycle rules (manual work
allowed in RUNNING/PAUSED, rejected in HALTED) are enforced by the state
machine reading `WorldSimulationConfig`, never by the adapter. The in-process
adapter runs a timer derived from `intervalMs`/`jitterMs`/`speedMultiplier`;
the BullMQ adapter maps the same commands onto queue jobs. Adapters never call
an LLM provider directly.

## Lifecycle Rules

- RUNNING allows scheduled work, Run One Cycle, and Manual Trigger Job.
- PAUSED stops scheduled work but allows Run One Cycle and Manual Trigger Job.
- HALTED rejects all manual work and stops scheduled work.
- Lifecycle state is read from persisted WorldSimulationConfig, not process
  memory.
- Scheduled, one-cycle, and manual work create the same serializable command
  shape and use the same executor.

## API Intent

Follow the existing admin convention — resource paths with `@Roles(['ADMIN'])`
— not a new `/api/admin/*` prefix:

- `GET /api/worlds/:slug/simulation`
- `PATCH /api/worlds/:slug/simulation/state`
- `PATCH /api/worlds/:slug/simulation/speed`
- `POST /api/worlds/:slug/simulation/run-one-cycle`
- `POST /api/worlds/:slug/simulation/trigger`
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
Run One Cycle, manual target/action selection, and log refresh.

## Senior-Level Implementation Standard

Use State for lifecycle rules, Command for queue/manual work, Repository for
configuration persistence, and Observer/events only for genuine cross-cutting
telemetry or cache invalidation. Keep the scheduler thin and deterministic
under test: the port owns the contract, the adapters own transport, and the
state machine owns the rules. Persist state transitions before reporting
success.

## Implementation Record

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
