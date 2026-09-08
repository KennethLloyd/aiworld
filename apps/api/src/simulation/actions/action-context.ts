import { CharacterView } from '@/characters/characters.service';
import { FlatComment } from '@/comments/domain/comment';
import { PostWithAuthor } from '@/posts/domain/post';
import { WorldView } from '@/world/world.service';

/** Active WorldMember and Character used by an Action. */
export type ResolvedActor = {
  world: WorldView;
  character: CharacterView;
  memberId: string;
};

export type PostActionContext = ResolvedActor & {
  recentPosts: PostWithAuthor[];
};

export type VoteActionContext = ResolvedActor & {
  post: PostWithAuthor;
  currentVote: 1 | -1 | null;
};

export type CommentActionContext = ResolvedActor & {
  post: PostWithAuthor;
  thread: FlatComment[];
};
