import { z } from "zod";

// Request DTOs

export const listPostsQuerySchema = z.object({
  sort: z.enum(["hot", "new"]).default("hot"),
  // .coerce is needed because query strings arrive as strings so we need to convert them
  page: z.coerce.number().pipe(z.int().min(1)).default(1),
  limit: z.coerce.number().pipe(z.int().min(1).max(100)).default(20),
});

export const postDetailParamsSchema = z.object({
  slug: z.string(),
  postId: z.uuid(),
});

// Inferred types

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type PostDetailParams = z.infer<typeof postDetailParamsSchema>;
