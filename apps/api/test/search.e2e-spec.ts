import { searchResponseSchema } from '@aiworld/shared/schemas/search-response.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

import { seedUuid } from '../prisma/seed-data';
import { MOCK_AUTH_SESSION } from './__mocks__/nestjs-better-auth';
import type { MockAuthSessionHolder } from './__mocks__/nestjs-better-auth';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/aiworld';

/**
 * Synthetic fixture worlds keep this spec's posts and members out of the
 * seeded canonical world, so parallel e2e workers that assert the exact
 * seeded feed never observe them.
 */
async function createSyntheticWorld(
  prisma: PrismaClient,
  key: string,
  options: { isActive?: boolean } = {},
): Promise<{ id: string; slug: string }> {
  const id = seedUuid(`world:${key}`);
  await prisma.world.create({
    data: {
      id,
      name: `Synthetic ${key}`,
      slug: key,
      description: { about: 'Synthetic world for search e2e fixtures.' },
      rules: [],
      topicScope: 'Testing fixtures.',
      isActive: options.isActive ?? true,
    },
  });
  return { id, slug: key };
}

/**
 * Deletes a synthetic fixture world. Vote rows reference the voting member
 * with onDelete: Restrict, so votes must be removed before the world can
 * cascade its members away.
 */
async function deleteSyntheticWorld(
  prisma: PrismaClient,
  slug: string,
): Promise<void> {
  await prisma.vote.deleteMany({
    where: { post: { world: { slug } } },
  });
  await prisma.vote.deleteMany({
    where: { comment: { post: { world: { slug } } } },
  });
  await prisma.world.deleteMany({ where: { slug } });
}

const fixture = {
  worldKey: 'search-fixture',
  otherWorldKey: 'search-fixture-b',
  postOne: {
    key: 'search-p1',
    title: 'The quillfox manifesto',
    content: 'Bamboo wisdom for the modern kitchen.',
    upvotes: 2,
    createdAt: '2026-08-06T10:00:00.000Z',
  },
  postTwo: {
    key: 'search-p2',
    title: 'Kitchen notes',
    content: 'A quillfox sat on the toaster again.',
    upvotes: 1,
    createdAt: '2026-08-06T11:00:00.000Z',
  },
  commentOne: {
    key: 'search-c1',
    content: 'Never trust a quillfox with your microwave.',
    upvotes: 2,
    createdAt: '2026-08-06T12:00:00.000Z',
  },
  commentTwo: {
    key: 'search-c2',
    content: 'Unrelated kitchen chatter.',
    upvotes: 0,
    createdAt: '2026-08-06T13:00:00.000Z',
  },
  wildcardComment: {
    key: 'search-cw',
    content: 'Waffles are 100% essential.',
    upvotes: 0,
    createdAt: '2026-08-06T14:00:00.000Z',
  },
  otherWorld: {
    postKey: 'search-b-p1',
    title: 'Another world entirely',
    content: 'The quillfox lives here too.',
    commentKey: 'search-b-c1',
    commentContent: 'Quillfox comments live in this world too.',
    createdAt: '2026-08-06T10:00:00.000Z',
  },
  characters: [
    {
      id: seedUuid('character:search-a-author'),
      handle: 'search_fixture_author',
      name: 'Search Fixture Author',
    },
    {
      id: seedUuid('character:search-a-commenter'),
      handle: 'search_fixture_commenter',
      name: 'Search Fixture Commenter',
    },
    {
      id: seedUuid('character:search-b-author'),
      handle: 'search_fixture_b_author',
      name: 'Search Fixture B Author',
    },
  ],
};

