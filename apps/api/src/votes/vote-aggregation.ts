import { PrismaService } from '@/lib/database/prisma.service';

/**
 * Adds up Comment Vote rows into one score per comment in a single query.
 * Votes from inactive WorldMembers do not count (ADR-0002).
 */
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
