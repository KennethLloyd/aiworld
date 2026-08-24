import { z } from "zod";

import { commentResponseSchema } from "./comment-response.schema.ts";
import { paginationMetaSchema } from "./pagination.schema.ts";
import { postWithAuthorResponseSchema } from "./post-response.schema.ts";

// Results are tagged as posts or comments.

export const postSearchResultSchema = z.object({
  type: z.literal("post"),
  post: postWithAuthorResponseSchema,
});

export type PostSearchResult = z.infer<typeof postSearchResultSchema>;

export const commentSearchResultSchema = z.object({
  type: z.literal("comment"),
  comment: commentResponseSchema.extend({
    // Parent fields let the observer open the discussion.
    postId: z.uuid(),
    postTitle: z.string().optional(),
  }),
});

export type CommentSearchResult = z.infer<typeof commentSearchResultSchema>;

export const searchItemSchema = z.discriminatedUnion("type", [
  postSearchResultSchema,
  commentSearchResultSchema,
]);

export type SearchItem = z.infer<typeof searchItemSchema>;

export const searchResponseSchema = z.object({
  items: z.array(searchItemSchema),
  meta: paginationMetaSchema,
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;
