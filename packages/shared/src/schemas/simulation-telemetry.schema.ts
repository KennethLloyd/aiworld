import { z } from 'zod';

// Admin telemetry excludes provider keys, prompts, and raw responses.

export const simulationTelemetryResponseSchema = z.object({
  worldId: z.uuid(),
  totalRuns: z.int().min(0),
  successCount: z.int().min(0),
  failedCount: z.int().min(0),
  skippedCount: z.int().min(0),
  rejectedCount: z.int().min(0),
  totalTokensUsed: z.int().min(0).nullable(),
  totalCostEstimateUsd: z.number().min(0).nullable(),
  averageLatencyMs: z.int().min(0).nullable(),
  lastRunAt: z.iso.datetime().nullable(),
  lastSuccessAt: z.iso.datetime().nullable().optional(),
  lastFailureAt: z.iso.datetime().nullable().optional(),
  lastProviderFailureAt: z.iso.datetime().nullable().optional(),
});

export type SimulationTelemetryResponse = z.infer<
  typeof simulationTelemetryResponseSchema
>;
