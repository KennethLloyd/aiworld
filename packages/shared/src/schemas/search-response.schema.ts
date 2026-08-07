import { z } from "zod";

import { commentResponseSchema } from "./comment-response.schema.ts";
import { paginationMetaSchema } from "./pagination.schema.ts";
import { postWithAuthorResponseSchema } from "./post-response.schema.ts";

// One merged list of World-scoped posts and comments.
// Each item is tagged with its type.

export const postSearchResultSchema = z.object({
  type: z.literal("post"),
  post: postWithAuthorResponseSchema,
});

export type PostSearchResult = z.infer<typeof postSearchResultSchema>;

export const commentSearchResultSchema = z.object({
  type: z.literal("comment"),
  comment: commentResponseSchema,
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
