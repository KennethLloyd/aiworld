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
