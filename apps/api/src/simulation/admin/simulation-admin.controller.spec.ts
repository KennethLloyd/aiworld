import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SimulationHealthResponse } from '@aiworld/shared/schemas/simulation-health.schema';
import {
  ListSimulationLogsResponse,
  SimulationLogResponse,
} from '@aiworld/shared/schemas/simulation-log.schema';
import { SimulationRunResultResponse } from '@aiworld/shared/schemas/simulation-run.schema';
import { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { PostDecision } from '@/simulation/actions/simulation-decision';
import { SimulationAdminResponseMapper } from '@/simulation/admin/simulation-admin-response.mapper';
import { SimulationAdminController } from '@/simulation/admin/simulation-admin.controller';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';
import { SimulationHealthRecord } from '@/simulation/admin/simulation-health';
import { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationConfigNotFoundError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationWorkRejectedError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { InvalidSimulationStateTransitionError } from '@/simulation/lifecycle/simulation-lifecycle.error';
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

const logResponse: SimulationLogResponse = {
  ...logRecord,
  executedAt: logRecord.executedAt.toISOString(),
};

const postDecision: PostDecision = {
  action: 'POST',
  worldId: configRecord.worldId,
  memberId: '00000000-0000-4000-8000-000000000004',
  characterId: logRecord.characterId,
  title: 'A title',
  content: 'Body.',
  reasoning: 'Thought it through.',
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

const healthRecord: SimulationHealthRecord = {
  lifecycleState: configRecord.state,
  health: { status: 'IDLE', reason: 'Simulation is intentionally PAUSED.' },
  scheduler: {
    available: true,
    pending: false,
    nextTickAt: null,
    lastTickStartedAt: null,
    lastTickCompletedAt: null,
    retrying: false,
    recentRetryCount: 0,
    deadLetterCount: 0,
    lastDeadLetterAt: null,
    lastDeadLetterReason: null,
    bootResumeFailure: null,
  },
  execution: { lastSuccessAt: null, lastFailureAt: null },
  provider: { status: 'UNKNOWN', lastSuccessAt: null, lastFailureAt: null },
  telemetry: telemetryRecord,
};
const healthResponse: SimulationHealthResponse = {
  lifecycle: { state: 'PAUSED' },
  health: healthRecord.health,
  scheduler: {
    available: true,
    pending: false,
    nextTickAt: null,
    lastTickStartedAt: null,
    lastTickCompletedAt: null,
    retrying: false,
    recentRetryCount: 0,
    deadLetterCount: 0,
    lastDeadLetterAt: null,
    lastDeadLetterReason: null,
    bootResumeFailure: null,
  },
  execution: { lastSuccessAt: null, lastFailureAt: null },
  provider: {
    status: 'UNKNOWN',
    lastSuccessAt: null,
    lastFailureAt: null,
  },
  telemetry: {
    ...telemetryRecord,
    lastRunAt: telemetryRecord.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastProviderFailureAt: null,
  },
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
      | 'getHealth'
      | 'listLogs'
    >
  > = {
    getConfig: jest.fn(),
    updateState: jest.fn(),
    getHealth: jest.fn(),
    updateSpeed: jest.fn(),
    runOneAction: jest.fn(),
    runCustomAction: jest.fn(),
    getTelemetry: jest.fn(),
    listLogs: jest.fn(),
  };

  const mockResponseMapper: jest.Mocked<
    Pick<
      SimulationAdminResponseMapper,
      'mapConfig' | 'mapRunResult' | 'mapLogs' | 'mapTelemetry' | 'mapHealth'
    >
  > = {
    mapConfig: jest.fn(),
    mapRunResult: jest.fn(),
    mapLogs: jest.fn(),
    mapTelemetry: jest.fn(),
    mapHealth: jest.fn(),
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
        new InvalidSimulationStateTransitionError('HALTED', 'RUNNING'),
      );

      await expect(
        controller.updateState('mbti-house', { state: 'RUNNING' }),
      ).rejects.toBeInstanceOf(ConflictException);
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
      const runResult: IterationRunResult = {
        status: 'success',
        decision: postDecision,
        log: logRecord,
      };
      const mapped: SimulationRunResultResponse = {
        status: 'success',
        log: logResponse,
      };
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
      const runResult: IterationRunResult = {
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
      const mapped: SimulationRunResultResponse = {
        status: 'failed',
        failure: runResult.failure,
        log: { ...logResponse, status: 'FAILED' },
      };
      mockAdminService.runCustomAction.mockResolvedValue(runResult);
      mockResponseMapper.mapRunResult.mockReturnValue(mapped);

      await expect(
        controller.runCustomAction('mbti-house', {
          characterId: '00000000-0000-4000-8000-000000000002',
          actionType: 'POST',
        }),
      ).resolves.toEqual(mapped);
      expect(mockAdminService.runCustomAction).toHaveBeenCalledWith({
        slug: 'mbti-house',
        characterId: '00000000-0000-4000-8000-000000000002',
        actionType: 'POST',
      });
    });

    it('passes an empty body through as Any Character / Automatic', async () => {
      mockAdminService.runCustomAction.mockResolvedValue({
        status: 'success',
        decision: postDecision,
        log: logRecord,
      });

      await controller.runCustomAction('mbti-house', {});

      expect(mockAdminService.runCustomAction).toHaveBeenCalledWith({
        slug: 'mbti-house',
        characterId: undefined,
        actionType: undefined,
      });
    });
  });

  describe('getHealth', () => {
    it('delegates to the service and maps runtime health', async () => {
      mockAdminService.getHealth.mockResolvedValue(healthRecord);
      mockResponseMapper.mapHealth.mockReturnValue(healthResponse);

      await expect(controller.getHealth('mbti-house')).resolves.toEqual(
        healthResponse,
      );
      expect(mockAdminService.getHealth).toHaveBeenCalledWith('mbti-house');
      expect(mockResponseMapper.mapHealth).toHaveBeenCalledWith(healthRecord);
    });
  });

  describe('getTelemetry', () => {
    it('delegates to the service and maps the telemetry', async () => {
      const mapped: SimulationTelemetryResponse = {
        ...telemetryRecord,
        lastRunAt: telemetryRecord.lastRunAt?.toISOString() ?? null,
        lastSuccessAt: telemetryRecord.lastSuccessAt?.toISOString() ?? null,
        lastFailureAt: telemetryRecord.lastFailureAt?.toISOString() ?? null,
        lastProviderFailureAt:
          telemetryRecord.lastProviderFailureAt?.toISOString() ?? null,
      };
      mockAdminService.getTelemetry.mockResolvedValue(telemetryRecord);
      mockResponseMapper.mapTelemetry.mockReturnValue(mapped);

      await expect(controller.getTelemetry('mbti-house')).resolves.toEqual(
        mapped,
      );
      expect(mockAdminService.getTelemetry).toHaveBeenCalledWith('mbti-house');
    });
  });

  describe('getLogs', () => {
    it('delegates filters and pagination to the service', async () => {
      const paginated: Paginated<SimulationLogRecord> = {
        items: [logRecord],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      const mapped: ListSimulationLogsResponse = {
        items: [logResponse],
        meta: paginated.meta,
      };
      mockAdminService.listLogs.mockResolvedValue(paginated);
      mockResponseMapper.mapLogs.mockReturnValue(mapped);

      await expect(
        controller.getLogs('mbti-house', {
          characterId: '00000000-0000-4000-8000-000000000002',
          action: 'POST',
          status: 'SUCCESS',
          executionSource: 'one-action',
          page: 1,
          limit: 20,
        }),
      ).resolves.toEqual(mapped);
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
        controller.getHealth,
        controller.getTelemetry,
        controller.getLogs,
      ];

      for (const operation of operations) {
        expect(reflector.get<string[]>('ROLES', operation)).toEqual(['ADMIN']);
      }
    });
  });
});
