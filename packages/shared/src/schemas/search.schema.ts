import { z } from "zod";

import { paginationQueryFields } from "./pagination.schema.ts";

// Empty queries return an empty page.

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  ...paginationQueryFields,
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
