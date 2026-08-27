import { characterActivityResponseSchema } from '@aiworld/shared/schemas/activity-response.schema';
import type { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';

import { encodeActivityCursor } from '@/activity/domain/activity-cursor';
import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

import { seedUuid } from '../prisma/seed-data';
import { MOCK_AUTH_SESSION } from './__mocks__/nestjs-better-auth';
import type { MockAuthSessionHolder } from './__mocks__/nestjs-better-auth';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/aiworld';

async function requestActivityPage(
  app: INestApplication<App>,
  url: string,
): Promise<CharacterActivityResponse> {
  const response = await request(app.getHttpServer()).get(url).expect(200);
  return characterActivityResponseSchema.parse(response.body);
}

/**
 * Fixture worlds stay out of the seeded canonical world, so tests that
 * assert the exact seeded feed never see them.
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
      description: {
        about: 'Synthetic world for character-activity e2e fixtures.',
      },
      rules: [],
      topicScope: 'Testing fixtures.',
      isActive: options.isActive ?? true,
    },
  });
  return { id, slug: key };
}

/**
 * Deletes a fixture world. Votes use onDelete: Restrict, so votes
 * must be removed before the world can cascade its members away.
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

const worldAKey = 'activity-fixture';
const worldBKey = 'activity-fixture-b';

const author = {
  id: seedUuid('character:activity-author'),
  handle: 'activity_author',
  name: 'Activity Author',
  avatarUrl: null,
};

const commenter = {
  id: seedUuid('character:activity-commenter'),
  handle: 'activity_commenter',
  name: 'Activity Commenter',
  avatarUrl: null,
};

const inactive = {
  id: seedUuid('character:activity-inactive'),
  handle: 'activity_inactive',
  name: 'Activity Inactive',
  avatarUrl: null,
};

const dormant = {
  id: seedUuid('character:activity-dormant'),
  handle: 'activity_dormant',
  name: 'Activity Dormant',
  avatarUrl: null,
};

const outsider = {
  id: seedUuid('character:activity-outsider'),
  handle: 'activity_outsider',
  name: 'Activity Outsider',
  avatarUrl: null,
};

// The response author is the authoring WorldMember, never the character:
// `id` is the member id, and the identity fields come from the member's
// Character (see prismaContentAuthorSelect and mapContentAuthor).
const authorIdentityA = {
  id: seedUuid('member:activity-author'),
  characterId: author.id,
  handle: author.handle,
  name: author.name,
  avatarUrl: null,
  classification: null,
  classificationGroup: null,
};

const inactiveIdentity = {
  id: seedUuid('member:activity-inactive'),
  characterId: inactive.id,
  handle: inactive.handle,
  name: inactive.name,
  avatarUrl: null,
  classification: null,
  classificationGroup: null,
};

const dormantIdentity = {
  id: seedUuid('member:activity-dormant'),
  characterId: dormant.id,
  handle: dormant.handle,
  name: dormant.name,
  avatarUrl: null,
  classification: null,
  classificationGroup: null,
};

const characterIds = [
  author.id,
  commenter.id,
  inactive.id,
  dormant.id,
  outsider.id,
];

// Explicit timestamps make the merged timeline deterministic: createdAt
// desc, id desc tiebreak (the fixture rows otherwise share the insert
// timestamp at millisecond resolution).
const t = (iso: string): string => iso;

const postAId = seedUuid('post:activity-post-a');
const commentAId = seedUuid('comment:activity-comment-a');
const postA2Id = seedUuid('post:activity-post-a2');
const commentA2Id = seedUuid('comment:activity-comment-a2');
const postA3Id = seedUuid('post:activity-post-a3');

describe('Character activity (real database)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const authorMemberIdA = seedUuid('member:activity-author');
  const commenterMemberIdA = seedUuid('member:activity-commenter');
  const authorMemberIdB = seedUuid('member:activity-author-b');
  const commenterMemberIdB = seedUuid('member:activity-commenter-b');

  beforeAll(async () => {
    // Remove any residue from a previously crashed run, then rebuild.
    for (const slug of [worldAKey, worldBKey, 'activity-inactive-world']) {
      await deleteSyntheticWorld(prisma, slug);
    }
    await prisma.character.deleteMany({
      where: { handle: { contains: 'activity_' } },
    });

    const worldA = await createSyntheticWorld(prisma, worldAKey);
    const worldB = await createSyntheticWorld(prisma, worldBKey);

    const characterData = [
      {
        id: author.id,
        handle: author.handle,
        name: author.name,
        biography: 'Synthetic author for the character-activity fixture.',
        isActive: true,
      },
      {
        id: commenter.id,
        handle: commenter.handle,
        name: commenter.name,
        biography: 'Synthetic commenter for the character-activity fixture.',
        isActive: true,
      },
      {
        id: inactive.id,
        handle: inactive.handle,
        name: inactive.name,
        biography: 'Synthetic inactive character for the activity fixture.',
        isActive: false,
      },
      {
        id: dormant.id,
        handle: dormant.handle,
        name: dormant.name,
        biography: 'Synthetic dormant-membership character for the fixture.',
        isActive: true,
      },
      {
        id: outsider.id,
        handle: outsider.handle,
        name: outsider.name,
        biography: 'Synthetic outsider without a membership for the fixture.',
        isActive: true,
      },
    ] as const;

    for (const character of characterData) {
      await prisma.character.create({
        data: {
          ...character,
          traits: [],
          systemPrompt: 'Synthetic.',
        },
      });
    }

    // World A members: the author (active), the commenter (active), the
    // inactive character (inactive membership), and the dormant character
    // (inactive membership). The outsider has no membership at all.
    await prisma.worldMember.create({
      data: {
        id: authorMemberIdA,
        worldId: worldA.id,
        characterId: author.id,
        role: 'AI',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: commenterMemberIdA,
        worldId: worldA.id,
        characterId: commenter.id,
        role: 'AI',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: seedUuid('member:activity-inactive'),
        worldId: worldA.id,
        characterId: inactive.id,
        role: 'AI',
        isActive: false,
      },
    });
    await prisma.worldMember.create({
      data: {
        id: seedUuid('member:activity-dormant'),
        worldId: worldA.id,
        characterId: dormant.id,
        role: 'AI',
        isActive: false,
      },
    });

    // World B members: the same author character and the commenter, so the
    // World-scoping assertions use one reusable Character in two Worlds.
    await prisma.worldMember.create({
      data: {
        id: authorMemberIdB,
        worldId: worldB.id,
        characterId: author.id,
        role: 'AI',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: commenterMemberIdB,
        worldId: worldB.id,
        characterId: commenter.id,
        role: 'AI',
      },
    });

    // World A posts: the author's own posts (three, at staggered
    // timestamps), a commenter-owned post (must not appear in the author's
    // activity), and the inactive/dormant content.
    await prisma.post.create({
      data: {
        id: postAId,
        worldId: worldA.id,
        authorMemberId: authorMemberIdA,
        title: 'The author post in world A',
        content: 'Authored by the fixture author.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:00:00.000Z'),
      },
    });
    await prisma.post.create({
      data: {
        id: seedUuid('post:activity-post-other'),
        worldId: worldA.id,
        authorMemberId: commenterMemberIdA,
        title: 'Someone else\u2019s post',
        content: 'Authored by the commenter, not the author.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:03:00.000Z'),
      },
    });
    await prisma.post.create({
      data: {
        id: postA2Id,
        worldId: worldA.id,
        authorMemberId: authorMemberIdA,
        title: 'The author\u2019s second post',
        content: 'Also authored by the fixture author.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:10:00.000Z'),
      },
    });
    await prisma.post.create({
      data: {
        id: postA3Id,
        worldId: worldA.id,
        authorMemberId: authorMemberIdA,
        title: 'The author\u2019s third post',
        content: 'The newest author post in world A.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:20:00.000Z'),
      },
    });
    await prisma.post.create({
      data: {
        id: seedUuid('post:activity-post-inactive'),
        worldId: worldA.id,
        authorMemberId: seedUuid('member:activity-inactive'),
        title: 'An inactive character\u2019s post',
        content: 'Inactive content stays readable.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:30:00.000Z'),
      },
    });
    await prisma.post.create({
      data: {
        id: seedUuid('post:activity-post-dormant'),
        worldId: worldA.id,
        authorMemberId: seedUuid('member:activity-dormant'),
        title: 'A dormant membership\u2019s post',
        content: 'Inactive memberships keep their public content.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:40:00.000Z'),
      },
    });

    // World A comments: the author's own comments (one on their post, one
    // on the commenter's post), the commenter's comment on the author's
    // post (must not appear), and the inactive/dormant content.
    await prisma.comment.create({
      data: {
        id: commentAId,
        postId: postAId,
        authorMemberId: authorMemberIdA,
        content: 'The author\u2019s comment in world A.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:05:00.000Z'),
      },
    });
    await prisma.comment.create({
      data: {
        id: commentA2Id,
        postId: seedUuid('post:activity-post-other'),
        authorMemberId: authorMemberIdA,
        content: 'The author\u2019s comment on the commenter\u2019s post.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:15:00.000Z'),
      },
    });
    await prisma.comment.create({
      data: {
        id: seedUuid('comment:activity-comment-other'),
        postId: postAId,
        authorMemberId: commenterMemberIdA,
        content: 'The commenter\u2019s comment, not the author\u2019s.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:06:00.000Z'),
      },
    });
    await prisma.comment.create({
      data: {
        id: seedUuid('comment:activity-comment-inactive'),
        postId: seedUuid('post:activity-post-inactive'),
        authorMemberId: seedUuid('member:activity-inactive'),
        content: 'An inactive character\u2019s comment.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:31:00.000Z'),
      },
    });
    await prisma.comment.create({
      data: {
        id: seedUuid('comment:activity-comment-dormant'),
        postId: seedUuid('post:activity-post-dormant'),
        authorMemberId: seedUuid('member:activity-dormant'),
        content: 'A dormant membership\u2019s comment.',
        voteScore: 2,
        createdAt: t('2026-08-06T08:41:00.000Z'),
      },
    });

    // World B posts and comments for the same author character.
    await prisma.post.create({
      data: {
        id: seedUuid('post:activity-post-b'),
        worldId: worldB.id,
        authorMemberId: authorMemberIdB,
        title: 'The author post in world B',
        content: 'Must only appear when world B is queried.',
        voteScore: 2,
        createdAt: t('2026-08-06T09:00:00.000Z'),
      },
    });
    await prisma.comment.create({
      data: {
        id: seedUuid('comment:activity-comment-b'),
        postId: seedUuid('post:activity-post-b'),
        authorMemberId: authorMemberIdB,
        content: 'The author\u2019s comment in world B.',
        voteScore: 2,
        createdAt: t('2026-08-06T09:01:00.000Z'),
      },
    });

    // Two voters per target. Every (member, target) pair is unique, so
    // no duplicate-vote row is rejected.
    const worldAVoters = [commenterMemberIdA, authorMemberIdA];
    const worldBVoters = [commenterMemberIdB, authorMemberIdB];
    const voteTargets = [
      'post:activity-post-a',
      'comment:activity-comment-a',
      'post:activity-post-other',
      'comment:activity-comment-other',
      'post:activity-post-a2',
      'comment:activity-comment-a2',
      'post:activity-post-a3',
      'post:activity-post-inactive',
      'comment:activity-comment-inactive',
      'post:activity-post-dormant',
      'comment:activity-comment-dormant',
      'post:activity-post-b',
      'comment:activity-comment-b',
    ] as const;
    let voteIndex = 0;
    for (const targetKey of voteTargets) {
      const isComment = targetKey.startsWith('comment:');
      const targetId = seedUuid(targetKey);
      const voters = targetKey.endsWith('-b') ? worldBVoters : worldAVoters;
      for (const authorMemberId of voters) {
        await prisma.vote.create({
          data: {
            id: seedUuid(`vote:activity:${voteIndex++}`),
            ...(isComment ? { commentId: targetId } : { postId: targetId }),
            authorMemberId,
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
    await deleteSyntheticWorld(prisma, worldAKey);
    await deleteSyntheticWorld(prisma, worldBKey);
    await prisma.character.deleteMany({ where: { id: { in: characterIds } } });
    await prisma.$disconnect();
  });

  // The author's merged timeline in world A, createdAt desc:
  // post-a3, comment-a2, post-a2, comment-a, post-a.
  const authorTimelineIds = [
    postA3Id,
    commentA2Id,
    postA2Id,
    commentAId,
    postAId,
  ];

  it('serves the activity anonymously with the merged timeline and vote scores', async () => {
    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = null;

    const res = await request(app.getHttpServer())
      .get(`/api/characters/${author.id}/activity?worldSlug=${worldAKey}`)
      .expect(200);

    expect(characterActivityResponseSchema.safeParse(res.body).success).toBe(
      true,
    );
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(
      authorTimelineIds,
    );
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items[0].kind).toBe('post');
    expect(res.body.items[0].voteScore).toBe(2);
    expect(res.body.items[0].author).toEqual(authorIdentityA);
    expect(res.body.items[1].kind).toBe('comment');
    expect(res.body.items[1].id).toBe(commentA2Id);
    expect(res.body.items[1].postId).toBe(seedUuid('post:activity-post-other'));
    expect(res.body.items[1].postTitle).toBe('Someone else\u2019s post');
    expect(res.body.items[1].replies).toEqual([]);
    expect(res.body.items[1].voteScore).toBe(2);
    expect(res.body.items[3].postTitle).toBe('The author post in world A');
  });

  it('excludes content authored by other characters in the same World', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${author.id}/activity?worldSlug=${worldAKey}`)
      .expect(200);

    const itemIds = res.body.items.map((item: { id: string }) => item.id);
    expect(itemIds).not.toContain(seedUuid('post:activity-post-other'));
    expect(itemIds).not.toContain(seedUuid('comment:activity-comment-other'));
  });

  it('scopes the activity to the requested World', async () => {
    const worldA = await request(app.getHttpServer())
      .get(`/api/characters/${author.id}/activity?worldSlug=${worldAKey}`)
      .expect(200);
    const worldB = await request(app.getHttpServer())
      .get(`/api/characters/${author.id}/activity?worldSlug=${worldBKey}`)
      .expect(200);

    expect(worldA.body.items.map((i: { id: string }) => i.id)).not.toContain(
      seedUuid('post:activity-post-b'),
    );
    expect(worldA.body.items.map((i: { id: string }) => i.id)).not.toContain(
      seedUuid('comment:activity-comment-b'),
    );

    expect(characterActivityResponseSchema.safeParse(worldB.body).success).toBe(
      true,
    );
    expect(worldB.body.items.map((i: { id: string }) => i.id)).toEqual([
      seedUuid('comment:activity-comment-b'),
      seedUuid('post:activity-post-b'),
    ]);
    expect(worldB.body.items[1].voteScore).toBe(2);
    expect(worldB.body.items[0].voteScore).toBe(2);
  });

  it('lists an inactive character\u2019s content with its identity intact', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${inactive.id}/activity?worldSlug=${worldAKey}`)
      .expect(200);

    expect(characterActivityResponseSchema.safeParse(res.body).success).toBe(
      true,
    );
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([
      seedUuid('comment:activity-comment-inactive'),
      seedUuid('post:activity-post-inactive'),
    ]);
    expect(res.body.items[1].voteScore).toBe(2);
    expect(res.body.items[1].author).toEqual(inactiveIdentity);
  });

  it('lists content authored through an inactive membership', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${dormant.id}/activity?worldSlug=${worldAKey}`)
      .expect(200);

    expect(characterActivityResponseSchema.safeParse(res.body).success).toBe(
      true,
    );
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([
      seedUuid('comment:activity-comment-dormant'),
      seedUuid('post:activity-post-dormant'),
    ]);
    expect(res.body.items[1].voteScore).toBe(2);
    expect(res.body.items[1].author).toEqual(dormantIdentity);
  });

  it('returns an empty page with a null cursor for a character without a membership in the World', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${outsider.id}/activity?worldSlug=${worldAKey}`)
      .expect(200);

    expect(characterActivityResponseSchema.safeParse(res.body).success).toBe(
      true,
    );
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it('returns no more than the requested limit on the first page', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/characters/${author.id}/activity?worldSlug=${worldAKey}&limit=2`,
      )
      .expect(200);

    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([
      postA3Id,
      commentA2Id,
    ]);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('walks the keyset cursor to the end, returning every item exactly once', async () => {
    let cursor: string | null = null;
    const walked: Array<{ id: string; kind: string }> = [];

    for (let page = 0; page < 10; page += 1) {
      const url: string =
        cursor === null
          ? `/api/characters/${author.id}/activity?worldSlug=${worldAKey}&limit=2`
          : `/api/characters/${author.id}/activity?worldSlug=${worldAKey}&limit=2&cursor=${encodeURIComponent(cursor)}`;
      const res = await requestActivityPage(app, url);

      expect(res.items.length).toBeLessThanOrEqual(2);
      walked.push(...res.items);
      cursor = res.nextCursor;
      if (cursor === null) {
        break;
      }
    }

    expect(cursor).toBeNull();
    expect(walked.map((item) => item.id)).toEqual(authorTimelineIds);
    expect(new Set(walked.map((item) => item.id)).size).toBe(
      authorTimelineIds.length,
    );
  });

  it('walks a limit-1 cursor to the end with a null nextCursor on the final page', async () => {
    let cursor: string | null = null;
    const walked: Array<{ id: string }> = [];

    for (let page = 0; page < 10; page += 1) {
      const suffix: string =
        cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
      const res = await requestActivityPage(
        app,
        `/api/characters/${author.id}/activity?worldSlug=${worldAKey}&limit=1${suffix}`,
      );

      walked.push(...res.items);
      cursor = res.nextCursor;
      if (cursor === null) {
        break;
      }
    }

    expect(walked.map((item: { id: string }) => item.id)).toEqual(
      authorTimelineIds,
    );
    expect(cursor).toBeNull();
  });

  it('rejects a malformed cursor through the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/characters/${author.id}/activity?worldSlug=${worldAKey}&cursor=not-a-cursor`,
      )
      .expect(400);

    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.message[0]).toEqual(
      expect.objectContaining({ path: ['cursor'] }),
    );
  });

  it('rejects an out-of-range limit through the error envelope', async () => {
    for (const limit of ['0', '51']) {
      const res = await request(app.getHttpServer())
        .get(
          `/api/characters/${author.id}/activity?worldSlug=${worldAKey}&limit=${limit}`,
        )
        .expect(400);

      expect(res.body.error).toBe('Validation Failed');
      expect(res.body.message[0]).toEqual(
        expect.objectContaining({ path: ['limit'] }),
      );
    }
  });

  it('returns the 404 envelope for a missing character', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/api/characters/00000000-0000-4000-8000-00000000dead/activity?worldSlug=activity-fixture',
      )
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
  });

  it('returns the 404 envelope for a missing world', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${author.id}/activity?worldSlug=missing-world`)
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
  });

  it('returns the 404 envelope for an inactive world', async () => {
    const inactiveWorld = await createSyntheticWorld(
      prisma,
      'activity-inactive-world',
      { isActive: false },
    );

    try {
      const res = await request(app.getHttpServer())
        .get(
          `/api/characters/${author.id}/activity?worldSlug=${inactiveWorld.slug}`,
        )
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

  it('rejects a malformed characterId through the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/characters/not-a-uuid/activity?worldSlug=activity-fixture')
      .expect(400);

    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.message[0]).toEqual(
      expect.objectContaining({ path: ['characterId'] }),
    );
  });

  it('rejects a missing worldSlug query through the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${author.id}/activity`)
      .expect(400);

    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.message[0]).toEqual(
      expect.objectContaining({ path: ['worldSlug'] }),
    );
  });
});

describe('Character activity (HTTP boundary)', () => {
  let app: INestApplication<App>;

  const worldId = '00000000-0000-4000-8000-000000000001';
  const memberId = '00000000-0000-4000-8000-000000000011';
  const characterId = '00000000-0000-4000-8000-000000000101';
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
  const characterRecord = {
    id: characterId,
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    classification: null,
    classificationGroup: null,
    avatarUrl: null,
    biography: 'A fixture character.',
    traits: [],
    systemPrompt: 'Synthetic.',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const postRow = {
    id: '00000000-0000-4000-8000-000000000201',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
    author: {
      id: memberId,
      character: {
        handle: 'standard_procedure',
        name: 'Standard_Procedure',
        avatarUrl: null,
      },
      user: null,
    },
  };

  const commentRow = {
    id: '00000000-0000-4000-8000-000000000301',
    postId: postRow.id,
    parentCommentId: null,
    content: 'It was me. I said it.',
    voteScore: 2,
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
    author: {
      id: memberId,
      character: {
        handle: 'standard_procedure',
        name: 'Standard_Procedure',
        avatarUrl: null,
      },
      user: null,
    },
    post: { title: postRow.title },
  };

  const prismaStub = {
    world: {
      findUnique: jest.fn(),
    },
    character: {
      findUnique: jest.fn(),
    },
    worldMember: {
      findFirst: jest.fn(),
    },
    post: {
      findMany: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
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
    prismaStub.character.findUnique.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve(args.where.id === characterId ? characterRecord : null),
    );
    prismaStub.worldMember.findFirst.mockResolvedValue({ id: memberId });
    prismaStub.post.findMany.mockResolvedValue([postRow]);
    prismaStub.comment.findMany.mockResolvedValue([commentRow]);

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

  it('serves the activity anonymously through the shared contract with only its fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${characterId}/activity?worldSlug=mbti-house`)
      .expect(200);

    expect(characterActivityResponseSchema.safeParse(res.body).success).toBe(
      true,
    );
    expect(Object.keys(res.body).sort()).toEqual(['items', 'nextCursor']);
    expect(res.body.nextCursor).toBeNull();
    const postItem = res.body.items.find(
      (item: { kind: string }) => item.kind === 'post',
    );
    const commentItem = res.body.items.find(
      (item: { kind: string }) => item.kind === 'comment',
    );
    expect(Object.keys(postItem).sort()).toEqual(
      [
        'author',
        'content',
        'createdAt',
        'id',
        'kind',
        'title',
        'updatedAt',
        'voteScore',
      ].sort(),
    );
    expect(Object.keys(commentItem).sort()).toEqual(
      [
        'author',
        'content',
        'createdAt',
        'id',
        'kind',
        'postId',
        'postTitle',
        'replies',
        'updatedAt',
        'voteScore',
      ].sort(),
    );
    expect(postItem.voteScore).toBe(5);
    expect(commentItem.voteScore).toBe(2);
    expect(commentItem.postTitle).toBe(postRow.title);
    expect(commentItem.postId).toBe(postRow.id);
  });

  it('queries stored scores in both activity streams without Vote aggregation', async () => {
    await request(app.getHttpServer())
      .get(`/api/characters/${characterId}/activity?worldSlug=mbti-house`)
      .expect(200);

    expect(prismaStub.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { worldId, authorMemberId: memberId },
        select: expect.objectContaining({
          voteScore: true,
          author: {
            select: expect.objectContaining({ character: expect.any(Object) }),
          },
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
      }),
    );
    expect(prismaStub.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorMemberId: memberId, post: { worldId } },
        select: expect.objectContaining({
          voteScore: true,
          post: { select: { title: true } },
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
      }),
    );
  });

  it('passes the decoded keyset cursor into both repository queries', async () => {
    const cursor = encodeActivityCursor({
      kind: 'post',
      record: {
        id: postRow.id,
        title: postRow.title,
        content: postRow.content,
        voteScore: 5,
        createdAt: postRow.createdAt,
        updatedAt: postRow.updatedAt,
        author: {
          id: memberId,
          handle: 'standard_procedure',
          name: 'Standard_Procedure',
          avatarUrl: null,
        },
      },
    });

    await request(app.getHttpServer())
      .get(
        `/api/characters/${characterId}/activity?worldSlug=mbti-house&cursor=${encodeURIComponent(cursor)}`,
      )
      .expect(200);

    expect(prismaStub.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          worldId,
          authorMemberId: memberId,
          OR: [
            { createdAt: { lt: postRow.createdAt } },
            { createdAt: postRow.createdAt, id: { lt: postRow.id } },
          ],
        },
      }),
    );
    expect(prismaStub.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          authorMemberId: memberId,
          post: { worldId },
          OR: [
            { createdAt: { lt: postRow.createdAt } },
            { createdAt: postRow.createdAt, id: { lt: postRow.id } },
          ],
        },
      }),
    );
  });

  it('returns an empty page without querying content when the membership is missing', async () => {
    prismaStub.worldMember.findFirst.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .get(`/api/characters/${characterId}/activity?worldSlug=mbti-house`)
      .expect(200);

    expect(res.body).toEqual({ items: [], nextCursor: null });
    expect(prismaStub.post.findMany).not.toHaveBeenCalled();
    expect(prismaStub.comment.findMany).not.toHaveBeenCalled();
  });

  it('rejects a malformed cursor through the error envelope without querying content', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/characters/${characterId}/activity?worldSlug=mbti-house&cursor=not-a-cursor`,
      )
      .expect(400);

    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.message[0]).toEqual(
      expect.objectContaining({ path: ['cursor'] }),
    );
    expect(prismaStub.post.findMany).not.toHaveBeenCalled();
    expect(prismaStub.comment.findMany).not.toHaveBeenCalled();
  });

  it('returns the 404 envelope for a missing character', async () => {
    prismaStub.character.findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .get(
        '/api/characters/00000000-0000-4000-8000-00000000dead/activity?worldSlug=mbti-house',
      )
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
    expect(prismaStub.worldMember.findFirst).not.toHaveBeenCalled();
  });

  it('returns the 404 envelope for a missing world', async () => {
    prismaStub.world.findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .get(`/api/characters/${characterId}/activity?worldSlug=missing-world`)
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });
    expect(prismaStub.character.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a request without the worldSlug query param through the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/characters/${characterId}/activity`)
      .expect(400);

    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.message[0]).toEqual(
      expect.objectContaining({ path: ['worldSlug'] }),
    );
  });
});
