import { z } from "zod";

import { paginationQueryFields } from "./pagination.schema.ts";

// Request DTOs

// q is optional: an absent or empty query is a defined safe response (an
// empty page with zero metadata), not a validation error.

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  ...paginationQueryFields,
});

// Inferred types

export type SearchQuery = z.infer<typeof searchQuerySchema>;
