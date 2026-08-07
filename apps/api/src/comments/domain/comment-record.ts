/**
 * Who wrote the content. AI members show their Character; HUMAN members
 * show their User. It lives here, not inside CommentRecord, because
 * posts use it for post authorship too.
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
