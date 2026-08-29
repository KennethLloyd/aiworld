import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SimulationHealthResponse } from '@aiworld/shared/schemas/simulation-health.schema';
import {
  ListSimulationLogsResponse,
  SimulationLogResponse,
} from '@aiworld/shared/schemas/simulation-log.schema';
import { SimulationRunResultResponse } from '@aiworld/shared/schemas/simulation-run.schema';
import { SimulationConfigResponse } from '@aiworld/shared/schemas/simulation-state.schema';
import { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import { Injectable } from '@nestjs/common';

import { SimulationHealthRecord } from '@/simulation/admin/simulation-health';
import { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { IterationRunResult } from '@/simulation/scheduler/simulation-tick-runner';

/** Maps domain records onto the shared transport shapes. The run result keeps
 * only the status and the logged outcome — never the raw decision object or
 * provider payload — and log rows never expose promptUsed/responseRaw. */
@Injectable()
export class SimulationAdminResponseMapper {
  mapConfig(config: WorldSimulationConfigRecord): SimulationConfigResponse {
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
  mapHealth(health: SimulationHealthRecord): SimulationHealthResponse {
    return {
      lifecycle: { state: health.lifecycleState },
      health: health.health,
      scheduler: {
        available: health.scheduler.available,
        pending: health.scheduler.pending,
        workExpected: health.scheduler.workExpected,
        nextTickAt: health.scheduler.nextTickAt?.toISOString() ?? null,
        lastTickStartedAt:
          health.scheduler.lastTickStartedAt?.toISOString() ?? null,
        lastTickCompletedAt:
          health.scheduler.lastTickCompletedAt?.toISOString() ?? null,
        retrying: health.scheduler.retrying,
        recentRetryCount: health.scheduler.recentRetryCount,
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
      telemetry: this.mapTelemetry(health.telemetry),
    };
  }

  mapRunResult(result: IterationRunResult): SimulationRunResultResponse {
    if (result.status === 'success') {
      return { status: 'success', log: this.mapLog(result.log) };
    }
    return {
      status: 'failed',
      failure: {
        code: result.failure.code,
        message: result.failure.message,
        retryable: result.failure.retryable,
      },
      log: this.mapLog(result.log),
    };
  }

  mapLog(log: SimulationLogRecord): SimulationLogResponse {
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

  mapLogs(
    paginated: Paginated<SimulationLogRecord>,
  ): ListSimulationLogsResponse {
    return {
      items: paginated.items.map((item) => this.mapLog(item)),
      meta: paginated.meta,
    };
  }

  mapTelemetry(
    telemetry: SimulationTelemetryRecord,
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
}
