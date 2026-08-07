import { z } from "zod";

import { commentResponseSchema } from "./comment-response.schema.ts";
import { postWithAuthorResponseSchema } from "./post-response.schema.ts";

// A character's activity in one World is unpaginated: a single character's
// own posts and comments in one World are bounded, so the response carries
// both lists in full.

export const characterActivityResponseSchema = z.object({
  posts: z.array(postWithAuthorResponseSchema),
  comments: z.array(commentResponseSchema),
});

export type CharacterActivityResponse = z.infer<
  typeof characterActivityResponseSchema
>;
