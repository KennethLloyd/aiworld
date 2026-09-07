import { Prisma } from '@/generated/prisma/client';
import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { PrismaWorldSimulationConfigRepository } from '@/simulation/lifecycle/prisma-world-simulation-config.repository';
import {
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    worldId: 'world-1',
    ...createDefaultSimulationConfig(),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createRepository() {
  const prisma = {
    worldSimulationConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const repository = new PrismaWorldSimulationConfigRepository(prisma as never);
  return { repository, prisma };
}

describe('PrismaWorldSimulationConfigRepository', () => {
  it('maps a persisted row to a domain record', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(row());

    await expect(repository.findByWorldId('world-1')).resolves.toMatchObject({
      state: 'PAUSED',
      actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
    });
  });

  it('returns null when no row is persisted', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(null);

    await expect(repository.findByWorldId('missing')).resolves.toBeNull();
  });

  it('finds all persisted configs in a given state', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.findMany.mockResolvedValue([
      row({ id: 'config-1' }),
      row({ id: 'config-2' }),
    ]);

    await expect(repository.findAllByState('RUNNING')).resolves.toHaveLength(2);
    expect(prisma.worldSimulationConfig.findMany).toHaveBeenCalledWith({
      where: { state: 'RUNNING' },
    });
  });

  it('skips malformed rows during scheduler reconciliation', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.findMany.mockResolvedValue([
      row({ id: 'config-bad', actionWeights: { POST: 0.5 } }),
      row({ id: 'config-good' }),
    ]);

    await expect(repository.findAllByState('RUNNING')).resolves.toMatchObject([
      { id: 'config-good' },
    ]);
  });

  it('surfaces malformed persisted weights', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      row({ actionWeights: { POST: 0.5 } }),
    );

    await expect(repository.findByWorldId('world-1')).rejects.toThrow(
      SimulationConfigMalformedError,
    );
  });

  it('sets the desired state and returns the updated record', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.update.mockResolvedValue(
      row({ state: 'RUNNING' }),
    );

    await expect(
      repository.setState('world-1', 'RUNNING'),
    ).resolves.toMatchObject({ state: 'RUNNING' });
    expect(prisma.worldSimulationConfig.update).toHaveBeenCalledWith({
      where: { worldId: 'world-1' },
      data: { state: 'RUNNING' },
    });
  });

  it('maps a missing config during a desired-state write', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(repository.setState('missing', 'RUNNING')).rejects.toThrow(
      SimulationConfigNotFoundError,
    );
  });

  it('persists a speed multiplier and returns the updated record', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.updateMany.mockResolvedValue({ count: 1 });
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      row({ speedMultiplier: 2 }),
    );

    await expect(
      repository.updateSpeedMultiplier('world-1', 2),
    ).resolves.toMatchObject({ speedMultiplier: 2 });
  });

  it('throws not-found when updating the speed of a missing config', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.updateSpeedMultiplier('missing', 2),
    ).rejects.toThrow(SimulationConfigNotFoundError);
  });
});
