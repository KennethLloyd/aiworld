import { z } from "zod";

import { commentResponseSchema } from "./comment-response.schema.ts";
import { postWithAuthorResponseSchema } from "./post-response.schema.ts";

// Merged timeline: posts and comments interleave in one createdAt-desc
// stream. Keyset paginated: the page carries nextCursor (nullable), the
// client returns it from getNextPageParam, and hasNextPage derives from a
// non-null cursor (TanStack Query useInfiniteQuery contract).

export const postActivityItemSchema = postWithAuthorResponseSchema.extend({
  kind: z.literal("post"),
});

export const commentActivityItemSchema = commentResponseSchema.extend({
  kind: z.literal("comment"),
  postId: z.uuid(),
  postTitle: z.string(),
});

export const activityItemSchema = z.discriminatedUnion("kind", [
  postActivityItemSchema,
  commentActivityItemSchema,
]);

export const characterActivityResponseSchema = z.object({
  items: z.array(activityItemSchema),
  nextCursor: z.string().nullable(),
});

export type PostActivityItem = z.infer<typeof postActivityItemSchema>;
export type CommentActivityItem = z.infer<typeof commentActivityItemSchema>;
export type ActivityItem = z.infer<typeof activityItemSchema>;
export type CharacterActivityResponse = z.infer<
  typeof characterActivityResponseSchema
>;
