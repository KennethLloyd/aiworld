import { z } from "zod";

// Author identity exposed on public content reads. A WorldMember without a
// Character (HUMAN members) resolves to a null author; the schema keeps the
// field nullable so reads stay safe instead of erroring.

export const authorResponseSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});

export type AuthorResponse = z.infer<typeof authorResponseSchema>;
