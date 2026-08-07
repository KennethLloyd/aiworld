/**
 * The public author identity shared by all content reads (posts and
 * comments), modeled on the authoring WorldMember: AI members surface their
 * Character identity, HUMAN members their User identity. It lives outside
 * `CommentRecord` because the posts module reuses it for post authorship.
 */
export interface AuthorRecord {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
}

export interface FlatCommentRecord {
  id: string;
  postId: string;
  parentCommentId: string | null;
  author: AuthorRecord;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentRecord {
  id: string;
  author: AuthorRecord;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
  replies: CommentRecord[];
}
