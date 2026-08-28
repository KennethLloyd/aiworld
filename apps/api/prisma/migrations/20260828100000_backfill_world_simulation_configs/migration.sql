-- Keep database defaults aligned with the canonical application defaults.
ALTER TABLE "world_simulation_config"
  ALTER COLUMN "intervalMs" SET DEFAULT 1800000,
  ALTER COLUMN "jitterMs" SET DEFAULT 300000;

-- Existing Worlds must be immediately compatible with simulation APIs. The
-- deterministic id makes this safe to rerun while preserving valid configs.
INSERT INTO "world_simulation_config" (
  "id",
  "worldId",
  "state",
  "speedMultiplier",
  "intervalMs",
  "jitterMs",
  "actionWeights",
  "providerId",
  "model",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('world-simulation-config:' || w."id"),
  w."id",
  'PAUSED',
  1,
  1800000,
  300000,
  '{"POST": 0.2, "VOTE": 0.5, "COMMENT": 0.3}'::jsonb,
  'mock',
  'fixture-model',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "world" AS w
WHERE NOT EXISTS (
  SELECT 1
  FROM "world_simulation_config" AS c
  WHERE c."worldId" = w."id"
);
