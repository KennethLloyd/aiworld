import { Paginated } from '@aiworld/shared/schemas/pagination.schema';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { PostDecision } from '@/simulation/actions/simulation-decision';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';
import { SimulationTelemetry } from '@/simulation/domain/simulation-telemetry';
import { SimulationConfig } from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationConfigNotFoundError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import {
  SimulationLogEntry,
  SimulationLogService,
} from '@/simulation/logging/simulation-log.service';
import { IterationRunResult } from '@/simulation/scheduler/simulation-runner';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler';
import { WorldService, WorldView } from '@/world/world.service';

const worldRecord: WorldView = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: null,
  rules: [],
  topicScope: 'MBTI theory',
  residentCount: 16,
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const configRecord: SimulationConfig = {
  id: '00000000-0000-4000-8000-000000000010',
  worldId: worldRecord.id,
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 1800000,
  jitterMs: 300000,
  actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const logRecord: SimulationLogEntry = {
  id: '00000000-0000-4000-8000-000000000003',
  worldId: worldRecord.id,
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

const telemetryRecord: SimulationTelemetry = {
  worldId: worldRecord.id,
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

const postDecision: PostDecision = {
  action: 'POST',
  worldId: worldRecord.id,
  memberId: '00000000-0000-4000-8000-000000000004',
  characterId: logRecord.characterId,
  title: 'A title',
  content: 'Body.',
  reasoning: 'Thought it through.',
};

function createService() {
  const worldService = {
    getBySlug: jest.fn(),
  } as unknown as jest.Mocked<Pick<WorldService, 'getBySlug'>>;
  const lifecycleService = {
    getByWorldId: jest.fn(),
    transitionTo: jest.fn(),
    updateSpeed: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<
      SimulationLifecycleService,
      'getByWorldId' | 'transitionTo' | 'updateSpeed'
    >
  >;
  const scheduler = {
    runOneAction: jest.fn(),
    runCustomAction: jest.fn(),
    getObservability: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<
      SimulationScheduler,
      'runOneAction' | 'runCustomAction' | 'getObservability'
    >
  >;
  const logService = {
    list: jest.fn(),
    getTelemetry: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<SimulationLogService, 'list' | 'getTelemetry'>
  >;

  const service = new SimulationAdminService(
    worldService as unknown as WorldService,
    lifecycleService as unknown as SimulationLifecycleService,
    scheduler as unknown as SimulationScheduler,
    logService as unknown as SimulationLogService,
  );

  worldService.getBySlug.mockResolvedValue(worldRecord);
  lifecycleService.getByWorldId.mockResolvedValue(configRecord);

  return {
    service,
    worldService,
    lifecycleService,
    scheduler,
    logService,
  };
}

describe('SimulationAdminService', () => {
  describe('getConfig', () => {
    it('returns the persisted config for the world', async () => {
      const { service, lifecycleService } = createService();

      await expect(service.getConfig('mbti-house')).resolves.toEqual(
        configRecord,
      );
      expect(lifecycleService.getByWorldId).toHaveBeenCalledWith(
        worldRecord.id,
      );
    });

    it('throws when no config is persisted', async () => {
      const { service, lifecycleService } = createService();
      lifecycleService.getByWorldId.mockResolvedValue(null);

      await expect(service.getConfig('mbti-house')).rejects.toBeInstanceOf(
        SimulationConfigNotFoundError,
      );
    });

    it('throws WORLD_NOT_FOUND when the world does not exist', async () => {
      const { service, worldService } = createService();
      worldService.getBySlug.mockResolvedValue(null);

      await expect(service.getConfig('missing')).rejects.toMatchObject({
        code: 'WORLD_NOT_FOUND',
      } as SimulationActionError);
    });
  });

  describe('updateState', () => {
    it('delegates the transition to the lifecycle service by world id', async () => {
      const { service, lifecycleService } = createService();
      lifecycleService.transitionTo.mockResolvedValue({
        ...configRecord,
        state: 'RUNNING',
      });

      const result = await service.updateState('mbti-house', 'RUNNING');

      expect(result.state).toBe('RUNNING');
      expect(lifecycleService.transitionTo).toHaveBeenCalledWith(
        worldRecord.id,
        'RUNNING',
      );
    });
  });

  describe('updateSpeed', () => {
    it('delegates the speed change to the lifecycle service by world id', async () => {
      const { service, lifecycleService } = createService();
      lifecycleService.updateSpeed.mockResolvedValue({
        ...configRecord,
        speedMultiplier: 2,
      });

      const result = await service.updateSpeed('mbti-house', 2);

      expect(result.speedMultiplier).toBe(2);
      expect(lifecycleService.updateSpeed).toHaveBeenCalledWith(
        worldRecord.id,
        2,
      );
    });
  });

  describe('runOneAction', () => {
    it('delegates to the scheduler with the world slug', async () => {
      const { service, scheduler } = createService();
      const result: IterationRunResult = {
        status: 'success',
        decision: postDecision,
        log: logRecord,
      };
      scheduler.runOneAction.mockResolvedValue(result);

      await expect(service.runOneAction('mbti-house')).resolves.toBe(result);
      expect(scheduler.runOneAction).toHaveBeenCalledWith('mbti-house');
    });
  });

  describe('runCustomAction', () => {
    it('maps the slug onto the scheduler worldSlug input', async () => {
      const { service, scheduler } = createService();
      const result: IterationRunResult = {
        status: 'success',
        decision: postDecision,
        log: logRecord,
      };
      scheduler.runCustomAction.mockResolvedValue(result);

      await expect(
        service.runCustomAction({
          slug: 'mbti-house',
          characterId: 'character-1',
          actionType: 'POST',
        }),
      ).resolves.toBe(result);
      expect(scheduler.runCustomAction).toHaveBeenCalledWith({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
      });
    });
  });

  describe('listLogs', () => {
    it('resolves the world and queries logs by world id with filters', async () => {
      const { service, logService } = createService();
      const paginated: Paginated<SimulationLogEntry> = {
        items: [logRecord],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      logService.list.mockResolvedValue(paginated);

      const result = await service.listLogs({
        slug: 'mbti-house',
        filters: { action: 'POST', executionSource: 'one-action' },
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(paginated);
      expect(logService.list).toHaveBeenCalledWith({
        worldId: worldRecord.id,
        filters: { action: 'POST', executionSource: 'one-action' },
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getHealth', () => {
    it('combines lifecycle, scheduler, and telemetry runtime signals', async () => {
      const { service, lifecycleService, scheduler, logService } =
        createService();
      lifecycleService.getByWorldId.mockResolvedValue({
        ...configRecord,
        state: 'RUNNING',
      });
      scheduler.getObservability.mockResolvedValue({
        available: true,
        pending: true,
        workExpected: true,
        nextTurnAt: new Date(Date.now() + 60_000),
        lastTurnStartedAt: new Date(),
        lastTurnCompletedAt: new Date(),
        retrying: false,
        recentRetryCount: 0,
        blockedReason: null,
        deadLetterCount: 0,
        lastDeadLetterAt: null,
        lastDeadLetterReason: null,
        bootResumeFailure: null,
      });
      logService.getTelemetry.mockResolvedValue({
        ...telemetryRecord,
        lastSuccessAt: new Date('2026-08-13T00:20:07.000Z'),
        lastFailureAt: null,
      });

      const result = await service.getHealth('mbti-house');

      expect(result.lifecycleState).toBe('RUNNING');
      expect(result.health.status).toBe('HEALTHY');
      expect(result.scheduler.pending).toBe(true);
      expect(result.execution.lastSuccessAt).toEqual(
        new Date('2026-08-13T00:20:07.000Z'),
      );
      expect(result.telemetry.successCount).toBe(4);
      expect(scheduler.getObservability).toHaveBeenCalledWith(worldRecord.id);
    });
  });

  describe('getTelemetry', () => {
    it('returns the aggregated telemetry for the world', async () => {
      const { service, logService } = createService();
      logService.getTelemetry.mockResolvedValue(telemetryRecord);

      await expect(service.getTelemetry('mbti-house')).resolves.toEqual(
        telemetryRecord,
      );
      expect(logService.getTelemetry).toHaveBeenCalledWith(worldRecord.id);
    });

    it('returns an empty telemetry record when the world has no logs', async () => {
      const { service, logService } = createService();
      logService.getTelemetry.mockResolvedValue(null);

      await expect(service.getTelemetry('mbti-house')).resolves.toEqual({
        worldId: worldRecord.id,
        totalRuns: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        rejectedCount: 0,
        totalTokensUsed: null,
        totalCostEstimateUsd: null,
        averageLatencyMs: null,
        lastRunAt: null,
      });
    });
  });
});
