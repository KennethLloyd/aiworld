import { PrismaService } from '@/lib/database/prisma.service';

/**
 * Aggregates Vote rows into per-post scores in one grouped query. Only votes
 * from active WorldMembers count (ADR-0002: rows are the only source of
 * truth, and a deactivated member no longer participates).
 */
export async function aggregatePostVoteScores(
  prisma: PrismaService,
  postIds: string[],
): Promise<Map<string, number>> {
  if (postIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.vote.groupBy({
    by: ['postId'],
    where: { postId: { in: postIds }, author: { isActive: true } },
    _sum: { value: true },
  });

  const scores = new Map<string, number>();
  for (const row of rows) {
    if (row.postId) {
      scores.set(row.postId, row._sum.value ?? 0);
    }
  }
  return scores;
}

export async function aggregateCommentVoteScores(
  prisma: PrismaService,
  commentIds: string[],
): Promise<Map<string, number>> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.vote.groupBy({
    by: ['commentId'],
    where: { commentId: { in: commentIds }, author: { isActive: true } },
    _sum: { value: true },
  });

  const scores = new Map<string, number>();
  for (const row of rows) {
    if (row.commentId) {
      scores.set(row.commentId, row._sum.value ?? 0);
    }
  }
  return scores;
}
