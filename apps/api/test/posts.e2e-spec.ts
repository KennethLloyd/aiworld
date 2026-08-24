import { listPostsResponseSchema } from '@aiworld/shared/schemas/post-response.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

import {
  buildSeedVotes,
  canonicalWorld,
  characters,
  flattenComments,
  posts,
  seedUuid,
} from '../prisma/seed-data';
import { seedWorld } from '../prisma/seed-world';
import { MOCK_AUTH_SESSION } from './__mocks__/nestjs-better-auth';
import type { MockAuthSessionHolder } from './__mocks__/nestjs-better-auth';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/aiworld';

const seededPostId = (key: string): string => seedUuid(`post:${key}`);

const hotOrder = ['p6', 'p1', 'p2', 'p3', 'p8', 'p4', 'p5', 'p7'].map(
  seededPostId,
);
const newOrder = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map(
  seededPostId,
);

describe('World feed (seeded database)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  beforeAll(async () => {
    await seedWorld(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.get(PrismaService).$disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  it('serves the hot feed anonymously with vote scores aggregated from Vote rows', async () => {
    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = null;

    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot')
      .expect(200);

    expect(listPostsResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items.map((post: { id: string }) => post.id)).toEqual(
      hotOrder,
    );
    for (const post of posts) {
      const item = res.body.items.find(
        (candidate: { id: string }) => candidate.id === seededPostId(post.key),
      );
      expect(item).toBeDefined();
      expect(item.voteScore).toBe(post.upvotes);
      expect(item.createdAt).toBe(new Date(post.createdAt).toISOString());
      expect(item.commentCount).toBe(flattenComments(post.comments).length);
      const authorCharacter = characters.find(
        (character) => character.key === post.authorKey,
      );
      expect(item.author).toEqual({
        id: seedUuid(`member:${post.authorKey}`),
        characterId: seedUuid(`character:${post.authorKey}`),
        handle: authorCharacter!.key,
        name: authorCharacter!.name,
        avatarUrl: authorCharacter!.avatarUrl,
        classification: authorCharacter!.classification,
        classificationGroup: authorCharacter!.classificationGroup,
      });
    }
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 8,
      totalPages: 1,
    });
  });

  it('serves the new feed ordered by createdAt with the same aggregated scores', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=new')
      .expect(200);

    expect(listPostsResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items.map((post: { id: string }) => post.id)).toEqual(
      newOrder,
    );
    for (const post of posts) {
      const item = res.body.items.find(
        (candidate: { id: string }) => candidate.id === seededPostId(post.key),
      );
      expect(item.voteScore).toBe(post.upvotes);
      expect(item.commentCount).toBe(flattenComments(post.comments).length);
    }
  });

  it('paginates with the shared pagination metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot&page=1&limit=2')
      .expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 8,
      totalPages: 4,
    });

    const resPageTwo = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot&page=2&limit=2')
      .expect(200);

    expect(resPageTwo.body.items).toHaveLength(2);
    expect(resPageTwo.body.items[0].id).toBe(seededPostId('p2'));
    expect(resPageTwo.body.items[1].id).toBe(seededPostId('p3'));
    expect(resPageTwo.body.meta.page).toBe(2);
  });

  it('returns an empty page with stable metadata beyond the last page', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot&page=99')
      .expect(200);

    expect(listPostsResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items).toEqual([]);
    expect(res.body.meta).toEqual({
      page: 99,
      limit: 20,
      total: 8,
      totalPages: 1,
    });
  });

  it('returns stable results under repeated reads', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot')
      .expect(200);

    expect(second.body).toEqual(first.body);
  });

  it('ignores votes cast by inactive members', async () => {
    const p3 = posts.find((post) => post.key === 'p3')!;
    const voterKeys = buildSeedVotes(
      p3,
      characters.map((character) => character.key),
    ).map((vote) => vote.memberKey);
    const world = await prisma.world.findUnique({
      where: { slug: canonicalWorld.slug },
    });

    const characterId = seedUuid('character:inactive-feed-test');
    const memberId = seedUuid(`member:${voterKeys[0]}:inactive-feed-test`);
    await prisma.character.create({
      data: {
        id: characterId,
        handle: 'inactive_feed_test',
        name: 'Inactive Feed Test',
        biography: 'Synthetic character for the inactive-voter feed test.',
        traits: [],
        systemPrompt: 'Synthetic.',
        isActive: false,
      },
    });
    await prisma.worldMember.create({
      data: {
        id: memberId,
        worldId: world!.id,
        characterId,
        role: 'AI',
        isActive: false,
      },
    });
    await prisma.vote.create({
      data: {
        id: seedUuid('vote:inactive-feed-test'),
        postId: seededPostId('p3'),
        authorMemberId: memberId,
        value: 1,
      },
    });

    try {
      const res = await request(app.getHttpServer())
        .get('/api/worlds/mbti-house/posts?sort=hot')
        .expect(200);

      const p3Item = res.body.items.find(
        (candidate: { id: string }) => candidate.id === seededPostId('p3'),
      );
      expect(p3Item.voteScore).toBe(p3.upvotes);
    } finally {
      await prisma.vote.delete({
        where: { id: seedUuid('vote:inactive-feed-test') },
      });
      await prisma.worldMember.delete({ where: { id: memberId } });
      await prisma.character.delete({ where: { id: characterId } });
    }
  });

  it('rejects a vote without a member principal at the schema boundary', async () => {
    // A vote row can never lack a principal: authorMemberId is NOT NULL and
    // FK-constrained, so the "ignore non-member principals" aggregation rule
    // is guaranteed by the schema. Raw SQL bypasses the generated types,
    // which already make authorMemberId mandatory.
    await expect(
      prisma.$executeRaw`
        INSERT INTO "vote" ("id", "postId", "value")
        VALUES (${seedUuid('vote:no-principal-test')}, ${seededPostId('p1')}, 1)
      `,
    ).rejects.toThrow();
  });
});

