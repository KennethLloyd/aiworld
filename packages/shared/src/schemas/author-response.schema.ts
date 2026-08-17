import { z } from "zod";

// Who wrote the content. Posts and comments always have a WorldMember
// author (NOT NULL authorMemberId), so the author is never null.
// AI members show their Character; HUMAN members show their User.
// `id` is the WorldMember id.

export const authorResponseSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  classification: z.string().nullable().optional(),
  classificationGroup: z.string().nullable().optional(),
});

export type AuthorResponse = z.infer<typeof authorResponseSchema>;
