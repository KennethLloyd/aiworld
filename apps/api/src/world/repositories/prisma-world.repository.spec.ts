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
    repository: new PrismaWorldRepository(prisma as never),
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
      world: {
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
      where: { slug: 'mbti-house' },
      data: { isActive: false },
    });
  });
});
