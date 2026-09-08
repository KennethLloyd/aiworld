import { Author, Comment } from '@/comments/domain/comment';

export interface PostItem {
  id: string;
  title: string;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostWithAuthor extends PostItem {
  author: Author;
}

export interface FeedPost extends PostWithAuthor {
  commentCount: number;
}

export interface PostDetail extends PostWithAuthor {
  comments: Comment[];
}
