import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

import {
  canonicalWorld,
  flattenComments,
  posts,
  seededCommentIds,
  seededPostIds,
  seedUuid,
} from '../prisma/seed-data';
import { seedWorld } from '../prisma/seed-world';

describe('seeded vote rows', () => {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/aiworld';
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const targetFilter = {
    OR: [
      { postId: { in: seededPostIds() } },
      { commentId: { in: seededCommentIds() } },
    ],
  };

  const expectedTotals = [
    ...posts.map((post) => ({
      targetId: seedUuid(`post:${post.key}`),
      total: post.upvotes,
    })),
    ...posts.flatMap((post) =>
      flattenComments(post.comments).map((comment) => ({
        targetId: seedUuid(`comment:${comment.key}`),
        total: comment.upvotes,
      })),
    ),
  ];

  beforeAll(async () => {
    await seedWorld(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('aggregates to exactly the seeded totals per post and comment', async () => {
    const votes = await prisma.vote.findMany({
      where: targetFilter,
      select: { postId: true, commentId: true, value: true },
    });

    const byTarget = new Map<string, number>();
    for (const vote of votes) {
      const targetId = vote.postId ?? vote.commentId;
      if (targetId) {
        byTarget.set(targetId, (byTarget.get(targetId) ?? 0) + vote.value);
      }
    }

    for (const target of expectedTotals) {
      expect(byTarget.get(target.targetId)).toBe(target.total);
    }
    expect(byTarget.size).toBe(expectedTotals.length);
  });
  it('stores the active vote total on every seeded Post and Comment', async () => {
    const storedPosts = await prisma.post.findMany({
      where: { id: { in: seededPostIds() } },
      select: { id: true, voteScore: true },
    });
    const scoreByPostId = new Map(
      storedPosts.map((post) => [post.id, post.voteScore]),
    );
    const storedComments = await prisma.comment.findMany({
      where: { id: { in: seededCommentIds() } },
      select: { id: true, voteScore: true },
    });
    const scoreByCommentId = new Map(
      storedComments.map((comment) => [comment.id, comment.voteScore]),
    );
    for (const post of posts) {
      expect(scoreByPostId.get(seedUuid(`post:${post.key}`))).toBe(
        post.upvotes,
      );
      for (const comment of flattenComments(post.comments)) {
        expect(scoreByCommentId.get(seedUuid(`comment:${comment.key}`))).toBe(
          comment.upvotes,
        );
      }
    }
  });
  it('backfills Post and Comment.voteScore from active-member votes', async () => {
    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: canonicalWorld.slug },
      select: { id: true },
    });
    const postId = seedUuid('post:migration-backfill-fixture');
    const commentId = seedUuid('comment:migration-backfill-fixture');
    const inactiveCharacterId = seedUuid(
      'character:migration-backfill-inactive',
    );
    const inactiveMemberId = seedUuid('member:migration-backfill-inactive');

    await prisma.character.create({
      data: {
        id: inactiveCharacterId,
        handle: 'migration_backfill_inactive',
        name: 'Migration Backfill Inactive',
        biography: 'Migration backfill fixture.',
        traits: [],
        systemPrompt: 'Migration backfill fixture.',
        isActive: false,
      },
    });
    await prisma.worldMember.create({
      data: {
        id: inactiveMemberId,
        worldId: world.id,
        characterId: inactiveCharacterId,
        role: 'AI',
        isActive: false,
      },
    });
    await prisma.post.create({
      data: {
        id: postId,
        worldId: world.id,
        authorMemberId: seedUuid('member:footnote'),
        title: 'Migration backfill fixture',
        content: 'Migration backfill fixture.',
      },
    });
    await prisma.comment.create({
      data: {
        id: commentId,
        postId,
        authorMemberId: seedUuid('member:footnote'),
        content: 'Migration backfill fixture.',
      },
    });
    await prisma.vote.createMany({
      data: [
        {
          postId,
          authorMemberId: seedUuid('member:footnote'),
          value: 1,
        },
        {
          commentId,
          authorMemberId: seedUuid('member:footnote'),
          value: 1,
        },
        {
          postId,
          authorMemberId: inactiveMemberId,
          value: -1,
        },
        {
          commentId,
          authorMemberId: inactiveMemberId,
          value: -1,
        },
      ],
    });

    try {
      await prisma.$executeRaw`
        UPDATE "post" p
        SET "voteScore" = COALESCE(
          (
            SELECT SUM(v."value")
            FROM "vote" v
            INNER JOIN "world_member" wm ON wm."id" = v."authorMemberId"
            WHERE v."postId" = p."id"
              AND wm."isActive" = true
          ),
          0
        )
        WHERE p."id" = ${postId}
      `;
      await prisma.$executeRaw`
        UPDATE "comment" c
        SET "voteScore" = COALESCE(
          (
            SELECT SUM(v."value")
            FROM "vote" v
            INNER JOIN "world_member" wm ON wm."id" = v."authorMemberId"
            WHERE v."commentId" = c."id"
              AND wm."isActive" = true
          ),
          0
        )
        WHERE c."id" = ${commentId}
      `;

      const storedPost = await prisma.post.findUniqueOrThrow({
        where: { id: postId },
        select: { voteScore: true },
      });
      const storedComment = await prisma.comment.findUniqueOrThrow({
        where: { id: commentId },
        select: { voteScore: true },
      });
      expect(storedPost.voteScore).toBe(1);
      expect(storedComment.voteScore).toBe(1);
    } finally {
      await prisma.post.delete({ where: { id: postId } });
      await prisma.worldMember.delete({ where: { id: inactiveMemberId } });
      await prisma.character.delete({ where: { id: inactiveCharacterId } });
    }
  });

  it('casts every seeded vote by an active AI member of the canonical world', async () => {
    const world = await prisma.world.findUnique({
      where: { slug: canonicalWorld.slug },
    });
    const votes = await prisma.vote.findMany({
      where: targetFilter,
      include: { author: true },
    });
    expect(votes.length).toBeGreaterThan(0);

    for (const vote of votes) {
      expect(vote.author.worldId).toBe(world?.id);
      expect(vote.author.role).toBe('AI');
      expect(vote.author.isActive).toBe(true);
    }
  });

  it('remains idempotent when the seed runs again', async () => {
    const votesBefore = await prisma.vote.count({ where: targetFilter });

    await seedWorld(prisma);

    const votesAfter = await prisma.vote.count({ where: targetFilter });
    expect(votesAfter).toBe(votesBefore);

    const aggregateAfter = await prisma.vote.aggregate({
      where: targetFilter,
      _sum: { value: true },
    });
    expect(aggregateAfter._sum.value).toBe(
      expectedTotals.reduce((sum, target) => sum + target.total, 0),
    );
  });
});
