import { Prisma } from '@/generated/prisma/client';
import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import {
  SimulationConfigNotFoundError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';

import { SimulationLifecycleService } from './simulation-lifecycle.service';

function configRow(
  state: SimulationState = 'PAUSED',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'config-1',
    worldId: 'world-1',
    ...createDefaultSimulationConfig(),
    state,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...overrides,
  };
}

function createService(state: SimulationState = 'PAUSED', isActive = true) {
  const prisma = {
    worldSimulationConfig: {
      findUnique: jest.fn().mockResolvedValue(configRow(state)),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    world: {
      findUnique: jest.fn().mockResolvedValue({ id: 'world-1', isActive }),
    },
  };
  return {
    service: new SimulationLifecycleService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('SimulationLifecycleService', () => {
  it('reads configuration by World id and skips malformed reconciliation rows', async () => {
    const { service, prisma } = createService();
    const persisted = configRow();
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(persisted);
    await expect(service.getByWorldId('world-1')).resolves.toMatchObject({
      state: 'PAUSED',
      actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
    });

    prisma.worldSimulationConfig.findMany.mockResolvedValue([
      configRow('RUNNING', { actionWeights: { POST: 1 } }),
      configRow('RUNNING', { worldId: 'world-2' }),
    ]);
    await expect(service.findWorldIdsByState('RUNNING')).resolves.toEqual([
      { worldId: 'world-2' },
    ]);
  });

  it('persists valid lifecycle transitions and avoids redundant writes', async () => {
    const { service, prisma } = createService('PAUSED');
    prisma.worldSimulationConfig.update.mockResolvedValue(configRow('RUNNING'));
    await service.start('world-1');
    expect(prisma.worldSimulationConfig.update).toHaveBeenCalledWith({
      where: { worldId: 'world-1' },
      data: { state: 'RUNNING' },
    });

    jest.clearAllMocks();
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      configRow('RUNNING'),
    );
    await expect(
      service.transitionTo('world-1', 'RUNNING'),
    ).resolves.toMatchObject({ state: 'RUNNING' });
    expect(prisma.worldSimulationConfig.update).not.toHaveBeenCalled();
  });

  it('rejects invalid transitions, inactive Worlds, and missing configs', async () => {
    const invalid = createService('HALTED');
    await expect(
      invalid.service.transitionTo('world-1', 'PAUSED'),
    ).rejects.toThrow('Invalid simulation state transition');

    const inactive = createService('PAUSED', false);
    await expect(inactive.service.start('world-1')).rejects.toMatchObject({
      kind: 'LIFECYCLE',
      reason: 'INACTIVE',
    });

    const missing = createService();
    missing.prisma.worldSimulationConfig.findUnique.mockResolvedValue(null);
    await expect(missing.service.start('missing')).rejects.toBeInstanceOf(
      SimulationConfigNotFoundError,
    );
  });

  it('updates speed and enforces manual and scheduled lifecycle gates', async () => {
    const { service, prisma } = createService('RUNNING');
    prisma.worldSimulationConfig.update.mockResolvedValue(
      configRow('RUNNING', { speedMultiplier: 2 }),
    );
    await expect(service.updateSpeed('world-1', 2)).resolves.toMatchObject({
      speedMultiplier: 2,
    });
    await expect(
      service.assertManualWorkAllowed('world-1'),
    ).resolves.toMatchObject({
      state: 'RUNNING',
    });
    await expect(
      service.assertScheduledWorkAllowed('world-1'),
    ).resolves.toMatchObject({
      state: 'RUNNING',
    });

    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      configRow('HALTED'),
    );
    await expect(
      service.assertManualWorkAllowed('world-1'),
    ).rejects.toBeInstanceOf(SimulationWorkRejectedError);
  });

  it('maps a missing config during a state update', async () => {
    const { service, prisma } = createService();
    prisma.worldSimulationConfig.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.start('world-1')).rejects.toBeInstanceOf(
      SimulationConfigNotFoundError,
    );
  });
});