describe('World feed (HTTP boundary)', () => {
  let app: INestApplication<App>;

  const worldId = '00000000-0000-4000-8000-000000000001';
  const worldRecord = {
    id: worldId,
    name: 'The MBTI House',
    slug: 'mbti-house',
    description: { about: '16 personality types in a shared space' },
    rules: [],
    topicScope: 'MBTI theory and house life',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const postOne = {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
    author: {
      id: '00000000-0000-4000-8000-000000000201',
      character: {
        handle: 'thunder_struck',
        name: 'Thunder_Struck',
        avatarUrl: '/avatars/thunder_struck.svg',
      },
      user: null,
    },
  };
  const postTwo = {
    id: '00000000-0000-4000-8000-000000000102',
    title: 'URGENT: The Toaster Situation',
    content: '47 pieces on the counter.',
    createdAt: new Date('2026-08-06T05:00:00.000Z'),
    updatedAt: new Date('2026-08-06T05:00:00.000Z'),
    author: {
      id: '00000000-0000-4000-8000-000000000202',
      character: {
        handle: 'boss_mode',
        name: 'Boss_Mode',
        avatarUrl: '/avatars/boss_mode.svg',
      },
      user: null,
    },
  };

  const prismaStub = {
    world: {
      findUnique: jest.fn(),
    },
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    vote: {
      groupBy: jest.fn(),
    },
    comment: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaStub.world.findUnique.mockImplementation(
      (args: { where: { slug: string } }) =>
        Promise.resolve(
          args.where.slug === worldRecord.slug ? worldRecord : null,
        ),
    );
    prismaStub.post.findMany.mockResolvedValue([]);
    prismaStub.post.count.mockResolvedValue(0);
    prismaStub.vote.groupBy.mockResolvedValue([]);
    prismaStub.comment.groupBy.mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an invalid sort value through the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=controversial')
      .expect(400);

    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.message[0]).toEqual(
      expect.objectContaining({ path: ['sort'] }),
    );
  });

  it('rejects out-of-range pagination through the error envelope', async () => {
    for (const query of ['page=0', 'limit=0', 'limit=101']) {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/mbti-house/posts?${query}`)
        .expect(400);

      expect(res.body.error).toBe('Validation Failed');
    }
  });

  it('returns 404 with the normalized envelope for an unknown world', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/missing-world/posts')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
  });

  it('ranks the hot feed in one grouped vote query and exposes only the shared contract fields', async () => {
    prismaStub.post.findMany.mockResolvedValue([postTwo, postOne]);
    prismaStub.vote.groupBy.mockResolvedValue([
      { postId: postOne.id, _sum: { value: 5 } },
      { postId: postTwo.id, _sum: { value: 3 } },
    ]);
    prismaStub.comment.groupBy.mockResolvedValue([
      { postId: postOne.id, _count: { _all: 7 } },
      { postId: postTwo.id, _count: { _all: 2 } },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot&page=1&limit=20')
      .expect(200);

    expect(listPostsResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items.map((post: { id: string }) => post.id)).toEqual([
      postOne.id,
      postTwo.id,
    ]);
    expect(res.body.items[0].voteScore).toBe(5);
    expect(res.body.items[0].commentCount).toBe(7);
    expect(res.body.items[0].author).toEqual({
      id: postOne.author.id,
      handle: 'thunder_struck',
      name: 'Thunder_Struck',
      avatarUrl: '/avatars/thunder_struck.svg',
    });
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      [
        'author',
        'commentCount',
        'content',
        'createdAt',
        'id',
        'title',
        'updatedAt',
        'voteScore',
      ].sort(),
    );

    expect(prismaStub.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { worldId },
        select: expect.objectContaining({
          id: true,
          title: true,
          content: true,
        }),
      }),
    );
    expect(prismaStub.vote.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaStub.vote.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['postId'],
        where: {
          postId: { in: [postTwo.id, postOne.id] },
          author: { isActive: true },
        },
        _sum: { value: true },
      }),
    );
    expect(prismaStub.comment.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaStub.comment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['postId'],
        where: { postId: { in: [postTwo.id, postOne.id] } },
        _count: { _all: true },
      }),
    );
  });

  it('pages the new sort in SQL and aggregates votes only for the page', async () => {
    prismaStub.post.findMany.mockResolvedValue([postOne, postTwo]);
    prismaStub.post.count.mockResolvedValue(4);
    prismaStub.vote.groupBy.mockResolvedValue([
      { postId: postOne.id, _sum: { value: 5 } },
      { postId: postTwo.id, _sum: { value: 3 } },
    ]);
    prismaStub.comment.groupBy.mockResolvedValue([
      { postId: postOne.id, _count: { _all: 7 } },
      { postId: postTwo.id, _count: { _all: 2 } },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=new&page=2&limit=2')
      .expect(200);

    expect(res.body.items.map((post: { id: string }) => post.id)).toEqual([
      postOne.id,
      postTwo.id,
    ]);
    expect(
      res.body.items.map((post: { commentCount: number }) => post.commentCount),
    ).toEqual([7, 2]);
    expect(res.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
    });

    expect(prismaStub.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { worldId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 2,
        take: 2,
      }),
    );
    expect(prismaStub.vote.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaStub.vote.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          postId: { in: [postOne.id, postTwo.id] },
          author: { isActive: true },
        },
      }),
    );
    expect(prismaStub.comment.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaStub.comment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postId: { in: [postOne.id, postTwo.id] } },
      }),
    );
  });
});
