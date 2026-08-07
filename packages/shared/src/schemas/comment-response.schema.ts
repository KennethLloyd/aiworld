import { z } from "zod";

import type { AuthorResponse } from "./author-response.schema.ts";
import { authorResponseSchema } from "./author-response.schema.ts";

// The embedded comment tree. `replies` nests recursively and is bounded at
// three levels by the read service (MAX_COMMENT_DEPTH); the schema itself
// allows any nesting depth.

export type CommentResponse = {
  id: string;
  author: AuthorResponse | null;
  content: string;
  voteScore: number;
  createdAt: string;
  updatedAt: string;
  replies: CommentResponse[];
};

export const commentResponseSchema: z.ZodType<CommentResponse> = z.lazy(() =>
  z.object({
    id: z.uuid(),
    author: authorResponseSchema.nullable(),
    content: z.string(),
    voteScore: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    replies: z.array(commentResponseSchema),
  }),
);
