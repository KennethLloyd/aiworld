import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { simulationHealthResponseSchema } from '@aiworld/shared/schemas/simulation-health.schema';
import {
  listSimulationLogsResponseSchema,
  simulationLogResponseSchema,
} from '@aiworld/shared/schemas/simulation-log.schema';
import { simulationRunResultResponseSchema } from '@aiworld/shared/schemas/simulation-run.schema';
import { simulationConfigResponseSchema } from '@aiworld/shared/schemas/simulation-state.schema';
import { simulationTelemetryResponseSchema } from '@aiworld/shared/schemas/simulation-telemetry.schema';

import { SimulationAdminResponseMapper } from '@/simulation/admin/simulation-admin-response.mapper';
import { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { IterationRunResult } from '@/simulation/scheduler/simulation-tick-runner';

const configRecord: WorldSimulationConfigRecord = {
  id: '00000000-0000-4000-8000-000000000010',
  worldId: '00000000-0000-4000-8000-000000000001',
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 1800000,
  jitterMs: 300000,
  actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const logRecord: SimulationLogRecord = {
  id: '00000000-0000-4000-8000-000000000003',
  worldId: configRecord.worldId,
  characterId: '00000000-0000-4000-8000-000000000002',
  action: 'POST',
  targetId: null,
  reasoning: 'Thought it through.',
  provider: 'mock',
  model: 'fixture-model',
  latencyMs: 7,
  jobId: null,
  executionSource: 'one-action',
  tokensUsed: 15,
  costEstimate: 0.00001,
  status: 'SUCCESS',
  errorMessage: null,
  executedAt: new Date('2026-08-13T00:00:00.000Z'),
};

const telemetryRecord: SimulationTelemetryRecord = {
  worldId: configRecord.worldId,
  totalRuns: 5,
  successCount: 4,
  failedCount: 1,
  skippedCount: 0,
  rejectedCount: 0,
  totalTokensUsed: 100,
  totalCostEstimateUsd: 0.001,
  averageLatencyMs: 25,
  lastRunAt: new Date('2026-08-13T00:00:00.000Z'),
};

const mapper = new SimulationAdminResponseMapper();

describe('SimulationAdminResponseMapper', () => {
  it('maps a config record to the shared config response', () => {
    const response = mapper.mapConfig(configRecord);

    expect(simulationConfigResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(response.state).toBe('PAUSED');
    expect(response.createdAt).toBe('2026-08-01T00:00:00.000Z');
    expect(response).not.toHaveProperty('providerId');
    expect(response).not.toHaveProperty('model');
  });

  it('maps a successful run result without the raw decision', () => {
    const result: IterationRunResult = {
      status: 'success',
      decision: {
        action: 'POST',
        worldId: configRecord.worldId,
        memberId: 'member-1',
        characterId: logRecord.characterId,
        title: 'A title',
        content: 'Body.',
        reasoning: 'Thought it through.',
      },
      log: logRecord,
    };

    const response = mapper.mapRunResult(result);

    expect(simulationRunResultResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(response).toMatchObject({
      status: 'success',
      log: { status: 'SUCCESS' },
    });
    expect(response).not.toHaveProperty('decision');
  });

  it('maps a failed run result with the action failure', () => {
    const result: IterationRunResult = {
      status: 'failed',
      failure: {
        code: 'CHARACTER_INACTIVE',
        message: 'The character is inactive.',
        retryable: false,
      },
      log: {
        ...logRecord,
        status: 'FAILED',
        errorMessage: 'CHARACTER_INACTIVE',
      },
    };

    const response = mapper.mapRunResult(result);

    expect(simulationRunResultResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(response).toMatchObject({
      status: 'failed',
      failure: { code: 'CHARACTER_INACTIVE', retryable: false },
    });
  });

  it('maps a log record to the shared log response without provider secrets', () => {
    const response = mapper.mapLog(logRecord);

    expect(simulationLogResponseSchema.safeParse(response).success).toBe(true);
    expect(response.executionSource).toBe('one-action');
    expect('promptUsed' in response).toBe(false);
    expect('responseRaw' in response).toBe(false);
  });

  it('maps a paginated log page to the shared list response', () => {
    const paginated: Paginated<SimulationLogRecord> = {
      items: [logRecord],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    const response = mapper.mapLogs(paginated);

    expect(listSimulationLogsResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(response.items).toHaveLength(1);
  });

  it('maps a telemetry record to the shared telemetry response', () => {
    const response = mapper.mapTelemetry(telemetryRecord);

    expect(simulationTelemetryResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(response.averageLatencyMs).toBe(25);
    expect(response.lastRunAt).toBe('2026-08-13T00:00:00.000Z');
  });

  it('maps runtime health without exposing scheduler or provider secrets', () => {
    const response = mapper.mapHealth({
      lifecycleState: 'RUNNING',
      health: {
        status: 'DEGRADED',
        reason: 'Recent provider-backed executions have failed.',
      },
      scheduler: {
        available: true,
        pending: true,
        nextTickAt: new Date('2026-08-13T01:00:00.000Z'),
        lastTickStartedAt: new Date('2026-08-13T00:20:00.000Z'),
        lastTickCompletedAt: new Date('2026-08-13T00:20:07.000Z'),
        retrying: true,
        recentRetryCount: 2,
        deadLetterCount: 1,
        lastDeadLetterAt: new Date('2026-08-13T00:21:00.000Z'),
        lastDeadLetterReason: 'TIMEOUT',
        bootResumeFailure: null,
      },
      execution: {
        lastSuccessAt: new Date('2026-08-13T00:20:07.000Z'),
        lastFailureAt: new Date('2026-08-13T00:21:00.000Z'),
      },
      provider: {
        status: 'DEGRADED',
        lastSuccessAt: new Date('2026-08-13T00:20:07.000Z'),
        lastFailureAt: new Date('2026-08-13T00:21:00.000Z'),
      },
      telemetry: telemetryRecord,
    });

    expect(simulationHealthResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(response.scheduler.recentRetryCount).toBe(2);
    expect(response.provider).not.toHaveProperty('apiKey');
    expect(response.telemetry.successCount).toBe(4);
  });

  it('maps a telemetry record with null aggregates', () => {
    const response = mapper.mapTelemetry({
      ...telemetryRecord,
      totalTokensUsed: null,
      totalCostEstimateUsd: null,
      averageLatencyMs: null,
      lastRunAt: null,
    });

    expect(simulationTelemetryResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(response.lastRunAt).toBeNull();
  });
});
