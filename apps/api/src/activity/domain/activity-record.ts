import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';

/**
 * One entry of the merged activity timeline. The discriminated `kind`
 * mirrors the shared transport union.
 */
export type ActivityItemRecord =
  | { kind: 'post'; record: PostWithAuthorRecord }
  | { kind: 'comment'; record: FlatCommentRecord };

export interface CharacterActivityPageRecord {
  items: ActivityItemRecord[];
  nextCursor: string | null;
}
