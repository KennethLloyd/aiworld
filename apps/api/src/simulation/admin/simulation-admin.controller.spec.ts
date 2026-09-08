import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { SimulationAdminController } from '@/simulation/admin/simulation-admin.controller';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';
import { SimulationHealth } from '@/simulation/admin/simulation-health';
import { SimulationTelemetry } from '@/simulation/domain/simulation-telemetry';
import { SimulationConfig } from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationLogEntry } from '@/simulation/logging/simulation-log.service';
import { IterationRunResult } from '@/simulation/scheduler/simulation-runner';

const config: SimulationConfig = {
  id: 'config-1',
  worldId: 'world-1',
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 1_800_000,
  jitterMs: 300_000,
  actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
};
const log: SimulationLogEntry = {
  id: 'log-1',
  worldId: 'world-1',
  characterId: 'character-1',
  action: 'POST',
  targetId: null,
  reasoning: 'R',
  provider: 'mock',
  model: 'fixture',
  latencyMs: 7,
  jobId: null,
  executionSource: 'one-action',
  tokensUsed: 10,
  costEstimate: 0.001,
  status: 'SUCCESS',
  errorMessage: null,
  executedAt: new Date('2026-08-13'),
};
const telemetry: SimulationTelemetry = {
  worldId: 'world-1',
  totalRuns: 1,
  successCount: 1,
  failedCount: 0,
  skippedCount: 0,
  rejectedCount: 0,
  totalTokensUsed: 10,
  totalCostEstimateUsd: 0.001,
  averageLatencyMs: 7,
  lastRunAt: log.executedAt,
};
const health: SimulationHealth = {
  lifecycleState: 'PAUSED',
  health: { status: 'IDLE', reason: 'Simulation is intentionally PAUSED.' },
  scheduler: {
    available: true,
    pending: false,
    workExpected: false,
    nextTurnAt: null,
    lastTurnStartedAt: null,
    lastTurnCompletedAt: null,
    retrying: false,
    recentRetryCount: 0,
    blockedReason: null,
    deadLetterCount: 0,
    lastDeadLetterAt: null,
    lastDeadLetterReason: null,
    bootResumeFailure: null,
  },
  execution: { lastSuccessAt: null, lastFailureAt: null },
  provider: { status: 'UNKNOWN', lastSuccessAt: null, lastFailureAt: null },
  telemetry,
};

describe('SimulationAdminController', () => {
  let controller: SimulationAdminController;
  const adminService = {
    getConfig: jest.fn(),
    updateState: jest.fn(),
    updateSpeed: jest.fn(),
    runOneAction: jest.fn(),
    runCustomAction: jest.fn(),
    getHealth: jest.fn(),
    getTelemetry: jest.fn(),
    listLogs: jest.fn(),
  } as unknown as jest.Mocked<SimulationAdminService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulationAdminController],
      providers: [{ provide: SimulationAdminService, useValue: adminService }],
    }).compile();
    controller = module.get(SimulationAdminController);
  });

  it('maps config, run, health, telemetry, and log results with ordinary functions', async () => {
    adminService.getConfig.mockResolvedValue(config);
    await expect(controller.getSimulation('mbti-house')).resolves.toMatchObject(
      {
        id: config.id,
        createdAt: config.createdAt.toISOString(),
      },
    );

    const run: IterationRunResult = {
      status: 'success',
      decision: {
        action: 'POST',
        worldId: 'world-1',
        memberId: 'member-1',
        characterId: 'character-1',
        title: 'A title',
        content: 'Body',
        reasoning: 'R',
      },
      log,
    };
    adminService.runOneAction.mockResolvedValue(run);
    await expect(controller.runOneAction('mbti-house')).resolves.toMatchObject({
      status: 'success',
      log: { id: log.id, executedAt: log.executedAt.toISOString() },
    });

    adminService.getHealth.mockResolvedValue(health);
    await expect(controller.getHealth('mbti-house')).resolves.toMatchObject({
      lifecycle: { state: 'PAUSED' },
    });
    adminService.getTelemetry.mockResolvedValue(telemetry);
    await expect(controller.getTelemetry('mbti-house')).resolves.toMatchObject({
      worldId: 'world-1',
      lastRunAt: telemetry.lastRunAt?.toISOString(),
    });
  });

  it('passes state, speed, custom action, and log filters to the service', async () => {
    adminService.updateState.mockResolvedValue(config);
    await controller.updateState('mbti-house', { state: 'PAUSED' });
    expect(adminService.updateState).toHaveBeenCalledWith(
      'mbti-house',
      'PAUSED',
    );

    adminService.updateSpeed.mockResolvedValue(config);
    await controller.updateSpeed('mbti-house', { speedMultiplier: 2 });
    expect(adminService.updateSpeed).toHaveBeenCalledWith('mbti-house', 2);

    adminService.runCustomAction.mockResolvedValue({
      status: 'success',
      decision: {
        action: 'POST',
        worldId: 'world-1',
        memberId: 'member-1',
        characterId: 'character-1',
        title: 'A title',
        content: 'Body',
        reasoning: 'R',
      },
      log,
    });
    await controller.runCustomAction('mbti-house', {
      characterId: 'character-1',
      actionType: 'POST',
    });
    expect(adminService.runCustomAction).toHaveBeenCalledWith({
      slug: 'mbti-house',
      characterId: 'character-1',
      actionType: 'POST',
    });

    const page: Paginated<SimulationLogEntry> = {
      items: [log],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    adminService.listLogs.mockResolvedValue(page);
    await controller.getLogs('mbti-house', {
      characterId: 'character-1',
      action: 'POST',
      status: 'SUCCESS',
      executionSource: 'one-action',
      page: 1,
      limit: 20,
    });
    expect(adminService.listLogs).toHaveBeenCalledWith({
      slug: 'mbti-house',
      filters: {
        characterId: 'character-1',
        action: 'POST',
        status: 'SUCCESS',
        executionSource: 'one-action',
      },
      page: 1,
      limit: 20,
    });
  });

  it('requires ADMIN on every operation', () => {
    const reflector = new Reflector();
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
