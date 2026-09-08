-- Rename runtime-state columns without dropping their persisted values.
ALTER TABLE "simulation_runtime_state"
  RENAME COLUMN "nextTickAt" TO "nextTurnAt";

ALTER TABLE "simulation_runtime_state"
  RENAME COLUMN "lastTickStartedAt" TO "lastTurnStartedAt";

ALTER TABLE "simulation_runtime_state"
  RENAME COLUMN "lastTickCompletedAt" TO "lastTurnCompletedAt";
