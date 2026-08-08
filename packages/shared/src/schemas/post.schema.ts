import { z } from "zod";

import { paginationQueryFields } from "./pagination.schema.ts";

// Request DTOs

export const listPostsQuerySchema = z.object({
  sort: z.enum(["hot", "new"]).default("hot"),
  ...paginationQueryFields,
});

export const postDetailParamsSchema = z.object({
  slug: z.string(),
  postId: z.uuid(),
});

// Inferred types

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type PostDetailParams = z.infer<typeof postDetailParamsSchema>;
