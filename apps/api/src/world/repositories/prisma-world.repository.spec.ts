import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { PrismaWorldRepository } from '@/world/repositories/prisma-world.repository';

function worldRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'The MBTI House',
    slug: 'mbti-house',
    description: { about: 'A world of personality typology.' },
    rules: ['Stay in character'],
    topicScope: 'Personality types.',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    _count: { members: 16 },
    ...overrides,
  };
}

function createRepository() {
  const prisma = {
    $transaction: jest.fn(),
    world: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    worldSimulationConfig: {
      updateMany: jest.fn(),
    },
  };

  return {
    prisma,
    repository: new PrismaWorldRepository(
      prisma as never,
      createDefaultSimulationConfig(),
    ),
  };
}

describe('PrismaWorldRepository resident counts', () => {
  it('loads active AI residents into the public world record', async () => {
    const { prisma, repository } = createRepository();
    prisma.world.findMany.mockResolvedValue([worldRow()]);
    prisma.world.count.mockResolvedValue(1);

    const result = await repository.findAll({ page: 1, limit: 20 });

    expect(result.items[0]?.residentCount).toBe(16);
    expect(prisma.world.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          _count: {
            select: {
              members: {
                where: {
                  role: 'AI',
                  isActive: true,
                  character: { isActive: true },
                },
              },
            },
          },
        },
      }),
    );
  });

  it('pauses a running simulation in the same transaction as World deactivation', async () => {
    const { prisma, repository } = createRepository();
    const transaction = {
      $executeRaw: jest.fn(),
      world: {
        findUnique: jest.fn().mockResolvedValue(worldRow()),
        update: jest.fn().mockResolvedValue(worldRow({ isActive: false })),
      },
      worldSimulationConfig: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.world.findUnique.mockResolvedValue(worldRow());
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await repository.update('mbti-house', { isActive: false });

    expect(transaction.worldSimulationConfig.updateMany).toHaveBeenCalledWith({
      where: {
        worldId: '00000000-0000-4000-8000-000000000001',
        state: 'RUNNING',
      },
      data: { state: 'PAUSED' },
    });
    expect(transaction.world.update).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000001',
      },
      data: { isActive: false },
    });
  });
  it('reactivates a World without resuming its simulation configuration', async () => {
    const { prisma, repository } = createRepository();
    prisma.world.findUnique.mockResolvedValue(worldRow({ isActive: false }));
    prisma.world.update.mockResolvedValue(worldRow({ isActive: true }));

    const result = await repository.update('mbti-house', { isActive: true });

    expect(result?.isActive).toBe(true);
    expect(prisma.world.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'mbti-house' },
        data: expect.objectContaining({ isActive: true }),
      }),
    );
    expect(prisma.worldSimulationConfig.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
describe('PrismaWorldRepository World creation', () => {
  it('creates the World and canonical simulation config in one transaction', async () => {
    const { prisma, repository } = createRepository();
    const transaction = {
      world: {
        create: jest.fn().mockResolvedValue(worldRow()),
      },
      worldSimulationConfig: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    const result = await repository.create({
      name: 'The MBTI House',
      slug: 'mbti-house',
      description: { about: 'A world of personality typology.' },
      rules: ['Stay in character'],
      topicScope: 'Personality types.',
    });

    expect(result.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(transaction.world.create).toHaveBeenCalledWith({
      data: {
        name: 'The MBTI House',
        slug: 'mbti-house',
        description: { about: 'A world of personality typology.' },
        rules: ['Stay in character'],
        topicScope: 'Personality types.',
      },
    });
    expect(transaction.worldSimulationConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        worldId: '00000000-0000-4000-8000-000000000001',
        state: 'PAUSED',
        speedMultiplier: 1,
        intervalMs: 1_800_000,
        jitterMs: 300_000,
        actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('copies mutable action weights for each World', async () => {
    const { prisma, repository } = createRepository();
    const transaction = {
      world: {
        create: jest.fn().mockResolvedValue(worldRow()),
      },
      worldSimulationConfig: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    const world = {
      name: 'The MBTI House',
      slug: 'mbti-house',
      description: null,
      rules: ['Stay in character'],
      topicScope: 'Personality types.',
    };
    await repository.create(world);
    await repository.create({ ...world, slug: 'another-world' });

    const firstConfig =
      transaction.worldSimulationConfig.create.mock.calls[0][0].data;
    const secondConfig =
      transaction.worldSimulationConfig.create.mock.calls[1][0].data;
    expect(firstConfig.actionWeights).not.toBe(secondConfig.actionWeights);
    expect(firstConfig.actionWeights).toEqual(secondConfig.actionWeights);
  });

  it('propagates simulation config failure through the transaction', async () => {
    const { prisma, repository } = createRepository();
    const transaction = {
      world: {
        create: jest.fn().mockResolvedValue(worldRow()),
      },
      worldSimulationConfig: {
        create: jest.fn().mockRejectedValue(new Error('config write failed')),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await expect(
      repository.create({
        name: 'The MBTI House',
        slug: 'mbti-house',
        description: null,
        rules: ['Stay in character'],
        topicScope: 'Personality types.',
      }),
    ).rejects.toThrow('config write failed');
    expect(transaction.world.create).toHaveBeenCalledTimes(1);
    expect(transaction.worldSimulationConfig.create).toHaveBeenCalledTimes(1);
  });
});

describe('PrismaWorldRepository simulation execution lock', () => {
  it('runs the operation while the active World lock is held', async () => {
    const { prisma, repository } = createRepository();
    const transaction = {
      $executeRaw: jest.fn(),
      world: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'world-1', isActive: true }),
      },
    };
    const operation = jest.fn().mockResolvedValue('completed');
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await expect(
      repository.withActiveSimulationLock('world-1', operation),
    ).resolves.toEqual({ status: 'executed', value: 'completed' });

    expect(operation).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('does not run the operation for an inactive World', async () => {
    const { prisma, repository } = createRepository();
    const transaction = {
      $executeRaw: jest.fn(),
      world: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'world-1', isActive: false }),
      },
    };
    const operation = jest.fn();
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await expect(
      repository.withActiveSimulationLock('world-1', operation),
    ).resolves.toEqual({ status: 'inactive' });

    expect(operation).not.toHaveBeenCalled();
  });
});
