import { z } from "zod";

import { authorResponseSchema } from "./author-response.schema.ts";

// `replies` is recursive; the getter resolves the cycle at runtime.
export const commentResponseSchema = z.object({
  id: z.uuid(),
  author: authorResponseSchema,
  content: z.string(),
  voteScore: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  get replies() {
    return z.array(commentResponseSchema);
  },
});

export type CommentResponse = z.infer<typeof commentResponseSchema>;
