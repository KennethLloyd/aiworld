-- Keep database defaults aligned with the canonical application defaults.
ALTER TABLE "world_simulation_config"
  ALTER COLUMN "intervalMs" SET DEFAULT 1800000,
  ALTER COLUMN "jitterMs" SET DEFAULT 300000,
  ALTER COLUMN "actionWeights" SET DEFAULT
    '{"POST": 0.2, "VOTE": 0.5, "COMMENT": 0.3}'::jsonb,
  ALTER COLUMN "providerId" SET DEFAULT 'mock',
  ALTER COLUMN "model" SET DEFAULT 'mock';

-- Existing Worlds must be immediately compatible with simulation APIs. The
-- deterministic id makes this safe to rerun while preserving valid configs.
INSERT INTO "world_simulation_config" (
  "id",
  "worldId",
  "createdAt",
  "updatedAt"
)
SELECT
  format(
    '%s-%s-5%s-8%s-%s',
    substr(config_hash.hash, 1, 8),
    substr(config_hash.hash, 9, 4),
    substr(config_hash.hash, 14, 3),
    substr(config_hash.hash, 18, 3),
    substr(config_hash.hash, 21, 12)
  ),
  w."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "world" AS w
CROSS JOIN LATERAL (
  SELECT md5('world-simulation-config:' || w."id") AS hash
) AS config_hash
WHERE NOT EXISTS (
  SELECT 1
  FROM "world_simulation_config" AS c
  WHERE c."worldId" = w."id"
);
