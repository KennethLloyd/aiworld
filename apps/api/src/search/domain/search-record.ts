import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';

export type SearchResultRecord =
  | { type: 'post'; post: PostWithAuthorRecord }
  | { type: 'comment'; comment: FlatCommentRecord };

function searchResultCreatedAt(record: SearchResultRecord): Date {
  return record.type === 'post'
    ? record.post.createdAt
    : record.comment.createdAt;
}

function searchResultId(record: SearchResultRecord): string {
  return record.type === 'post' ? record.post.id : record.comment.id;
}

/**
 * Deterministic merge rule for the search result list: newest first, then
 * highest id. Both posts and comments carry createdAt and id, so the merged
 * list is stable across reads for fixed data.
 */
export function compareSearchResults(
  a: SearchResultRecord,
  b: SearchResultRecord,
): number {
  const createdAtDiff =
    searchResultCreatedAt(b).getTime() - searchResultCreatedAt(a).getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }
  return searchResultId(b).localeCompare(searchResultId(a));
}
