import { Paginated } from '@aiworld/shared/schemas/pagination.schema';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';
import { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationConfigNotFoundError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { SimulationLogRepository } from '@/simulation/logging/simulation-log-repository.interface';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

const worldRecord: WorldRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: null,
  rules: [],
  topicScope: 'MBTI theory',
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const configRecord: WorldSimulationConfigRecord = {
  id: '00000000-0000-4000-8000-000000000010',
  worldId: worldRecord.id,
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 1800000,
  jitterMs: 300000,
  actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
  providerId: 'mock',
  model: 'fixture-model',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const logRecord: SimulationLogRecord = {
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

const telemetryRecord: SimulationTelemetryRecord = {
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

function createService() {
  const worldRepository = {
    findBySlug: jest.fn(),
  } as unknown as jest.Mocked<Pick<WorldRepository, 'findBySlug'>>;
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
  } as unknown as jest.Mocked<
    Pick<SimulationScheduler, 'runOneAction' | 'runCustomAction'>
  >;
  const logRepository = {
    findMany: jest.fn(),
    getTelemetry: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<SimulationLogRepository, 'findMany' | 'getTelemetry'>
  >;

  const service = new SimulationAdminService(
    worldRepository as unknown as WorldRepository,
    lifecycleService as unknown as SimulationLifecycleService,
    scheduler as unknown as SimulationScheduler,
    logRepository as unknown as SimulationLogRepository,
  );

  worldRepository.findBySlug.mockResolvedValue(worldRecord);
  lifecycleService.getByWorldId.mockResolvedValue(configRecord);

  return {
    service,
    worldRepository,
    lifecycleService,
    scheduler,
    logRepository,
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
      const { service, worldRepository } = createService();
      worldRepository.findBySlug.mockResolvedValue(null);

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
      const result = {
        status: 'success',
        decision: {},
        log: logRecord,
      } as const;
      scheduler.runOneAction.mockResolvedValue(result);

      await expect(service.runOneAction('mbti-house')).resolves.toBe(result);
      expect(scheduler.runOneAction).toHaveBeenCalledWith('mbti-house');
    });
  });

  describe('runCustomAction', () => {
    it('maps the slug onto the scheduler worldSlug input', async () => {
      const { service, scheduler } = createService();
      const result = {
        status: 'success',
        decision: {},
        log: logRecord,
      } as const;
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
      const { service, logRepository } = createService();
      const paginated: Paginated<SimulationLogRecord> = {
        items: [logRecord],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      logRepository.findMany.mockResolvedValue(paginated);

      const result = await service.listLogs({
        slug: 'mbti-house',
        filters: { action: 'POST', executionSource: 'one-action' },
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(paginated);
      expect(logRepository.findMany).toHaveBeenCalledWith({
        worldId: worldRecord.id,
        filters: { action: 'POST', executionSource: 'one-action' },
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getTelemetry', () => {
    it('returns the aggregated telemetry for the world', async () => {
      const { service, logRepository } = createService();
      logRepository.getTelemetry.mockResolvedValue(telemetryRecord);

      await expect(service.getTelemetry('mbti-house')).resolves.toEqual(
        telemetryRecord,
      );
      expect(logRepository.getTelemetry).toHaveBeenCalledWith(worldRecord.id);
    });

    it('returns an empty telemetry record when the world has no logs', async () => {
      const { service, logRepository } = createService();
      logRepository.getTelemetry.mockResolvedValue(null);

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
