import { z } from "zod";
import { paginationMetaSchema } from "./pagination.schema.ts";

// Response contracts

export const postResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: z.string(),
  voteScore: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type PostResponse = z.infer<typeof postResponseSchema>;

export const listPostsResponseSchema = z.object({
  items: z.array(postResponseSchema),
  meta: paginationMetaSchema,
});

export type ListPostsResponse = z.infer<typeof listPostsResponseSchema>;
