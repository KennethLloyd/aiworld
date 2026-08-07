import { z } from "zod";

// Pagination contract

export const paginationMetaSchema = z.object({
  page: z.int().min(1),
  limit: z.int().min(1),
  total: z.int().min(0),
  totalPages: z.int().min(0),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export type Paginated<T> = { items: T[]; meta: PaginationMeta };

// Request-side pagination fields shared by every paginated read endpoint.
// .coerce is needed because query strings arrive as strings so we need to
// convert them.

export const paginationQueryFields = {
  page: z.coerce.number().pipe(z.int().min(1)).default(1),
  limit: z.coerce.number().pipe(z.int().min(1).max(100)).default(20),
} as const;
