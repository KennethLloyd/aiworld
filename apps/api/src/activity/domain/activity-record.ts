import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';

export interface CharacterActivityRecord {
  posts: PostWithAuthorRecord[];
  comments: FlatCommentRecord[];
}
