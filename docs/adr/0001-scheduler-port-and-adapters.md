# Scheduler port with BullMQ and in-process adapters

Status: accepted

The product plan commits to BullMQ + Redis for simulation scheduling
(`docs/plans/README.md` and the consolidated architecture reference), but plans 01–04
shipped no queue infrastructure. We decided the MVP drives simulation ticks
through a `SimulationScheduler` port — `start`, `stop`, `runOneAction`,
`runCustomAction` — where every operation builds the same serializable Command
objects and lifecycle rules (manual work allowed in RUNNING/PAUSED, rejected in
HALTED) are enforced by the state machine reading `WorldSimulationConfig`,
never by the adapter. The **BullMQ adapter is the MVP runtime implementation**
(BullMQ is MIT-licensed and free; Redis runs as a local docker service like
Postgres), and an **in-process adapter is retained as the test/CI/offline
implementation**, mirroring the existing MockLLMProvider philosophy of a
local/test default and a production-capable adapter behind the same port.
Scheduler adapters never call an LLM provider directly.

Rationale for the port: scheduling is a genuine infrastructure seam with real
variability (runtime vs tests), and the port keeps the state machine
unit-testable without Redis while preserving the product plan's production
path (retries, dead-letter queues).

## Amendment (2026-08-13, triage of #43)

- The BullMQ adapter is the **default for dev, demo, and runtime**; Redis runs
  in `apps/api/docker-compose.yml` (and as a CI service container for e2e).
  `SCHEDULER_ADAPTER` env selects the adapter (default `bullmq`,
  `in-process` for tests/offline), mirroring the provider-config pattern.
- Port operations are `start`, `stop`, `runOneAction`, `runCustomAction` —
  "Run One Action" runs the scheduler's task manually (random pick/roll,
  awaits result); "Custom Action" composes the job (character × action,
  awaits result). "cycle" is removed from the vocabulary (legacy Plan 06
  triple).
- Seed pacing: `intervalMs: 1800000`, `jitterMs: 300000` (30 min ± 5 min,
  ~48 actions/day/world).
