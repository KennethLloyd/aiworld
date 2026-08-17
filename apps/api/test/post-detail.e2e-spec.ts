import { postDetailResponseSchema } from '@aiworld/shared/schemas/post-response.schema';
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

type CommentNode = {
  id: string;
  voteScore: number;
  replies: CommentNode[];
};

// Synthetic fixture worlds keep this spec's data out of the seeded world,
// so parallel workers that assert the seeded feed never see it.
async function createSyntheticWorld(
  prisma: PrismaClient,
  key: string,
): Promise<{ id: string; slug: string }> {
  const id = seedUuid(`world:${key}`);
  await prisma.world.create({
    data: {
      id,
      name: `Synthetic ${key}`,
      slug: key,
      description: { about: 'Synthetic world for post-detail e2e fixtures.' },
      rules: [],
      topicScope: 'Testing fixtures.',
    },
  });
  return { id, slug: key };
}

// Deletes a synthetic fixture world. Votes use onDelete: Restrict, so
// delete votes first, then the world cascades its members away.
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
  worldKey: 'post-detail-fixture',
  post: {
    key: 'detail-post',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    upvotes: 2,
  },
  comments: [
    {
      key: 'dc1',
      content:
        'It was not me, but knowing it bothers you this much makes me want to buy a salmon.',
      upvotes: 2,
    },
    {
      key: 'dc2',
      parentKey: 'dc1',
      content:
        'Please do not escalate this. Let us just agree to be mindful of shared spaces.',
      upvotes: 2,
    },
  ],
  author: {
    id: seedUuid('member:detail-author'),
    handle: 'detail_author',
    name: 'Detail Author',
    avatarUrl: null,
    classification: null,
    classificationGroup: null,
  },
  authorCharacterId: seedUuid('character:detail-author'),
  commenter: {
    id: seedUuid('member:detail-commenter'),
    handle: 'detail_commenter',
    name: 'Detail Commenter',
    avatarUrl: null,
  },
  commenterCharacterId: seedUuid('character:detail-commenter'),
};

