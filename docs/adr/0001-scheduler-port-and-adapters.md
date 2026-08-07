# Scheduler port with BullMQ and in-process adapters

Status: accepted

The product plan commits to BullMQ + Redis for simulation scheduling
(`docs/product/aiworld-architecture-plan.md:37,95,517`), but plans 01–04
shipped no queue infrastructure. We decided the MVP drives simulation ticks
through a `SimulationScheduler` port — `start`, `stop`, `runOneCycle`,
`triggerJob` — where every operation builds the same serializable Command
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
