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
  classification?: string | null;
  classificationGroup?: string | null;
}

/**
 * One comment row as the database returns it: flat, with `parentCommentId`
 * and no `replies`. The repository returns these; `buildCommentTree` nests
 * them into `CommentRecord`. Separate types keep the repository free of
 * tree-building and the tree builder free of the database.
 */
export interface FlatCommentRecord {
  id: string;
  postId: string;
  parentCommentId: string | null;
  author: AuthorRecord;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
  /** The title of the post the comment sits on; surfaced by activity items. */
  postTitle: string;
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
