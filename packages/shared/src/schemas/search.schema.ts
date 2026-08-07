import { z } from "zod";

// Request DTOs

// q is optional: an absent or empty query is a defined safe response (an
// empty page with zero metadata), not a validation error.

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  // .coerce is needed because query strings arrive as strings so we need to convert them
  page: z.coerce.number().pipe(z.int().min(1)).default(1),
  limit: z.coerce.number().pipe(z.int().min(1).max(100)).default(20),
});

// Inferred types

export type SearchQuery = z.infer<typeof searchQuerySchema>;