describe('World discussion search (real database)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  let fixtureWorld: { id: string; slug: string };
  let otherWorld: { id: string; slug: string };

  beforeAll(async () => {
    // Remove any residue from a previously crashed run, then rebuild.
    for (const slug of [
      fixture.worldKey,
      fixture.otherWorldKey,
      'search-inactive-world',
    ]) {
      await deleteSyntheticWorld(prisma, slug);
    }
    await prisma.character.deleteMany({
      where: { handle: { contains: 'search_fixture' } },
    });
    fixtureWorld = await createSyntheticWorld(prisma, fixture.worldKey);
    otherWorld = await createSyntheticWorld(prisma, fixture.otherWorldKey);

    for (const character of fixture.characters) {
      await prisma.character.create({
        data: {
          id: character.id,
          handle: character.handle,
          name: character.name,
          biography: 'Synthetic character for the search fixture.',
          traits: [],
          systemPrompt: 'Synthetic.',
        },
      });
    }

    const authorMemberId = seedUuid('member:search-a-author');
    const commenterMemberId = seedUuid('member:search-a-commenter');
    const otherAuthorMemberId = seedUuid('member:search-b-author');
    await prisma.worldMember.create({
      data: {
        id: authorMemberId,
        worldId: fixtureWorld.id,
        characterId: fixture.characters[0].id,
        role: 'AI',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: commenterMemberId,
        worldId: fixtureWorld.id,
        characterId: fixture.characters[1].id,
        role: 'AI',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: otherAuthorMemberId,
        worldId: otherWorld.id,
        characterId: fixture.characters[2].id,
        role: 'AI',
      },
    });

    const postOneId = seedUuid(`post:${fixture.postOne.key}`);
    const postTwoId = seedUuid(`post:${fixture.postTwo.key}`);
    await prisma.post.create({
      data: {
        id: postOneId,
        worldId: fixtureWorld.id,
        authorMemberId: authorMemberId,
        title: fixture.postOne.title,
        content: fixture.postOne.content,
        createdAt: fixture.postOne.createdAt,
        updatedAt: fixture.postOne.createdAt,
      },
    });
    await prisma.post.create({
      data: {
        id: postTwoId,
        worldId: fixtureWorld.id,
        authorMemberId: authorMemberId,
        title: fixture.postTwo.title,
        content: fixture.postTwo.content,
        createdAt: fixture.postTwo.createdAt,
        updatedAt: fixture.postTwo.createdAt,
      },
    });
    for (const comment of [
      fixture.commentOne,
      fixture.commentTwo,
      fixture.wildcardComment,
    ]) {
      await prisma.comment.create({
        data: {
          id: seedUuid(`comment:${comment.key}`),
          postId: postOneId,
          authorMemberId:
            comment.key === 'search-c1' ? commenterMemberId : authorMemberId,
          content: comment.content,
          createdAt: comment.createdAt,
          updatedAt: comment.createdAt,
        },
      });
    }

    const memberIds = [authorMemberId, commenterMemberId];
    for (let i = 0; i < fixture.postOne.upvotes; i++) {
      await prisma.vote.create({
        data: {
          id: seedUuid(`vote:${fixture.postOne.key}:${i}`),
          postId: postOneId,
          authorMemberId: memberIds[i],
          value: 1,
        },
      });
    }
    for (let i = 0; i < fixture.postTwo.upvotes; i++) {
      await prisma.vote.create({
        data: {
          id: seedUuid(`vote:${fixture.postTwo.key}:${i}`),
          postId: postTwoId,
          authorMemberId: memberIds[i],
          value: 1,
        },
      });
    }
    for (let i = 0; i < fixture.commentOne.upvotes; i++) {
      await prisma.vote.create({
        data: {
          id: seedUuid(`vote:${fixture.commentOne.key}:${i}`),
          commentId: seedUuid(`comment:${fixture.commentOne.key}`),
          authorMemberId: memberIds[i],
          value: 1,
        },
      });
    }

    await prisma.post.create({
      data: {
        id: seedUuid(`post:${fixture.otherWorld.postKey}`),
        worldId: otherWorld.id,
        authorMemberId: otherAuthorMemberId,
        title: fixture.otherWorld.title,
        content: fixture.otherWorld.content,
        createdAt: fixture.otherWorld.createdAt,
        updatedAt: fixture.otherWorld.createdAt,
      },
    });
    await prisma.comment.create({
      data: {
        id: seedUuid(`comment:${fixture.otherWorld.commentKey}`),
        postId: seedUuid(`post:${fixture.otherWorld.postKey}`),
        authorMemberId: otherAuthorMemberId,
        content: fixture.otherWorld.commentContent,
        createdAt: fixture.otherWorld.createdAt,
        updatedAt: fixture.otherWorld.createdAt,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.get(PrismaService).$disconnect();
    await app.close();
    await deleteSyntheticWorld(prisma, fixture.worldKey);
    await deleteSyntheticWorld(prisma, fixture.otherWorldKey);
    await prisma.character.deleteMany({
      where: {
        id: { in: fixture.characters.map((character) => character.id) },
      },
    });
    await prisma.$disconnect();
  });

  it('serves search results anonymously through the shared contract', async () => {
    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = null;

    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox`)
      .expect(200);

    expect(searchResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items).toHaveLength(3);
  });

  it('matches posts by title and by content', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox`)
      .expect(200);

    const postItems = res.body.items.filter(
      (item: { type: string }) => item.type === 'post',
    );
    expect(postItems).toHaveLength(2);
    const byId = new Map(
      postItems.map((item: { post: { id: string } }) => [
        item.post.id,
        item.post,
      ]),
    );
    expect(byId.get(seedUuid(`post:${fixture.postOne.key}`))).toBeDefined();
    expect(byId.get(seedUuid(`post:${fixture.postTwo.key}`))).toBeDefined();
  });

  it('matches comments by content and excludes non-matching comments', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox`)
      .expect(200);

    const commentItems = res.body.items.filter(
      (item: { type: string }) => item.type === 'comment',
    );
    expect(commentItems).toHaveLength(1);
    expect(commentItems[0].comment.id).toBe(
      seedUuid(`comment:${fixture.commentOne.key}`),
    );
    expect(commentItems[0].comment.replies).toEqual([]);
    expect(
      res.body.items.some(
        (item: { comment?: { id: string } }) =>
          item.comment?.id === seedUuid(`comment:${fixture.commentTwo.key}`),
      ),
    ).toBe(false);
  });

  it('includes aggregated vote scores on posts and comments', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox`)
      .expect(200);

    const items = res.body.items as Array<{
      type: string;
      post?: { id: string; voteScore: number };
      comment?: { id: string; voteScore: number };
    }>;

    const p1 = items.find(
      (item) =>
        item.type === 'post' &&
        item.post?.id === seedUuid(`post:${fixture.postOne.key}`),
    );
    const p2 = items.find(
      (item) =>
        item.type === 'post' &&
        item.post?.id === seedUuid(`post:${fixture.postTwo.key}`),
    );
    const c1 = items.find(
      (item) =>
        item.type === 'comment' &&
        item.comment?.id === seedUuid(`comment:${fixture.commentOne.key}`),
    );
    expect(p1?.post?.voteScore).toBe(fixture.postOne.upvotes);
    expect(p2?.post?.voteScore).toBe(fixture.postTwo.upvotes);
    expect(c1?.comment?.voteScore).toBe(fixture.commentOne.upvotes);
  });

  it('merges results deterministically by createdAt desc with id desc ties', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox`)
      .expect(200);

    // c1 (12:00), p2 (11:00), p1 (10:00).
    expect(
      res.body.items.map(
        (item: {
          type: string;
          post?: { id: string };
          comment?: { id: string };
        }) =>
          `${item.type}:${item.type === 'post' ? item.post!.id : item.comment!.id}`,
      ),
    ).toEqual([
      `comment:${seedUuid(`comment:${fixture.commentOne.key}`)}`,
      `post:${seedUuid(`post:${fixture.postTwo.key}`)}`,
      `post:${seedUuid(`post:${fixture.postOne.key}`)}`,
    ]);
  });

  it('never leaks matching content from other Worlds', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox`)
      .expect(200);

    expect(
      res.body.items.some(
        (item: { post?: { id: string }; comment?: { id: string } }) =>
          item.post?.id === seedUuid(`post:${fixture.otherWorld.postKey}`) ||
          item.comment?.id ===
            seedUuid(`comment:${fixture.otherWorld.commentKey}`),
      ),
    ).toBe(false);

    const otherWorldRes = await request(app.getHttpServer())
      .get(`/api/worlds/${otherWorld.slug}/search?q=quillfox`)
      .expect(200);

    const otherWorldIds = otherWorldRes.body.items.map(
      (item: {
        type: string;
        post?: { id: string };
        comment?: { id: string };
      }) => (item.type === 'post' ? item.post!.id : item.comment!.id),
    );
    expect(otherWorldIds.sort()).toEqual(
      [
        seedUuid(`post:${fixture.otherWorld.postKey}`),
        seedUuid(`comment:${fixture.otherWorld.commentKey}`),
      ].sort(),
    );
  });

  it('paginates the merged list with the shared pagination metadata', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox&page=1&limit=2`)
      .expect(200);

    expect(searchResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const resPageTwo = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=quillfox&page=2&limit=2`)
      .expect(200);

    expect(resPageTwo.body.items).toHaveLength(1);
    expect(resPageTwo.body.items[0].post.id).toBe(
      seedUuid(`post:${fixture.postOne.key}`),
    );
    expect(resPageTwo.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it.each([
    { label: 'absent q', query: '' },
    { label: 'empty q', query: '&q=' },
  ])(
    'returns an empty page with zero metadata for $label',
    async ({ query }) => {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/${fixtureWorld.slug}/search?${query}`)
        .expect(200);

      expect(searchResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.items).toEqual([]);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    },
  );

  it('returns an empty page with zero metadata for a one-character query', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=a`)
      .expect(200);

    expect(res.body.items).toEqual([]);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('returns an empty page with zero metadata for a query with no matches', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=zebraquark`)
      .expect(200);

    expect(searchResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items).toEqual([]);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('matches ILIKE wildcard characters literally', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/${fixtureWorld.slug}/search?q=100%25`)
      .expect(200);

    expect(searchResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].type).toBe('comment');
    expect(res.body.items[0].comment.content).toBe(
      fixture.wildcardComment.content,
    );
  });

  it('returns the 404 envelope for an inactive world', async () => {
    const inactiveWorld = await createSyntheticWorld(
      prisma,
      'search-inactive-world',
      { isActive: false },
    );

    try {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/${inactiveWorld.slug}/search?q=quillfox`)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'Not Found',
        error: 'NotFoundException',
      });
    } finally {
      await deleteSyntheticWorld(prisma, inactiveWorld.slug);
    }
  });
});

describe('World discussion search (HTTP boundary)', () => {
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

  const postRow = {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'The quillfox manifesto',
    content: 'Bamboo wisdom for the modern kitchen.',
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
    author: {
      character: {
        id: '00000000-0000-4000-8000-000000000201',
        handle: 'standard_procedure',
        name: 'Standard_Procedure',
        avatarUrl: null,
      },
    },
  };

  const commentRow = {
    id: '00000000-0000-4000-8000-000000000301',
    postId: postRow.id,
    parentCommentId: null,
    content: 'Never trust a quillfox with your microwave.',
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
    author: {
      character: {
        id: '00000000-0000-4000-8000-000000000201',
        handle: 'standard_procedure',
        name: 'Standard_Procedure',
        avatarUrl: null,
      },
    },
  };

  const prismaStub = {
    world: {
      findUnique: jest.fn(),
    },
    post: {
      findMany: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
    },
    vote: {
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
    prismaStub.post.findMany.mockResolvedValue([postRow]);
    prismaStub.comment.findMany.mockResolvedValue([commentRow]);
    prismaStub.vote.groupBy.mockResolvedValue([
      { postId: postRow.id, _sum: { value: 5 } },
      { commentId: commentRow.id, _sum: { value: 2 } },
    ]);

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

  it('serves search anonymously through the shared contract with type-tagged items', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/search?q=quillfox')
      .expect(200);

    expect(searchResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items.map((item: { type: string }) => item.type)).toEqual([
      'comment',
      'post',
    ]);
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      ['comment', 'type'].sort(),
    );
    expect(Object.keys(res.body.items[0].comment).sort()).toEqual(
      [
        'author',
        'content',
        'createdAt',
        'id',
        'replies',
        'updatedAt',
        'voteScore',
      ].sort(),
    );
    expect(res.body.items[0].comment.replies).toEqual([]);
    expect(Object.keys(res.body.items[1]).sort()).toEqual(
      ['post', 'type'].sort(),
    );
    expect(Object.keys(res.body.items[1].post).sort()).toEqual(
      [
        'author',
        'content',
        'createdAt',
        'id',
        'title',
        'updatedAt',
        'voteScore',
      ].sort(),
    );
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('queries posts World-scoped with a title/content OR match and comments through the post relation', async () => {
    await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/search?q=quillfox')
      .expect(200);

    expect(prismaStub.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          worldId,
          OR: [
            { title: { contains: 'quillfox', mode: 'insensitive' } },
            { content: { contains: 'quillfox', mode: 'insensitive' } },
          ],
        },
        select: expect.objectContaining({
          author: {
            select: expect.objectContaining({ character: expect.any(Object) }),
          },
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(prismaStub.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          content: { contains: 'quillfox', mode: 'insensitive' },
          post: { worldId },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(prismaStub.vote.groupBy).toHaveBeenCalledTimes(2);
    expect(prismaStub.vote.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['postId'],
        where: { postId: { in: [postRow.id] }, author: { isActive: true } },
      }),
    );
    expect(prismaStub.vote.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['commentId'],
        where: {
          commentId: { in: [commentRow.id] },
          author: { isActive: true },
        },
      }),
    );
  });

  it('does not query the repositories for an absent or short query', async () => {
    for (const query of ['', '?q=', '?q=a']) {
      await request(app.getHttpServer())
        .get(`/api/worlds/mbti-house/search${query}`)
        .expect(200);

      expect(prismaStub.post.findMany).not.toHaveBeenCalled();
      expect(prismaStub.comment.findMany).not.toHaveBeenCalled();
    }
  });

  it('returns 404 with the normalized envelope for an unknown world', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/missing-world/search?q=quillfox')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
    expect(prismaStub.post.findMany).not.toHaveBeenCalled();
    expect(prismaStub.comment.findMany).not.toHaveBeenCalled();
  });

  it('rejects out-of-range pagination through the error envelope', async () => {
    for (const query of ['page=0', 'limit=0', 'limit=101']) {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/mbti-house/search?q=quillfox&${query}`)
        .expect(400);

      expect(res.body.error).toBe('Validation Failed');
    }
  });
});
