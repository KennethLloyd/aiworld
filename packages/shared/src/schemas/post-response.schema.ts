import { z } from "zod";

import { authorResponseSchema } from "./author-response.schema.ts";
import { commentResponseSchema } from "./comment-response.schema.ts";

export const postResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: z.string(),
  voteScore: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type PostResponse = z.infer<typeof postResponseSchema>;

export const postWithAuthorResponseSchema = postResponseSchema.extend({
  author: authorResponseSchema,
});

export type PostWithAuthorResponse = z.infer<
  typeof postWithAuthorResponseSchema
>;

export const feedPostResponseSchema = postWithAuthorResponseSchema.extend({
  commentCount: z.number().int().min(0),
});

export type FeedPostResponse = z.infer<typeof feedPostResponseSchema>;

export const postDetailResponseSchema = postWithAuthorResponseSchema.extend({
  comments: z.array(commentResponseSchema),
});

export type PostDetailResponse = z.infer<typeof postDetailResponseSchema>;

export const listPostsResponseSchema = z.object({
  items: z.array(feedPostResponseSchema),
  nextCursor: z.string().nullable(),
});

export type ListPostsResponse = z.infer<typeof listPostsResponseSchema>;
