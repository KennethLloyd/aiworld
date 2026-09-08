import { FlatComment } from '@/comments/domain/comment';
import { PostWithAuthor } from '@/posts/domain/post';

export type ActivityItem =
  | { kind: 'post'; record: PostWithAuthor }
  | { kind: 'comment'; record: FlatComment };

export interface CharacterActivityPage {
  items: ActivityItem[];
  nextCursor: string | null;
}
