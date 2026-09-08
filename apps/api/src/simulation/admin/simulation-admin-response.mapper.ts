import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SimulationHealthResponse } from '@aiworld/shared/schemas/simulation-health.schema';
import {
  ListSimulationLogsResponse,
  SimulationLogResponse,
} from '@aiworld/shared/schemas/simulation-log.schema';
import { SimulationRunResultResponse } from '@aiworld/shared/schemas/simulation-run.schema';
import { SimulationConfigResponse } from '@aiworld/shared/schemas/simulation-state.schema';
import { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';

import { SimulationHealth } from '@/simulation/admin/simulation-health';
import { SimulationTelemetry } from '@/simulation/domain/simulation-telemetry';
import { SimulationConfig } from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationLogEntry } from '@/simulation/logging/simulation-log.service';
import { IterationRunResult } from '@/simulation/scheduler/simulation-runner';

export function mapSimulationConfig(
  config: SimulationConfig,
): SimulationConfigResponse {
  return {
    id: config.id,
    worldId: config.worldId,
    state: config.state,
    speedMultiplier: config.speedMultiplier,
    intervalMs: config.intervalMs,
    jitterMs: config.jitterMs,
    actionWeights: config.actionWeights,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export function mapSimulationHealth(
  health: SimulationHealth,
): SimulationHealthResponse {
  return {
    lifecycle: { state: health.lifecycleState },
    health: health.health,
    scheduler: {
      available: health.scheduler.available,
      pending: health.scheduler.pending,
      workExpected: health.scheduler.workExpected,
      nextTurnAt: health.scheduler.nextTurnAt?.toISOString() ?? null,
      lastTurnStartedAt:
        health.scheduler.lastTurnStartedAt?.toISOString() ?? null,
      lastTurnCompletedAt:
        health.scheduler.lastTurnCompletedAt?.toISOString() ?? null,
      retrying: health.scheduler.retrying,
      recentRetryCount: health.scheduler.recentRetryCount,
      blockedReason: health.scheduler.blockedReason,
      deadLetterCount: health.scheduler.deadLetterCount,
      lastDeadLetterAt:
        health.scheduler.lastDeadLetterAt?.toISOString() ?? null,
      lastDeadLetterReason: health.scheduler.lastDeadLetterReason,
      bootResumeFailure: health.scheduler.bootResumeFailure
        ? {
            occurredAt:
              health.scheduler.bootResumeFailure.occurredAt.toISOString(),
            reason: health.scheduler.bootResumeFailure.reason,
          }
        : null,
    },
    execution: {
      lastSuccessAt: health.execution.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: health.execution.lastFailureAt?.toISOString() ?? null,
    },
    provider: {
      status: health.provider.status,
      lastSuccessAt: health.provider.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: health.provider.lastFailureAt?.toISOString() ?? null,
    },
    telemetry: mapSimulationTelemetry(health.telemetry),
  };
}

export function mapSimulationRunResult(
  result: IterationRunResult,
): SimulationRunResultResponse {
  if (result.status === 'success') {
    return { status: 'success', log: mapSimulationLog(result.log) };
  }
  return {
    status: 'failed',
    failure: {
      code: result.failure.code,
      message: result.failure.message,
      retryable: result.failure.retryable,
    },
    log: mapSimulationLog(result.log),
  };
}

export function mapSimulationLog(
  log: SimulationLogEntry,
): SimulationLogResponse {
  return {
    id: log.id,
    worldId: log.worldId,
    characterId: log.characterId,
    action: log.action,
    targetId: log.targetId,
    reasoning: log.reasoning,
    provider: log.provider,
    model: log.model,
    latencyMs: log.latencyMs,
    jobId: log.jobId,
    executionSource: log.executionSource,
    tokensUsed: log.tokensUsed,
    costEstimate: log.costEstimate,
    status: log.status,
    errorMessage: log.errorMessage,
    executedAt: log.executedAt.toISOString(),
  };
}

export function mapSimulationLogs(
  paginated: Paginated<SimulationLogEntry>,
): ListSimulationLogsResponse {
  return {
    items: paginated.items.map(mapSimulationLog),
    meta: paginated.meta,
  };
}

export function mapSimulationTelemetry(
  telemetry: SimulationTelemetry,
): SimulationTelemetryResponse {
  return {
    worldId: telemetry.worldId,
    totalRuns: telemetry.totalRuns,
    successCount: telemetry.successCount,
    failedCount: telemetry.failedCount,
    skippedCount: telemetry.skippedCount,
    rejectedCount: telemetry.rejectedCount,
    totalTokensUsed: telemetry.totalTokensUsed,
    totalCostEstimateUsd: telemetry.totalCostEstimateUsd,
    averageLatencyMs: telemetry.averageLatencyMs,
    lastRunAt: telemetry.lastRunAt ? telemetry.lastRunAt.toISOString() : null,
    lastSuccessAt: telemetry.lastSuccessAt?.toISOString() ?? null,
    lastProviderSuccessAt:
      telemetry.lastProviderSuccessAt?.toISOString() ?? null,
    lastFailureAt: telemetry.lastFailureAt?.toISOString() ?? null,
    lastProviderFailureAt:
      telemetry.lastProviderFailureAt?.toISOString() ?? null,
  };
}
