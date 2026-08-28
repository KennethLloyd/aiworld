/** Aggregate simulation telemetry derived from SimulationLog rows. Provider
 * identifiers, prompts, and raw responses are deliberately absent: this is the
 * operator-facing view, never a leak of provider secrets. */
export interface SimulationTelemetryRecord {
  worldId: string;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  rejectedCount: number;
  totalTokensUsed: number | null;
  totalCostEstimateUsd: number | null;
  averageLatencyMs: number | null;
  lastRunAt: Date | null;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
  lastProviderSuccessAt?: Date | null;
  lastProviderFailureAt?: Date | null;
}

export function emptySimulationTelemetry(
  worldId: string,
): SimulationTelemetryRecord {
  return {
    worldId,
    totalRuns: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    rejectedCount: 0,
    totalTokensUsed: null,
    totalCostEstimateUsd: null,
    averageLatencyMs: null,
    lastRunAt: null,
  };
}
