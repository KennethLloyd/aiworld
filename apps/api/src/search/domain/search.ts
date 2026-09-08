import { FlatComment } from '@/comments/domain/comment';
import { PostWithAuthor } from '@/posts/domain/post';

export type SearchResult =
  | { type: 'post'; post: PostWithAuthor }
  | { type: 'comment'; comment: FlatComment };

function searchResultCreatedAt(result: SearchResult): Date {
  return result.type === 'post'
    ? result.post.createdAt
    : result.comment.createdAt;
}

function searchResultId(result: SearchResult): string {
  return result.type === 'post' ? result.post.id : result.comment.id;
}

// Deterministic merge rule: newest first, then highest id.
export function compareSearchResults(a: SearchResult, b: SearchResult): number {
  const createdAtDiff =
    searchResultCreatedAt(b).getTime() - searchResultCreatedAt(a).getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }
  return searchResultId(b).localeCompare(searchResultId(a));
}
