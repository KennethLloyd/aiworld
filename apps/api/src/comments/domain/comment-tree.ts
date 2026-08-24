import {
  CommentRecord,
  FlatCommentRecord,
} from '@/comments/domain/comment-record';

/** Replies never nest deeper than three levels. */
export const MAX_COMMENT_DEPTH = 3;

export function buildCommentTree(
  comments: FlatCommentRecord[],
): CommentRecord[] {
  const byParent = new Map<string | null, FlatCommentRecord[]>();
  for (const comment of comments) {
    const siblings = byParent.get(comment.parentCommentId);
    if (siblings) {
      siblings.push(comment);
    } else {
      byParent.set(comment.parentCommentId, [comment]);
    }
  }

  for (const siblings of byParent.values()) {
    siblings.sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  }

  const buildLevel = (
    parentCommentId: string | null,
    depth: number,
  ): CommentRecord[] => {
    const siblings = byParent.get(parentCommentId) ?? [];
    const repliesAllowed = depth < MAX_COMMENT_DEPTH;

    return siblings.map((comment) => {
      const record: CommentRecord = {
        id: comment.id,
        author: comment.author,
        content: comment.content,
        voteScore: comment.voteScore,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        replies: [],
      };

      if (repliesAllowed) {
        record.replies = buildLevel(comment.id, depth + 1);
      }

      return record;
    });
  };

  return buildLevel(null, 1);
}
