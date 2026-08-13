import { PrismaWorldSimulationConfigRepository } from '@/simulation/lifecycle/prisma-world-simulation-config.repository';
import {
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
  SimulationStateConcurrentChangeError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    worldId: 'world-1',
    state: 'PAUSED',
    speedMultiplier: 1,
    intervalMs: 30000,
    jitterMs: 5000,
    actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
    providerId: 'mock',
    model: 'fixture-model',
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
      updateMany: jest.fn(),
    },
  };
  const repository = new PrismaWorldSimulationConfigRepository(prisma as never);
  return { repository, prisma };
}

describe('PrismaWorldSimulationConfigRepository', () => {
  it('maps a persisted row to a domain record on findByWorldId', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(row());

    const result = await repository.findByWorldId('world-1');

    expect(prisma.worldSimulationConfig.findUnique).toHaveBeenCalledWith({
      where: { worldId: 'world-1' },
    });
    expect(result).toMatchObject({
      id: 'config-1',
      worldId: 'world-1',
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

    const result = await repository.findAllByState('RUNNING');

    expect(prisma.worldSimulationConfig.findMany).toHaveBeenCalledWith({
      where: { state: 'RUNNING' },
    });
    expect(result.map((record) => record.id)).toEqual(['config-1', 'config-2']);
  });

  it('surfaces malformed persisted weights instead of fabricating them', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      row({ actionWeights: { POST: 0.5 } }),
    );

    await expect(repository.findByWorldId('world-1')).rejects.toThrow(
      SimulationConfigMalformedError,
    );
  });

  it('atomically transitions state and returns the updated record', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.updateMany.mockResolvedValue({ count: 1 });
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      row({ state: 'RUNNING' }),
    );

    const result = await repository.transitionState(
      'world-1',
      'PAUSED',
      'RUNNING',
    );

    expect(prisma.worldSimulationConfig.updateMany).toHaveBeenCalledWith({
      where: { worldId: 'world-1', state: 'PAUSED' },
      data: { state: 'RUNNING' },
    });
    expect(result.state).toBe('RUNNING');
  });

  it('throws a concurrent-change error when the persisted state moved', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.updateMany.mockResolvedValue({ count: 0 });
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      row({ state: 'HALTED' }),
    );

    await expect(
      repository.transitionState('world-1', 'PAUSED', 'RUNNING'),
    ).rejects.toThrow(SimulationStateConcurrentChangeError);
  });

  it('throws not-found when the row disappeared before the transition', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.updateMany.mockResolvedValue({ count: 0 });
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(null);

    await expect(
      repository.transitionState('missing', 'PAUSED', 'RUNNING'),
    ).rejects.toThrow(SimulationConfigNotFoundError);
  });

  it('reports the persisted state even if the row changed during read-back', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.updateMany.mockResolvedValue({ count: 1 });
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(
      row({ state: 'HALTED' }),
    );

    const result = await repository.transitionState(
      'world-1',
      'PAUSED',
      'RUNNING',
    );

    expect(result.state).toBe('RUNNING');
  });

  it('throws not-found when the row vanishes after a successful update', async () => {
    const { repository, prisma } = createRepository();
    prisma.worldSimulationConfig.updateMany.mockResolvedValue({ count: 1 });
    prisma.worldSimulationConfig.findUnique.mockResolvedValue(null);

    await expect(
      repository.transitionState('world-1', 'PAUSED', 'RUNNING'),
    ).rejects.toThrow(SimulationConfigNotFoundError);
  });
});
