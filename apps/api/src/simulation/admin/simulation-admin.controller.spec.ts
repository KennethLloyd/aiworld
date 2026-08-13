import { ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { SimulationAdminResponseMapper } from '@/simulation/admin/simulation-admin-response.mapper';
import { SimulationAdminController } from '@/simulation/admin/simulation-admin.controller';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationConfigNotFoundError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationWorkRejectedError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';

const configRecord: WorldSimulationConfigRecord = {
  id: '00000000-0000-4000-8000-000000000010',
  worldId: '00000000-0000-4000-8000-000000000001',
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

const configResponse = {
  ...configRecord,
  createdAt: configRecord.createdAt.toISOString(),
  updatedAt: configRecord.updatedAt.toISOString(),
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

describe('SimulationAdminController', () => {
  let controller: SimulationAdminController;

  const mockAdminService: jest.Mocked<
    Pick<
      SimulationAdminService,
      | 'getConfig'
      | 'updateState'
      | 'updateSpeed'
      | 'runOneAction'
      | 'runCustomAction'
      | 'getTelemetry'
      | 'listLogs'
    >
  > = {
    getConfig: jest.fn(),
    updateState: jest.fn(),
    updateSpeed: jest.fn(),
    runOneAction: jest.fn(),
    runCustomAction: jest.fn(),
    getTelemetry: jest.fn(),
    listLogs: jest.fn(),
  };

  const mockResponseMapper: jest.Mocked<
    Pick<
      SimulationAdminResponseMapper,
      'mapConfig' | 'mapRunResult' | 'mapLogs' | 'mapTelemetry'
    >
  > = {
    mapConfig: jest.fn(),
    mapRunResult: jest.fn(),
    mapLogs: jest.fn(),
    mapTelemetry: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulationAdminController],
      providers: [
        { provide: SimulationAdminService, useValue: mockAdminService },
        {
          provide: SimulationAdminResponseMapper,
          useValue: mockResponseMapper,
        },
      ],
    }).compile();

    controller = module.get<SimulationAdminController>(
      SimulationAdminController,
    );

    mockResponseMapper.mapConfig.mockReturnValue(configResponse);
  });

  describe('getSimulation', () => {
    it('returns the mapped config', async () => {
      mockAdminService.getConfig.mockResolvedValue(configRecord);

      await expect(controller.getSimulation('mbti-house')).resolves.toEqual(
        configResponse,
      );
      expect(mockAdminService.getConfig).toHaveBeenCalledWith('mbti-house');
    });

    it('maps a missing config to 404', async () => {
      mockAdminService.getConfig.mockRejectedValue(
        new SimulationConfigNotFoundError(configRecord.worldId),
      );

      await expect(
        controller.getSimulation('mbti-house'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateState', () => {
    it('delegates the target state to the service', async () => {
      mockAdminService.updateState.mockResolvedValue(configRecord);

      await expect(
        controller.updateState('mbti-house', { state: 'PAUSED' }),
      ).resolves.toEqual(configResponse);
      expect(mockAdminService.updateState).toHaveBeenCalledWith(
        'mbti-house',
        'PAUSED',
      );
    });

    it('maps an invalid transition to 409', async () => {
      mockAdminService.updateState.mockRejectedValue(
        new Error('invalid transition'),
      );

      await expect(
        controller.updateState('mbti-house', { state: 'RUNNING' }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe('updateSpeed', () => {
    it('delegates the validated multiplier to the service', async () => {
      mockAdminService.updateSpeed.mockResolvedValue(configRecord);

      await expect(
        controller.updateSpeed('mbti-house', { speedMultiplier: 2 }),
      ).resolves.toEqual(configResponse);
      expect(mockAdminService.updateSpeed).toHaveBeenCalledWith(
        'mbti-house',
        2,
      );
    });
  });

  describe('runOneAction', () => {
    it('delegates to the service and maps the run result', async () => {
      const runResult = {
        status: 'success',
        decision: { action: 'POST' },
        log: logRecord,
      } as const;
      const mapped = { status: 'success', log: { status: 'SUCCESS' } } as const;
      mockAdminService.runOneAction.mockResolvedValue(runResult);
      mockResponseMapper.mapRunResult.mockReturnValue(mapped);

      await expect(controller.runOneAction('mbti-house')).resolves.toBe(mapped);
      expect(mockAdminService.runOneAction).toHaveBeenCalledWith('mbti-house');
    });

    it('maps a HALTED manual-work rejection to 409', async () => {
      mockAdminService.runOneAction.mockRejectedValue(
        new SimulationWorkRejectedError('MANUAL', 'HALTED'),
      );

      await expect(
        controller.runOneAction('mbti-house'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('runCustomAction', () => {
    it('passes the optional character and action through to the service', async () => {
      const runResult = {
        status: 'failed',
        failure: { code: 'X', message: 'y', retryable: false },
        log: logRecord,
      } as const;
      mockAdminService.runCustomAction.mockResolvedValue(runResult);
      mockResponseMapper.mapRunResult.mockReturnValue(runResult as never);

      await expect(
        controller.runCustomAction('mbti-house', {
          characterId: '00000000-0000-4000-8000-000000000002',
          actionType: 'POST',
        }),
      ).resolves.toEqual(runResult);
      expect(mockAdminService.runCustomAction).toHaveBeenCalledWith({
        slug: 'mbti-house',
        characterId: '00000000-0000-4000-8000-000000000002',
        actionType: 'POST',
      });
    });

    it('passes an empty body through as Any Resident / Automatic', async () => {
      mockAdminService.runCustomAction.mockResolvedValue({
        status: 'success',
        decision: { action: 'POST' },
        log: logRecord,
      } as never);

      await controller.runCustomAction('mbti-house', {});

      expect(mockAdminService.runCustomAction).toHaveBeenCalledWith({
        slug: 'mbti-house',
        characterId: undefined,
        actionType: undefined,
      });
    });
  });

  describe('getTelemetry', () => {
    it('delegates to the service and maps the telemetry', async () => {
      const telemetry = {
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
      mockAdminService.getTelemetry.mockResolvedValue(telemetry);
      mockResponseMapper.mapTelemetry.mockReturnValue({
        ...telemetry,
      } as never);

      await expect(controller.getTelemetry('mbti-house')).resolves.toEqual(
        telemetry,
      );
      expect(mockAdminService.getTelemetry).toHaveBeenCalledWith('mbti-house');
    });
  });

  describe('getLogs', () => {
    it('delegates filters and pagination to the service', async () => {
      const paginated = {
        items: [logRecord],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockAdminService.listLogs.mockResolvedValue(paginated);
      mockResponseMapper.mapLogs.mockReturnValue({ ...paginated } as never);

      await expect(
        controller.getLogs('mbti-house', {
          characterId: '00000000-0000-4000-8000-000000000002',
          action: 'POST',
          status: 'SUCCESS',
          executionSource: 'one-action',
          page: 1,
          limit: 20,
        }),
      ).resolves.toEqual(paginated);
      expect(mockAdminService.listLogs).toHaveBeenCalledWith({
        slug: 'mbti-house',
        filters: {
          characterId: '00000000-0000-4000-8000-000000000002',
          action: 'POST',
          status: 'SUCCESS',
          executionSource: 'one-action',
        },
        page: 1,
        limit: 20,
      });
    });
  });

  describe('roles metadata', () => {
    const reflector = new Reflector();

    it('requires ADMIN on every operation', () => {
      const operations = [
        controller.getSimulation,
        controller.updateState,
        controller.updateSpeed,
        controller.runOneAction,
        controller.runCustomAction,
        controller.getTelemetry,
        controller.getLogs,
      ];

      for (const operation of operations) {
        expect(reflector.get<string[]>('ROLES', operation)).toEqual(['ADMIN']);
      }
    });
  });
});