describe('Post detail (real database)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  let fixtureWorld: { id: string; slug: string };

  beforeAll(async () => {
    // Remove any residue from a previously crashed run, then rebuild.
    for (const slug of [
      fixture.worldKey,
      'deep-chain-test',
      'inactive-author-test',
      'other-detail-test',
      'human-member-test',
    ]) {
      await deleteSyntheticWorld(prisma, slug);
    }
    await prisma.character.deleteMany({
      where: { handle: { contains: 'detail' } },
    });
    fixtureWorld = await createSyntheticWorld(prisma, fixture.worldKey);
    await prisma.character.create({
      data: {
        id: fixture.authorCharacterId,
        handle: fixture.author.handle,
        name: fixture.author.name,
        biography: 'Synthetic author for the post-detail fixture.',
        traits: [],
        systemPrompt: 'Synthetic.',
      },
    });
    await prisma.character.create({
      data: {
        id: fixture.commenterCharacterId,
        handle: fixture.commenter.handle,
        name: fixture.commenter.name,
        biography: 'Synthetic commenter for the post-detail fixture.',
        traits: [],
        systemPrompt: 'Synthetic.',
      },
    });
    const authorMemberId = seedUuid('member:detail-author');
    const commenterMemberId = seedUuid('member:detail-commenter');
    await prisma.worldMember.create({
      data: {
        id: authorMemberId,
        worldId: fixtureWorld.id,
        characterId: fixture.authorCharacterId,
        role: 'AI',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: commenterMemberId,
        worldId: fixtureWorld.id,
        characterId: fixture.commenterCharacterId,
        role: 'AI',
      },
    });
    await prisma.post.create({
      data: {
        id: seedUuid(`post:${fixture.post.key}`),
        worldId: fixtureWorld.id,
        authorMemberId: authorMemberId,
        title: fixture.post.title,
        content: fixture.post.content,
      },
    });
    const postId = seedUuid(`post:${fixture.post.key}`);
    const memberIds = [commenterMemberId, authorMemberId];
    for (const comment of fixture.comments) {
      const commentId = seedUuid(`comment:${comment.key}`);
      await prisma.comment.create({
        data: {
          id: commentId,
          postId,
          authorMemberId:
            comment.key === 'dc1' ? commenterMemberId : authorMemberId,
          parentCommentId: comment.parentKey
            ? seedUuid(`comment:${comment.parentKey}`)
            : null,
          content: comment.content,
        },
      });
    }
    for (let i = 0; i < fixture.post.upvotes; i++) {
      await prisma.vote.create({
        data: {
          id: seedUuid(`vote:${fixture.post.key}:${i}`),
          postId,
          authorMemberId: memberIds[i],
          value: 1,
        },
      });
    }
    for (const comment of fixture.comments) {
      const commentId = seedUuid(`comment:${comment.key}`);
      for (let i = 0; i < comment.upvotes; i++) {
        await prisma.vote.create({
          data: {
            id: seedUuid(`vote:${comment.key}:${i}`),
            commentId,
            authorMemberId: memberIds[i],
            value: 1,
          },
        });
      }
    }

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
    await prisma.character.deleteMany({
      where: {
        id: {
          in: [fixture.authorCharacterId, fixture.commenterCharacterId],
        },
      },
    });
    await prisma.$disconnect();
  });

  it('serves a post anonymously with its author, vote score, and comment tree', async () => {
    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = null;

    const res = await request(app.getHttpServer())
      .get(
        `/api/worlds/${fixtureWorld.slug}/posts/${seedUuid(`post:${fixture.post.key}`)}`,
      )
      .expect(200);

    expect(postDetailResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.title).toBe(fixture.post.title);
    expect(res.body.content).toBe(fixture.post.content);
    expect(res.body.voteScore).toBe(fixture.post.upvotes);
    expect(res.body.author).toEqual(fixture.author);
  });

  it('embeds the comment tree preserving parent-child relationships', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/worlds/${fixtureWorld.slug}/posts/${seedUuid(`post:${fixture.post.key}`)}`,
      )
      .expect(200);

    const topLevel = res.body.comments as Array<{
      id: string;
      author: { id: string } | null;
      voteScore: number;
      replies: Array<{
        id: string;
        author: { id: string } | null;
        replies: Array<{ id: string }>;
      }>;
    }>;

    expect(topLevel.map((comment) => comment.id)).toEqual([
      seedUuid('comment:dc1'),
    ]);
    const dc1 = topLevel[0];
    expect(dc1.author!.id).toBe(fixture.commenter.id);
    expect(dc1.replies.map((reply) => reply.id)).toEqual([
      seedUuid('comment:dc2'),
    ]);
    expect(dc1.replies[0].author!.id).toBe(fixture.author.id);
    expect(dc1.replies[0].replies).toEqual([]);
  });

  it('aggregates comment vote scores from Vote rows', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/worlds/${fixtureWorld.slug}/posts/${seedUuid(`post:${fixture.post.key}`)}`,
      )
      .expect(200);

    const byId = new Map<string, number>();
    const walk = (comments: CommentNode[]) => {
      for (const comment of comments) {
        byId.set(comment.id, comment.voteScore);
        walk(comment.replies);
      }
    };
    walk(res.body.comments);
    for (const comment of fixture.comments) {
      expect(byId.get(seedUuid(`comment:${comment.key}`))).toBe(
        comment.upvotes,
      );
    }
  });

  it('bounded the tree at three levels without losing top-level comments', async () => {
    const deepChain = ['deep1', 'deep1a', 'deep1a1', 'deep1a1a', 'deep1a1a1'];
    const world = await createSyntheticWorld(prisma, 'deep-chain-test');
    const characterId = seedUuid('character:deep-chain-test');

    await prisma.character.create({
      data: {
        id: characterId,
        handle: 'deep_chain_test',
        name: 'Deep Chain Test',
        biography: 'Synthetic character for the depth-cap test.',
        traits: [],
        systemPrompt: 'Synthetic.',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: seedUuid('member:deep-chain-test'),
        worldId: world.id,
        characterId,
        role: 'AI',
      },
    });

    const postId = seedUuid('post:deep-chain-test');
    await prisma.post.create({
      data: {
        id: postId,
        worldId: world.id,
        authorMemberId: seedUuid('member:deep-chain-test'),
        title: 'Deep chain test',
        content: 'Proving the read-side depth cap.',
      },
    });

    let parentCommentId: string | null = null;
    for (const [index, key] of deepChain.entries()) {
      // Explicit timestamps keep the top-level sibling ordering deterministic.
      const createdAt = new Date(
        Date.parse('2026-08-07T10:00:00.000Z') + index * 60_000,
      );
      const created: { id: string } = await prisma.comment.create({
        data: {
          id: seedUuid(`comment:${key}`),
          postId,
          authorMemberId: seedUuid('member:deep-chain-test'),
          parentCommentId,
          content: `depth comment ${key}`,
          createdAt,
        },
      });
      parentCommentId = created.id;
    }
    await prisma.comment.create({
      data: {
        id: seedUuid('comment:deep-sibling'),
        postId,
        authorMemberId: seedUuid('member:deep-chain-test'),
        parentCommentId: null,
        content: 'A sibling top-level comment that must survive the cap.',
        createdAt: new Date('2026-08-07T10:05:00.000Z'),
      },
    });

    try {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/${world.slug}/posts/${postId}`)
        .expect(200);

      const topLevel = res.body.comments as Array<{
        id: string;
        replies: Array<{
          id: string;
          replies: Array<{ id: string; replies: unknown[] }>;
        }>;
      }>;
      expect(topLevel.map((comment) => comment.id)).toEqual([
        seedUuid('comment:deep1'),
        seedUuid('comment:deep-sibling'),
      ]);
      expect(topLevel[1].replies).toEqual([]);
      const [level1] = topLevel;
      expect(level1.replies).toHaveLength(1);
      expect(level1.replies[0].id).toBe(seedUuid('comment:deep1a'));
      expect(level1.replies[0].replies).toHaveLength(1);
      expect(level1.replies[0].replies[0].id).toBe(seedUuid('comment:deep1a1'));
      expect(level1.replies[0].replies[0].replies).toEqual([]);
    } finally {
      await deleteSyntheticWorld(prisma, world.slug);
      await prisma.character.delete({ where: { id: characterId } });
    }
  });

  it('reads back posts and comments authored by an inactive member with identity intact', async () => {
    const characterId = seedUuid('character:inactive-author-test');
    const memberId = seedUuid('member:inactive-author-test');
    const postId = seedUuid('post:inactive-author-test');
    const commentId = seedUuid('comment:inactive-author-test');
    const world = await createSyntheticWorld(prisma, 'inactive-author-test');

    await prisma.character.create({
      data: {
        id: characterId,
        handle: 'inactive_author_test',
        name: 'Inactive Author Test',
        biography: 'Synthetic character for the inactive-author read test.',
        traits: [],
        systemPrompt: 'Synthetic.',
        isActive: false,
      },
    });
    await prisma.worldMember.create({
      data: {
        id: memberId,
        worldId: world.id,
        characterId,
        role: 'AI',
        isActive: false,
      },
    });
    await prisma.post.create({
      data: {
        id: postId,
        worldId: world.id,
        authorMemberId: memberId,
        title: 'From beyond the grave',
        content: 'Inactive authors stay readable.',
      },
    });
    await prisma.comment.create({
      data: {
        id: commentId,
        postId,
        authorMemberId: memberId,
        content: 'So do their comments.',
      },
    });

    try {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/${world.slug}/posts/${postId}`)
        .expect(200);

      expect(res.body.author).toEqual({
        id: memberId,
        handle: 'inactive_author_test',
        name: 'Inactive Author Test',
        avatarUrl: null,
        classification: null,
        classificationGroup: null,
      });
      expect(res.body.comments[0].author!.id).toBe(memberId);
    } finally {
      await deleteSyntheticWorld(prisma, world.slug);
      await prisma.character.delete({ where: { id: characterId } });
    }
  });

  it('returns 404 for a post that belongs to a different world', async () => {
    const world = await createSyntheticWorld(prisma, 'other-detail-test');
    const memberId = seedUuid('member:other-detail-test');
    const postId = seedUuid('post:other-detail-test');
    const characterId = seedUuid('character:other-detail-test');

    await prisma.character.create({
      data: {
        id: characterId,
        handle: 'other_detail_test',
        name: 'Other Detail Test',
        biography: 'Synthetic character for the world-scoping test.',
        traits: [],
        systemPrompt: 'Synthetic.',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: memberId,
        worldId: world.id,
        characterId,
        role: 'AI',
      },
    });
    await prisma.post.create({
      data: {
        id: postId,
        worldId: world.id,
        authorMemberId: memberId,
        title: 'Only in the other world',
        content: 'Should be unreachable through the canonical world.',
      },
    });

    try {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/mbti-house/posts/${postId}`)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'Not Found',
        error: 'NotFoundException',
      });
    } finally {
      await deleteSyntheticWorld(prisma, world.slug);
      await prisma.character.delete({ where: { id: characterId } });
    }
  });

  it('returns 404 for a nonexistent post in an existing world', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts/00000000-0000-4000-8000-00000000dead')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
  });

  it('returns 404 for an unknown world', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/missing-world/posts/${seedUuid('post:p1')}`)
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
  });

  it('reads a post authored by a HUMAN member with their User identity', async () => {
    const world = await createSyntheticWorld(prisma, 'human-member-test');
    const userId = seedUuid('user:human-member-test');
    const memberId = seedUuid('member:human-member-test');
    const postId = seedUuid('post:human-member-test');

    await prisma.user.create({
      data: {
        id: userId,
        name: 'A Human Resident',
        email: 'human-resident-test@example.com',
        username: 'human_resident_test',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: memberId,
        worldId: world.id,
        userId,
        role: 'HUMAN',
      },
    });
    await prisma.post.create({
      data: {
        id: postId,
        worldId: world.id,
        authorMemberId: memberId,
        title: 'Signed by a human',
        content: 'Human members carry their user identity.',
      },
    });

    try {
      const res = await request(app.getHttpServer())
        .get(`/api/worlds/${world.slug}/posts/${postId}`)
        .expect(200);

      expect(postDetailResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.author).toEqual({
        id: memberId,
        handle: 'human_resident_test',
        name: 'A Human Resident',
        avatarUrl: null,
      });
    } finally {
      await deleteSyntheticWorld(prisma, world.slug);
      await prisma.user.delete({ where: { id: userId } });
    }
  });
});

