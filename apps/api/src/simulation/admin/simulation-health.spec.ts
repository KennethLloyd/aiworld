import { deriveSimulationHealth } from '@/simulation/admin/simulation-health';
import type { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
import type { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import type { SimulationSchedulerObservabilityRecord } from '@/simulation/scheduler/simulation-scheduler.port';

const config: WorldSimulationConfigRecord = {
  id: 'config-1',
  worldId: 'world-1',
  state: 'RUNNING',
  speedMultiplier: 1,
  intervalMs: 1_800_000,
  jitterMs: 300_000,
  actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const telemetry: SimulationTelemetryRecord = {
  worldId: 'world-1',
  totalRuns: 1,
  successCount: 1,
  failedCount: 0,
  skippedCount: 0,
  rejectedCount: 0,
  totalTokensUsed: 10,
  totalCostEstimateUsd: 0.001,
  averageLatencyMs: 20,
  lastRunAt: new Date('2026-08-13T00:00:00.000Z'),
  lastSuccessAt: new Date('2026-08-13T00:00:00.000Z'),
  lastFailureAt: null,
};

const progressingScheduler: SimulationSchedulerObservabilityRecord = {
  available: true,
  pending: true,
  workExpected: true,
  nextTickAt: new Date('2026-08-13T01:00:00.000Z'),
  lastTickStartedAt: new Date('2026-08-13T00:20:00.000Z'),
  lastTickCompletedAt: new Date('2026-08-13T00:20:20.000Z'),
  retrying: false,
  recentRetryCount: 0,
  deadLetterCount: 0,
  lastDeadLetterAt: null,
  lastDeadLetterReason: null,
  bootResumeFailure: null,
};

function derive(
  overrides: Partial<WorldSimulationConfigRecord> = {},
  schedulerOverrides: Partial<SimulationSchedulerObservabilityRecord> = {},
  telemetryOverrides: Partial<SimulationTelemetryRecord> = {},
) {
  return deriveSimulationHealth(
    {
      config: { ...config, ...overrides },
      scheduler: { ...progressingScheduler, ...schedulerOverrides },
      telemetry: { ...telemetry, ...telemetryOverrides },
    },
    new Date('2026-08-13T00:30:00.000Z'),
  );
}

describe('deriveSimulationHealth', () => {
  it('reports a progressing RUNNING scheduler as healthy', () => {
    expect(derive()).toEqual({
      status: 'HEALTHY',
      reason: null,
      providerStatus: 'HEALTHY',
    });
  });

  it('does not infer health from a persisted RUNNING state', () => {
    expect(derive({}, { available: false })).toMatchObject({
      status: 'UNHEALTHY',
      reason: 'Scheduler worker is unavailable.',
    });
  });

  it('represents PAUSED and HALTED as intentional idle states', () => {
    expect(derive({ state: 'PAUSED' }).status).toBe('IDLE');
    expect(derive({ state: 'HALTED' }).status).toBe('IDLE');
  });

  it('surfaces boot resume failure and stalled progress', () => {
    expect(
      derive(
        {},
        {
          bootResumeFailure: {
            occurredAt: new Date('2026-08-13T00:00:00.000Z'),
            reason: 'Redis unavailable',
          },
        },
      ),
    ).toMatchObject({ status: 'UNHEALTHY' });
    expect(
      derive(
        {},
        {
          pending: false,
          lastTickStartedAt: new Date('2026-08-11T00:00:00.000Z'),
          lastTickCompletedAt: new Date('2026-08-12T00:00:00.000Z'),
        },
      ),
    ).toMatchObject({ status: 'DEGRADED' });
  });
  it('treats a World without expected work as unknown', () => {
    expect(
      derive(
        {},
        {
          pending: false,
          workExpected: false,
          lastTickCompletedAt: new Date('2026-08-12T00:00:00.000Z'),
        },
      ).status,
    ).toBe('UNKNOWN');
  });

  it('does not report an in-flight tick as stalled', () => {
    expect(
      derive(
        {},
        {
          pending: false,
          workExpected: true,
          lastTickStartedAt: new Date('2026-08-13T00:29:00.000Z'),
          lastTickCompletedAt: new Date('2026-08-13T00:20:00.000Z'),
        },
      ).status,
    ).toBe('HEALTHY');
  });

  it('marks retries and recent provider failures as degraded', () => {
    expect(derive({}, { retrying: true }).status).toBe('DEGRADED');
    expect(
      derive(
        {},
        {},
        {
          lastSuccessAt: new Date('2026-08-13T00:00:00.000Z'),
          lastFailureAt: new Date('2026-08-13T00:25:00.000Z'),
        },
      ),
    ).toEqual({
      status: 'DEGRADED',
      reason: 'Recent provider-backed executions have failed.',
      providerStatus: 'DEGRADED',
    });
  });

  it('returns to healthy after a later successful execution', () => {
    expect(
      derive(
        {},
        {},
        {
          lastSuccessAt: new Date('2026-08-13T00:29:00.000Z'),
          lastFailureAt: new Date('2026-08-13T00:25:00.000Z'),
        },
      ),
    ).toMatchObject({ status: 'HEALTHY', providerStatus: 'HEALTHY' });
  });
  it('does not treat non-provider failures as provider degradation', () => {
    expect(
      derive(
        {},
        {},
        {
          lastSuccessAt: new Date('2026-08-13T00:00:00.000Z'),
          lastFailureAt: new Date('2026-08-13T00:25:00.000Z'),
          lastProviderSuccessAt: new Date('2026-08-13T00:29:00.000Z'),
          lastProviderFailureAt: null,
        },
      ),
    ).toMatchObject({
      status: 'DEGRADED',
      reason: 'Recent simulation executions have failed.',
      providerStatus: 'HEALTHY',
    });
  });
  it('keeps dead-letter failures visible without expected work', () => {
    expect(
      derive(
        {},
        {
          workExpected: false,
          deadLetterCount: 1,
        },
      ),
    ).toMatchObject({ status: 'DEGRADED' });
  });
});
