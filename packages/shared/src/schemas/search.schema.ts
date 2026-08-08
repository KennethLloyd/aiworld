import { z } from "zod";

import { paginationQueryFields } from "./pagination.schema.ts";

// Request DTOs

// q is optional. An absent or empty query returns an empty page, not an error.

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  ...paginationQueryFields,
});

// Inferred types

export type SearchQuery = z.infer<typeof searchQuerySchema>;
