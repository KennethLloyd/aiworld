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

  it('serves the hot feed anonymously with stored vote scores', async () => {
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
        handle: authorCharacter!.handle,
        name: authorCharacter!.name,
        avatarUrl: authorCharacter!.avatarUrl,
        classification: authorCharacter!.classification,
        classificationGroup: authorCharacter!.classificationGroup,
      });
    }
    expect(res.body.nextCursor).toBeNull();
  });

  it('serves the new feed ordered by createdAt with stored vote scores', async () => {
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

  it('paginates the hot feed with an opaque cursor', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot&limit=2')
      .expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).toEqual(expect.any(String));

    const resPageTwo = await request(app.getHttpServer())
      .get(
        `/api/worlds/mbti-house/posts?sort=hot&limit=2&cursor=${encodeURIComponent(res.body.nextCursor)}`,
      )
      .expect(200);

    expect(resPageTwo.body.items).toHaveLength(2);
    expect(resPageTwo.body.items[0].id).toBe(seededPostId('p2'));
    expect(resPageTwo.body.items[1].id).toBe(seededPostId('p3'));
    expect(resPageTwo.body.nextCursor).toEqual(expect.any(String));
  });
  it('keeps Hot cursor boundaries for equal scores and timestamps', async () => {
    const equalCreatedAt = new Date('2026-09-01T00:00:00.000Z');
    const equalScorePostIds = [
      seededPostId('hot-equal-a'),
      seededPostId('hot-equal-b'),
      seededPostId('hot-equal-c'),
    ].sort();
    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: canonicalWorld.slug },
      select: { id: true },
    });
    await prisma.post.createMany({
      data: equalScorePostIds.map((id, index) => ({
        id,
        worldId: world.id,
        authorMemberId: seedUuid('member:footnote'),
        title: `Equal hot post ${index}`,
        content: 'Cursor boundary fixture.',
        voteScore: 100,
        createdAt: equalCreatedAt,
      })),
    });

    try {
      const firstPage = await request(app.getHttpServer())
        .get('/api/worlds/mbti-house/posts?sort=hot&limit=2')
        .expect(200);
      expect(
        firstPage.body.items.map((post: { id: string }) => post.id),
      ).toEqual(equalScorePostIds.slice(0, 2));

      const secondPage = await request(app.getHttpServer())
        .get(
          `/api/worlds/mbti-house/posts?sort=hot&limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`,
        )
        .expect(200);
      expect(secondPage.body.items[0].id).toBe(equalScorePostIds[2]);
      expect(secondPage.body.items).not.toContainEqual(
        expect.objectContaining({ id: equalScorePostIds[0] }),
      );
      expect(secondPage.body.items).not.toContainEqual(
        expect.objectContaining({ id: equalScorePostIds[1] }),
      );
    } finally {
      await prisma.post.deleteMany({
        where: { id: { in: equalScorePostIds } },
      });
    }
  });

  it('ends with a null cursor after the final page', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/posts?sort=hot&limit=8')
      .expect(200);

    expect(listPostsResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items).toHaveLength(8);
    expect(res.body.nextCursor).toBeNull();
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

  it('uses the Hot feed index for a bounded page at meaningful scale', async () => {
    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: canonicalWorld.slug },
      select: { id: true },
    });
    const benchmarkPostIds = Array.from({ length: 10_000 }, (_, index) =>
      seedUuid(`post:hot-index-benchmark-${index}`),
    );

    await prisma.post.deleteMany({
      where: { id: { in: benchmarkPostIds } },
    });
    await prisma.post.createMany({
      data: benchmarkPostIds.map((id, index) => ({
        id,
        worldId: world.id,
        authorMemberId: seedUuid('member:footnote'),
        title: `Hot index benchmark ${index}`,
        content: 'Hot index benchmark fixture.',
        voteScore: index % 100,
        createdAt: new Date(2020, 0, 1, 0, 0, index),
      })),
    });

    try {
      await prisma.$executeRaw`ANALYZE "post"`;
      const plan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>`
        EXPLAIN (ANALYZE, FORMAT JSON, COSTS OFF)
        SELECT "id", "voteScore", "createdAt"
        FROM "post"
        WHERE "worldId" = ${world.id}
        ORDER BY "voteScore" DESC, "createdAt" DESC, "id" ASC
        LIMIT 11
      `;

      const queryPlan = JSON.stringify(plan);
      expect(queryPlan).toContain('post_worldId_voteScore_createdAt_id_idx');
      expect(queryPlan).toContain('Index Only Scan');
    } finally {
      await prisma.post.deleteMany({
        where: { id: { in: benchmarkPostIds } },
      });
    }
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
