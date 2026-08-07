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

/**
 * One comment row as the database returns it: flat, with its
 * `parentCommentId` and no `replies`. The repository returns these and
 * `buildCommentTree` joins them into `CommentRecord` (the nested tree
 * with `replies`). The two stay apart so the repository never builds
 * trees and the tree builder never talks to the database.
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
