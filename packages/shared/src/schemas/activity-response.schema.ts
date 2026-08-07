import { z } from "zod";

import { commentResponseSchema } from "./comment-response.schema.ts";
import { postWithAuthorResponseSchema } from "./post-response.schema.ts";

// Unpaginated: one character's own posts and comments in one World are bounded.

export const characterActivityResponseSchema = z.object({
  posts: z.array(postWithAuthorResponseSchema),
  comments: z.array(commentResponseSchema),
});

export type CharacterActivityResponse = z.infer<
  typeof characterActivityResponseSchema
>;
