import { Prisma } from '@/generated/prisma/client';
import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { PrismaService } from '@/lib/database/prisma.service';

import { WorldDeactivationRejectedError } from './world.error';
import { WorldService } from './world.service';

describe('WorldService', () => {
  const row = {
    id: 'world-1',
    name: 'MBTI Discussion',
    slug: 'mbti',
    description: {
      about: 'A community for MBTI enthusiasts',
    } as Prisma.JsonValue,
    rules: ['Keep discussions civil.'] as Prisma.JsonValue,
    topicScope: 'MBTI theory',
    isActive: true,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-02'),
  };
  const worldRow = { ...row, _count: { members: 16 } };
  const prisma = {
    world: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    worldSimulationConfig: { create: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const defaults = createDefaultSimulationConfig();
  let service: WorldService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorldService(prisma as unknown as PrismaService, defaults);
    prisma.world.findMany.mockResolvedValue([worldRow]);
    prisma.world.count.mockResolvedValue(1);
    prisma.world.findUnique.mockResolvedValue(worldRow);
  });

  it('lists worlds with resident counts and trims search input', async () => {
    const query = { page: 1, limit: 10, search: '  mbti  ' };

    await expect(service.list(query, true)).resolves.toMatchObject({
      items: [{ id: 'world-1', residentCount: 16 }],
    });
    expect(prisma.world.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: undefined }),
      }),
    );
    expect(prisma.world.count).toHaveBeenCalled();
    expect(query.search).toBe('  mbti  ');
  });

  it('forces active-only results for non-admin callers', async () => {
    await service.list({ page: 1, limit: 10, isActive: false }, false);

    expect(prisma.world.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('hides inactive worlds from public reads and maps missing worlds to null', async () => {
    prisma.world.findUnique.mockResolvedValue({ ...worldRow, isActive: false });
    await expect(service.getBySlug('mbti', false)).resolves.toBeNull();

    prisma.world.findUnique.mockResolvedValue(null);
    await expect(service.getBySlug('missing', true)).resolves.toBeNull();
  });

  it('creates a World and its default simulation config in one transaction', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        world: { create: jest.fn().mockResolvedValue(row) },
        worldSimulationConfig: { create: jest.fn() },
      } as never),
    );

    await expect(
      service.create({
        name: row.name,
        slug: row.slug,
        description: row.description as { about: string },
        rules: ['Keep discussions civil.'],
        topicScope: row.topicScope,
      }),
    ).resolves.toMatchObject({ id: row.id, residentCount: 0 });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns null when updating a missing World and deletes by slug', async () => {
    prisma.world.findUnique.mockResolvedValue(null);
    await expect(
      service.update('missing', { name: 'Unknown' }),
    ).resolves.toBeNull();

    prisma.world.delete.mockResolvedValue(row);
    await expect(service.delete('mbti')).resolves.toBeUndefined();
    expect(prisma.world.delete).toHaveBeenCalledWith({
      where: { slug: 'mbti' },
    });
  });

  it('rejects deactivation of a World with a RUNNING simulation', async () => {
    const transaction = {
      world: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn(),
      },
      worldSimulationConfig: {
        findUnique: jest.fn().mockResolvedValue({ state: 'RUNNING' }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    await expect(
      service.update('mbti', { isActive: false }),
    ).rejects.toBeInstanceOf(WorldDeactivationRejectedError);
    expect(transaction.world.update).not.toHaveBeenCalled();
  });
});
