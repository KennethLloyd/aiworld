import { z } from "zod";

import { paginationQueryFields } from "./pagination.schema.ts";

export const postSortSchema = z.enum(["hot", "new"]);
export type PostSort = z.infer<typeof postSortSchema>;

export const listPostsQuerySchema = z.object({
  sort: postSortSchema.default("hot"),
  ...paginationQueryFields,
});

export const postDetailParamsSchema = z.object({
  slug: z.string(),
  postId: z.uuid(),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type PostDetailParams = z.infer<typeof postDetailParamsSchema>;
