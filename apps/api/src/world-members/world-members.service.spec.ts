import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '@/lib/database/prisma.service';

import { WorldMembersService } from './world-members.service';

describe('WorldMembersService', () => {
  const prisma = {
    character: { findUnique: jest.fn() },
    world: { findUnique: jest.fn() },
    worldMember: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;
  let service: WorldMembersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorldMembersService(prisma);
  });

  it('rejects an AI membership when the character does not exist', async () => {
    (prisma.character.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create({
        worldSlug: 'mbti-house',
        characterId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.worldMember.create).not.toHaveBeenCalled();
  });

  it('updates membership activation through Prisma', async () => {
    const updated = {
      id: '00000000-0000-4000-8000-000000000001',
      worldId: 'world-id',
      characterId: 'character-id',
      userId: null,
      role: 'AI',
      isActive: false,
      joinedAt: new Date(),
      world: { slug: 'mbti-house' },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        worldMember: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: updated.id, isActive: true }),
          update: jest.fn().mockResolvedValue(updated),
        },
        vote: { findMany: jest.fn().mockResolvedValue([]) },
        post: { update: jest.fn() },
        comment: { update: jest.fn() },
      } as never),
    );

    await expect(
      service.update(updated.id, { isActive: false }),
    ).resolves.toMatchObject({ id: updated.id, isActive: false });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
