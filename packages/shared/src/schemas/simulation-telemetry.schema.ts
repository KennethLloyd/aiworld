import { z } from "zod";

// The admin telemetry contract: aggregate counters and averages derived from
// SimulationLog rows. It carries no provider identifiers, keys, prompts, or raw
// responses — only what an operator needs to watch pacing and spend.

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
});

export type SimulationTelemetryResponse = z.infer<
  typeof simulationTelemetryResponseSchema
>;
