import { CharacterRecord } from '@/characters/domain/character-record';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { WorldRecord } from '@/world/domain/world-record';

/** Active WorldMember and Character used by an Action. */
export type ResolvedActor = {
  world: WorldRecord;
  character: CharacterRecord;
  memberId: string;
};

export type PostActionContext = ResolvedActor & {
  recentPosts: PostWithAuthorRecord[];
};

export type VoteActionContext = ResolvedActor & {
  post: PostWithAuthorRecord;
  currentVote: 1 | -1 | null;
};

export type CommentActionContext = ResolvedActor & {
  post: PostWithAuthorRecord;
  thread: FlatCommentRecord[];
};
