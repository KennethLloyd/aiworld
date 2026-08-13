-- Rename SimulationExecutionSource values to the scheduler vocabulary.
-- "cycle" is removed from the vocabulary: the fixed POST → VOTE → COMMENT
-- triple is test-only; scheduled, one-action, and custom work share the
-- command pipeline.
ALTER TYPE "SimulationExecutionSource" RENAME VALUE 'MANUAL' TO 'ONE_ACTION';
ALTER TYPE "SimulationExecutionSource" RENAME VALUE 'RUN_ONE_CYCLE' TO 'CUSTOM';

-- REJECTED records a lifecycle-gated tick that was refused (e.g. a scheduled
-- tick landing after the world left RUNNING). Rejection is not a failure and
-- is never retried.
ALTER TYPE "SimulationLogStatus" ADD VALUE 'REJECTED';

-- BullMQ job id so retried/stalled attempts of the same tick are visibly the
-- same job (at-least-once awareness). Null for in-process runs.
ALTER TABLE "simulation_log" ADD COLUMN "jobId" TEXT;
