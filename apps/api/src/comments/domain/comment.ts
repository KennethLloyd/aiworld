export interface Author {
  id: string;
  characterId?: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  classification?: string | null;
  classificationGroup?: string | null;
}

export interface FlatComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  author: Author;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
  postTitle: string;
}

export interface Comment {
  id: string;
  author: Author;
  content: string;
  voteScore: number;
  createdAt: Date;
  updatedAt: Date;
  replies: Comment[];
}
