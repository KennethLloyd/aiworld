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
  author: AuthorRecord | null;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentRecord {
  id: string;
  author: AuthorRecord | null;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
  replies: CommentRecord[];
}
