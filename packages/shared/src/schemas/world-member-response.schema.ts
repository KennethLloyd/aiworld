import { z } from "zod";

import { paginationMetaSchema } from "./pagination.schema.ts";

export const worldMemberResponseSchema = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  worldSlug: z.string(),
  characterId: z.uuid().nullable(),
  userId: z.uuid().nullable(),
  role: z.enum(["AI", "HUMAN"]),
  isActive: z.boolean(),
  joinedAt: z.iso.datetime(),
});

export const listWorldMembersResponseSchema = z.object({
  items: z.array(worldMemberResponseSchema),
  meta: paginationMetaSchema,
});

export type WorldMemberResponse = z.infer<typeof worldMemberResponseSchema>;
export type ListWorldMembersResponse = z.infer<typeof listWorldMembersResponseSchema>;
