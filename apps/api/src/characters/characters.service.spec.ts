import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

import { CharactersService } from './characters.service';

describe('CharactersService', () => {
  const character = {
    id: '00000000-0000-4000-8000-000000000001',
    handle: 'new_agent',
    name: 'New Agent',
    classification: 'ENFP',
    classificationGroup: 'NF',
    avatarUrl: null,
    biography: 'A test resident',
    traits: ['Curious'] as Prisma.JsonValue,
    systemPrompt: 'Stay in character.',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    character: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;
  let service: CharactersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CharactersService(prisma);
    (prisma.character.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.character.count as jest.Mock).mockResolvedValue(0);
  });

  it('forces active-only character queries for non-admin callers', async () => {
    await service.list({ page: 1, limit: 20, isActive: false }, false);

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('allows an admin caller to request any character status', async () => {
    await service.list({ page: 1, limit: 20 }, true);

    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: undefined }),
      }),
    );
  });

  it('creates a character through Prisma', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        character: { create: jest.fn().mockResolvedValue(character) },
      } as never),
    );

    await expect(
      service.create({
        handle: character.handle,
        name: character.name,
        classification: character.classification,
        classificationGroup: character.classificationGroup,
        avatarUrl: null,
        biography: character.biography,
        traits: ['Curious'],
        systemPrompt: character.systemPrompt,
      }),
    ).resolves.toMatchObject({ id: character.id, handle: character.handle });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns null when updating a missing character', async () => {
    (prisma.character.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.update('missing-id', { name: 'Renamed' }),
    ).resolves.toBeNull();
    expect(prisma.character.update).not.toHaveBeenCalled();
  });
});