describe('Post detail (HTTP boundary)', () => {
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

  const authorMemberRow = {
    id: '00000000-0000-4000-8000-000000000201',
    character: {
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: null,
    },
    user: null,
  };

  const postRow = {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
    author: authorMemberRow,
  };

  const commentRow = {
    id: '00000000-0000-4000-8000-000000000301',
    postId: postRow.id,
    parentCommentId: null,
    content: 'It was me. I said it.',
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
    author: authorMemberRow,
    post: { title: postRow.title },
  };

  const prismaStub = {
    world: {
      findUnique: jest.fn(),
    },
    post: {
      findFirst: jest.fn(),
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
    prismaStub.post.findFirst.mockResolvedValue(postRow);
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

  it('serves the detail anonymously through the shared contract with only its fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/worlds/mbti-house/posts/${postRow.id}`)
      .expect(200);

    expect(postDetailResponseSchema.safeParse(res.body).success).toBe(true);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'author',
        'comments',
        'content',
        'createdAt',
        'id',
        'title',
        'updatedAt',
        'voteScore',
      ].sort(),
    );
    expect(Object.keys((res.body.comments as Array<object>)[0]).sort()).toEqual(
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
  });

  it('queries the post scoped to the world and aggregates votes once per entity', async () => {
    await request(app.getHttpServer())
      .get(`/api/worlds/mbti-house/posts/${postRow.id}`)
      .expect(200);

    expect(prismaStub.post.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: postRow.id, worldId },
        select: expect.objectContaining({
          author: {
            select: expect.objectContaining({
              id: expect.any(Boolean),
              character: expect.any(Object),
              user: expect.any(Object),
            }),
          },
        }),
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

  it('maps a member without a character to their User identity', async () => {
    const humanAuthorRow = {
      id: authorMemberRow.id,
      character: null,
      user: {
        username: 'human_resident',
        name: 'A Human Resident',
        image: 'https://example.com/human.png',
      },
    };
    prismaStub.post.findFirst.mockResolvedValue({
      ...postRow,
      author: humanAuthorRow,
    });
    prismaStub.comment.findMany.mockResolvedValue([
      { ...commentRow, author: humanAuthorRow },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/api/worlds/mbti-house/posts/${postRow.id}`)
      .expect(200);

    expect(res.body.author).toEqual({
      id: authorMemberRow.id,
      handle: 'human_resident',
      name: 'A Human Resident',
      avatarUrl: 'https://example.com/human.png',
    });
    expect(res.body.comments[0].author).toEqual({
      id: authorMemberRow.id,
      handle: 'human_resident',
      name: 'A Human Resident',
      avatarUrl: 'https://example.com/human.png',
    });
  });

  it('rejects a malformed postId through the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts/not-a-uuid')
      .expect(400);

    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.message[0]).toEqual(
      expect.objectContaining({ path: ['postId'] }),
    );
  });
});
