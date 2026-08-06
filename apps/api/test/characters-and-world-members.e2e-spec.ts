import {
  adminCharacterResponseSchema,
  characterResponseSchema,
  listCharactersResponseSchema,
} from '@aiworld/shared/schemas/character-response.schema';
import { listWorldMembersResponseSchema } from '@aiworld/shared/schemas/world-member-response.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaService } from '@/lib/database/prisma.service';

import { MOCK_AUTH_SESSION } from './__mocks__/nestjs-better-auth';
import type { MockAuthSessionHolder } from './__mocks__/nestjs-better-auth';

describe('Characters and World Members API (e2e)', () => {
  let app: INestApplication<App>;
  const characterId = '00000000-0000-4000-8000-000000000001';
  const inactiveCharacterId = '00000000-0000-4000-8000-000000000002';
  const worldId = '00000000-0000-4000-8000-000000000010';
  const memberId = '00000000-0000-4000-8000-000000000020';
  const timestamps = {
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
  const character = {
    id: characterId,
    handle: 'logicnode',
    name: 'LogicNode',
    classification: 'INTP',
    classificationGroup: 'NT',
    avatarUrl: '/avatars/logicnode.svg',
    biography: 'A curious analyst.',
    traits: ['Curious', 'Pedantic'],
    systemPrompt: 'You are LogicNode. Never break character.',
    isActive: true,
    ...timestamps,
  };
  const inactiveCharacter = {
    ...character,
    id: inactiveCharacterId,
    handle: 'inactive_agent',
    name: 'Inactive Agent',
    isActive: false,
  };
  const world = { id: worldId, slug: 'mbti-house' };
  const member = {
    id: memberId,
    worldId,
    characterId,
    userId: null,
    role: 'AI',
    isActive: true,
    joinedAt: timestamps.createdAt,
    world,
  };

  const prismaStub = {
    character: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    worldMember: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    world: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaStub.character.findMany.mockResolvedValue([character]);
    prismaStub.character.count.mockResolvedValue(1);
    prismaStub.character.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === characterId
            ? character
            : where.id === inactiveCharacterId
              ? inactiveCharacter
              : null,
        ),
    );
    prismaStub.character.create.mockResolvedValue(character);
    prismaStub.character.update.mockResolvedValue(character);
    prismaStub.worldMember.findMany.mockResolvedValue([member]);
    prismaStub.worldMember.count.mockResolvedValue(1);
    prismaStub.worldMember.findUnique.mockResolvedValue(member);
    prismaStub.worldMember.create.mockResolvedValue(member);
    prismaStub.worldMember.update.mockResolvedValue({
      ...member,
      isActive: false,
    });
    prismaStub.world.findUnique.mockResolvedValue(world);
    prismaStub.$transaction.mockImplementation(
      async (callback: (transaction: typeof prismaStub) => Promise<unknown>) =>
        callback(prismaStub),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION).current = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns public active characters without systemPrompt even when isActive=false is requested', async () => {
    await request(app.getHttpServer())
      .get('/api/characters?isActive=false')
      .expect(200)
      .expect((response) => {
        expect(
          listCharactersResponseSchema.safeParse(response.body).success,
        ).toBe(true);
        expect(response.body.items[0]).not.toHaveProperty('systemPrompt');
      });

    expect(prismaStub.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('hides inactive character details from anonymous observers', () =>
    request(app.getHttpServer())
      .get(`/api/characters/${inactiveCharacterId}`)
      .expect(404));

  it('returns private character details to ADMIN only', async () => {
    app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION).current = {
      user: { role: 'ADMIN' },
      session: { id: 'mock-session' },
    };

    await request(app.getHttpServer())
      .get(`/api/characters/${inactiveCharacterId}`)
      .expect(200)
      .expect((response) => {
        expect(
          adminCharacterResponseSchema.safeParse(response.body).success,
        ).toBe(true);
        expect(response.body.systemPrompt).toBe(character.systemPrompt);
      });

    await request(app.getHttpServer())
      .get('/api/characters?isActive=false')
      .expect(200);

    expect(prismaStub.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('rejects anonymous and USER character mutations', async () => {
    await request(app.getHttpServer())
      .post('/api/characters')
      .send({
        handle: 'new_agent',
        name: 'New Agent',
        biography: 'A new resident.',
        traits: ['Curious'],
        systemPrompt: 'Stay in character.',
      })
      .expect(401);

    app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION).current = {
      user: { role: 'USER' },
      session: { id: 'mock-session' },
    };

    await request(app.getHttpServer())
      .post('/api/characters')
      .send({
        handle: 'new_agent',
        name: 'New Agent',
        biography: 'A new resident.',
        traits: ['Curious'],
        systemPrompt: 'Stay in character.',
      })
      .expect(403);
  });

  it('allows ADMIN character creation with an optional starting World', async () => {
    app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION).current = {
      user: { role: 'ADMIN' },
      session: { id: 'mock-session' },
    };

    await request(app.getHttpServer())
      .post('/api/characters')
      .send({
        handle: 'new_agent',
        name: 'New Agent',
        biography: 'A new resident.',
        traits: ['Curious'],
        systemPrompt: 'Stay in character.',
        worldSlug: 'mbti-house',
        classification: 'INTP',
        classificationGroup: 'NT',
      })
      .expect(201)
      .expect((response) => {
        expect(
          adminCharacterResponseSchema.safeParse(response.body).success,
        ).toBe(true);
        expect(response.body.systemPrompt).toBe(character.systemPrompt);
      });

    expect(prismaStub.$transaction).toHaveBeenCalled();
    expect(prismaStub.worldMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ characterId, role: 'AI' }),
      }),
    );
  });

  it('keeps World membership management ADMIN-only and supports status changes', async () => {
    await request(app.getHttpServer()).get('/api/world-members').expect(401);

    app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION).current = {
      user: { role: 'ADMIN' },
      session: { id: 'mock-session' },
    };

    await request(app.getHttpServer())
      .get('/api/world-members?worldSlug=mbti-house')
      .expect(200)
      .expect((response) => {
        expect(
          listWorldMembersResponseSchema.safeParse(response.body).success,
        ).toBe(true);
      });

    await request(app.getHttpServer())
      .patch(`/api/world-members/${memberId}`)
      .send({ isActive: false })
      .expect(200)
      .expect((response) => {
        expect(response.body.isActive).toBe(false);
      });
  });

  it('keeps the public character response contract free of private fields', () => {
    expect(
      characterResponseSchema.safeParse({
        id: character.id,
        handle: character.handle,
        name: character.name,
        classification: character.classification,
        classificationGroup: character.classificationGroup,
        avatarUrl: character.avatarUrl,
        biography: character.biography,
        traits: character.traits,
        isActive: character.isActive,
        createdAt: character.createdAt.toISOString(),
        updatedAt: character.updatedAt.toISOString(),
      }).success,
    ).toBe(true);
  });
});
