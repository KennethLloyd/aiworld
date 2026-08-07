import { ActivityItemRecord } from '@/activity/domain/activity-record';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';

/**
 * Total order of the activity timeline: createdAt DESC, id DESC
 * tiebreak. Negative means `a` comes before `b`; zero means equal.
 */
export function compareActivityOrder(
  a: { createdAt: Date; id: string },
  b: { createdAt: Date; id: string },
): number {
  if (a.createdAt.getTime() !== b.createdAt.getTime()) {
    return a.createdAt.getTime() > b.createdAt.getTime() ? -1 : 1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id > b.id ? -1 : 1;
}

/**
 * Merge the two per-stream results into one createdAt DESC (id DESC)
 * timeline. Each stream arrives ordered, so this is a linear merge.
 */
export function mergeActivityItems(
  posts: PostWithAuthorRecord[],
  comments: FlatCommentRecord[],
): ActivityItemRecord[] {
  const merged: ActivityItemRecord[] = [];
  let postIndex = 0;
  let commentIndex = 0;

  while (postIndex < posts.length && commentIndex < comments.length) {
    if (compareActivityOrder(posts[postIndex], comments[commentIndex]) <= 0) {
      merged.push({ kind: 'post', record: posts[postIndex] });
      postIndex += 1;
    } else {
      merged.push({ kind: 'comment', record: comments[commentIndex] });
      commentIndex += 1;
    }
  }

  for (; postIndex < posts.length; postIndex += 1) {
    merged.push({ kind: 'post', record: posts[postIndex] });
  }
  for (; commentIndex < comments.length; commentIndex += 1) {
    merged.push({ kind: 'comment', record: comments[commentIndex] });
  }

  return merged;
}
