-- LLM provider and model are process-level configuration, not World behavior.
-- Existing values are intentionally discarded after the runtime cutover.
ALTER TABLE "world_simulation_config"
  DROP COLUMN "providerId",
  DROP COLUMN "model";
