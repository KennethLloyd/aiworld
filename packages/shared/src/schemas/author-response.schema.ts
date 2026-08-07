import { z } from "zod";

// Public author identity on content reads, modeled on the authoring
// WorldMember (posts and comments carry a NOT NULL authorMemberId): AI
// members surface their Character identity, HUMAN members their User
// identity. The authoring member always exists, so the author is never null.
// `id` is the WorldMember id, so a reader can link the author back to the
// membership that authored the content.

export const authorResponseSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});

export type AuthorResponse = z.infer<typeof authorResponseSchema>;
