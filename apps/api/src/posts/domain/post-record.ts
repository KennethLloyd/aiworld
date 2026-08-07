import { AuthorRecord, CommentRecord } from '@/comments/domain/comment-record';

export interface PostRecord {
  id: string;
  title: string;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostWithAuthorRecord extends PostRecord {
  author: AuthorRecord | null;
}

export interface PostDetailRecord extends PostWithAuthorRecord {
  comments: CommentRecord[];
}
