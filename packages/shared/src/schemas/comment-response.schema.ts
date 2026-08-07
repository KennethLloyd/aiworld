import { z } from "zod";

import { authorResponseSchema } from "./author-response.schema.ts";

// The embedded comment tree. `replies` nests recursively; per the official
// Zod 4 docs, self-referential schemas are expressed with a getter so the
// cycle resolves lazily at runtime. The read service bounds nesting at three
// levels (MAX_COMMENT_DEPTH); the schema itself accepts any depth.
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
