-- Backfill provider failures recorded before the provenance column existed.
UPDATE "simulation_log"
SET "providerFailure" = true
WHERE "status" = 'FAILED'
  AND "errorMessage" ~ '^(AUTHENTICATION|TIMEOUT|RATE_LIMIT|MALFORMED_RESPONSE|CAPABILITY|NETWORK|UNKNOWN):';
