import {
  listSimulationLogsQuerySchema,
  simulationLogResponseSchema,
} from '@aiworld/shared/schemas/simulation-log.schema';
import {
  runCustomActionSchema,
  simulationRunResultResponseSchema,
} from '@aiworld/shared/schemas/simulation-run.schema';
import {
  simulationConfigResponseSchema,
  updateSimulationSpeedSchema,
  updateSimulationStateSchema,
} from '@aiworld/shared/schemas/simulation-state.schema';
import { simulationTelemetryResponseSchema } from '@aiworld/shared/schemas/simulation-telemetry.schema';

const worldId = '00000000-0000-4000-8000-000000000001';

const validConfig = {
  id: '00000000-0000-4000-8000-000000000010',
  worldId,
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 1800000,
  jitterMs: 300000,
  actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
  providerId: 'mock',
  model: 'fixture-model',
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
};

describe('shared simulation admin contracts', () => {
  describe('simulationConfigResponseSchema', () => {
    it('accepts a fully-formed config response', () => {
      expect(
        simulationConfigResponseSchema.safeParse(validConfig).success,
      ).toBe(true);
    });

    it.each(['RUNNING', 'PAUSED', 'HALTED'] as const)(
      'accepts the %s lifecycle state',
      (state) => {
        expect(
          simulationConfigResponseSchema.safeParse({ ...validConfig, state })
            .success,
        ).toBe(true);
      },
    );

    it('rejects an unknown lifecycle state', () => {
      expect(
        simulationConfigResponseSchema.safeParse({
          ...validConfig,
          state: 'STOPPED',
        }).success,
      ).toBe(false);
    });

    it('rejects a speed multiplier outside the 0.1-100 boundary', () => {
      expect(
        simulationConfigResponseSchema.safeParse({
          ...validConfig,
          speedMultiplier: 101,
        }).success,
      ).toBe(false);
    });
  });

  describe('updateSimulationStateSchema', () => {
    it('accepts any lifecycle state', () => {
      expect(
        updateSimulationStateSchema.safeParse({ state: 'RUNNING' }).success,
      ).toBe(true);
      expect(
        updateSimulationStateSchema.safeParse({ state: 'HALTED' }).success,
      ).toBe(true);
    });

    it('rejects an unknown state', () => {
      expect(
        updateSimulationStateSchema.safeParse({ state: 'STOPPED' }).success,
      ).toBe(false);
    });
  });

  describe('updateSimulationSpeedSchema', () => {
    it('accepts the boundary values 0.1 and 100', () => {
      expect(
        updateSimulationSpeedSchema.safeParse({ speedMultiplier: 0.1 }).success,
      ).toBe(true);
      expect(
        updateSimulationSpeedSchema.safeParse({ speedMultiplier: 100 }).success,
      ).toBe(true);
    });

    it.each([0.09, 0, -2, 101])('rejects %s', (speedMultiplier) => {
      expect(
        updateSimulationSpeedSchema.safeParse({ speedMultiplier }).success,
      ).toBe(false);
    });

    it('rejects a non-numeric multiplier', () => {
      expect(
        updateSimulationSpeedSchema.safeParse({ speedMultiplier: 'fast' })
          .success,
      ).toBe(false);
    });
  });

  describe('listSimulationLogsQuerySchema', () => {
    it('accepts an empty query with defaulted pagination', () => {
      const result = listSimulationLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);

      const query = result.success ? result.data : undefined;
      expect(query?.page).toBe(1);
      expect(query?.limit).toBe(20);
      expect(query?.characterId).toBeUndefined();
    });

    it('accepts filters for character, action, status, and execution source', () => {
      const result = listSimulationLogsQuerySchema.safeParse({
        characterId: '00000000-0000-4000-8000-000000000002',
        action: 'POST',
        status: 'FAILED',
        executionSource: 'scheduled',
        page: 3,
        limit: 50,
      });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown action, status, or execution source', () => {
      expect(
        listSimulationLogsQuerySchema.safeParse({ action: 'DELETE' }).success,
      ).toBe(false);
      expect(
        listSimulationLogsQuerySchema.safeParse({ status: 'UNKNOWN' }).success,
      ).toBe(false);
      expect(
        listSimulationLogsQuerySchema.safeParse({ executionSource: 'batch' })
          .success,
      ).toBe(false);
    });

    it('rejects a malformed characterId filter', () => {
      expect(
        listSimulationLogsQuerySchema.safeParse({ characterId: 'not-a-uuid' })
          .success,
      ).toBe(false);
    });
  });

  describe('runCustomActionSchema', () => {
    const characterId = '00000000-0000-4000-8000-000000000002';

    it('accepts an empty body (Any Resident, Automatic)', () => {
      expect(runCustomActionSchema.safeParse({}).success).toBe(true);
    });

    it('accepts a specific character only', () => {
      expect(runCustomActionSchema.safeParse({ characterId }).success).toBe(
        true,
      );
    });

    it('accepts a forced action only', () => {
      expect(
        runCustomActionSchema.safeParse({ actionType: 'POST' }).success,
      ).toBe(true);
    });

    it('accepts both a character and a forced action', () => {
      expect(
        runCustomActionSchema.safeParse({ characterId, actionType: 'VOTE' })
          .success,
      ).toBe(true);
    });

    it('rejects an unknown action type', () => {
      expect(
        runCustomActionSchema.safeParse({ actionType: 'DELETE' }).success,
      ).toBe(false);
    });

    it('rejects a malformed characterId', () => {
      expect(
        runCustomActionSchema.safeParse({ characterId: 'abc' }).success,
      ).toBe(false);
    });
  });

  describe('simulationLogResponseSchema', () => {
    const characterId = '00000000-0000-4000-8000-000000000002';

    const validLog = {
      id: '00000000-0000-4000-8000-000000000003',
      worldId,
      characterId,
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
      executedAt: '2026-08-13T00:00:00.000Z',
    };

    it('accepts a fully-formed log response', () => {
      expect(simulationLogResponseSchema.safeParse(validLog).success).toBe(
        true,
      );
    });

    it('rejects an unknown status or execution source', () => {
      expect(
        simulationLogResponseSchema.safeParse({
          ...validLog,
          status: 'UNKNOWN',
        }).success,
      ).toBe(false);
      expect(
        simulationLogResponseSchema.safeParse({
          ...validLog,
          executionSource: 'batch',
        }).success,
      ).toBe(false);
    });

    it('exposes no provider secrets (promptUsed / responseRaw)', () => {
      expect('promptUsed' in simulationLogResponseSchema.shape).toBe(false);
      expect('responseRaw' in simulationLogResponseSchema.shape).toBe(false);
    });
  });

  describe('simulationRunResultResponseSchema', () => {
    const log = {
      id: '00000000-0000-4000-8000-000000000003',
      worldId,
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
      executedAt: '2026-08-13T00:00:00.000Z',
    };

    it('accepts a successful run result', () => {
      expect(
        simulationRunResultResponseSchema.safeParse({ status: 'success', log })
          .success,
      ).toBe(true);
    });

    it('accepts a failed run result with an action failure', () => {
      expect(
        simulationRunResultResponseSchema.safeParse({
          status: 'failed',
          failure: {
            code: 'WORLD_NOT_FOUND',
            message: 'World "missing" was not found',
            retryable: false,
          },
          log,
        }).success,
      ).toBe(true);
    });

    it('rejects an unknown result status', () => {
      expect(
        simulationRunResultResponseSchema.safeParse({ status: 'queued', log })
          .success,
      ).toBe(false);
    });
  });

  describe('simulationTelemetryResponseSchema', () => {
    it('accepts a fully-formed telemetry response', () => {
      expect(
        simulationTelemetryResponseSchema.safeParse({
          worldId,
          totalRuns: 120,
          successCount: 100,
          failedCount: 5,
          skippedCount: 10,
          rejectedCount: 5,
          totalTokensUsed: 48000,
          totalCostEstimateUsd: 0.012,
          averageLatencyMs: 320,
          lastRunAt: '2026-08-13T00:00:00.000Z',
        }).success,
      ).toBe(true);
    });

    it('accepts an empty telemetry response with null aggregates', () => {
      expect(
        simulationTelemetryResponseSchema.safeParse({
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
        }).success,
      ).toBe(true);
    });

    it('rejects negative counters', () => {
      expect(
        simulationTelemetryResponseSchema.safeParse({
          worldId,
          totalRuns: -1,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          rejectedCount: 0,
          totalTokensUsed: null,
          totalCostEstimateUsd: null,
          averageLatencyMs: null,
          lastRunAt: null,
        }).success,
      ).toBe(false);
    });
  });
});
