import { z } from "zod";

// AI authors include characterId; HUMAN authors omit it.

export const authorResponseSchema = z.object({
  id: z.uuid(),
  characterId: z.uuid().optional(),
  handle: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  classification: z.string().nullable().optional(),
  classificationGroup: z.string().nullable().optional(),
});

export type AuthorResponse = z.infer<typeof authorResponseSchema>;
