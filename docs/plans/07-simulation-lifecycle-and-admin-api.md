# Plan 07: Simulation Lifecycle and Admin API

Status: Planned

## Goal

Make the simulation operational through persisted lifecycle state, scheduled
jobs, and admin-only controls that use the same command pipeline as scheduled
work.

## Scope

- WorldSimulationConfig repository and state machine
- BullMQ and Redis integration
- Randomized scheduler interval and jitter
- Weighted action selection
- Character selection with activity balancing
- RUNNING, PAUSED, and HALTED lifecycle
- Speed presets: 0.5x, 1x, 2x, 5x, 10x
- Run One Cycle command
- Manual Trigger Job command
- Telemetry endpoint
- Filtered simulation log endpoint
- Server-side ADMIN authorization

## Lifecycle Rules

- RUNNING allows scheduled work, Run One Cycle, and Manual Trigger Job.
- PAUSED stops scheduled work but allows Run One Cycle and Manual Trigger Job.
- HALTED rejects all manual work and stops scheduled work.
- Lifecycle state is read from persisted WorldSimulationConfig, not process
  memory.
- Scheduled, one-cycle, and manual work create the same serializable command
  shape and use the same executor.

## API Intent

- `GET /api/admin/worlds/:slug/simulation`
- `PATCH /api/admin/worlds/:slug/simulation/state`
- `PATCH /api/admin/worlds/:slug/simulation/speed`
- `POST /api/admin/worlds/:slug/simulation/run-one-cycle`
- `POST /api/admin/worlds/:slug/simulation/trigger`
- `GET /api/admin/worlds/:slug/simulation/telemetry`
- `GET /api/admin/worlds/:slug/simulation/logs`

Finalize names and response shapes in shared contracts before controllers are
implemented. Admin controllers mutate configuration or enqueue commands; they
must never call an LLM provider directly.

## Tests

- State transitions and invalid transitions are covered by state-machine tests.
- HALTED rejects manual work at the service boundary and HTTP boundary.
- Speed values are restricted to the supported presets.
- BullMQ jobs serialize and deserialize the same command shape.
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
under test. Persist state transitions before reporting success.

## Implementation Record

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
