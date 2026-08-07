import { z } from "zod";

import { paginationMetaSchema } from "./pagination.schema.ts";

const characterFields = {
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  classification: z.string().nullable(),
  classificationGroup: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  biography: z.string(),
  traits: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

export const characterResponseSchema = z.object(characterFields);

export const adminCharacterResponseSchema = characterResponseSchema.extend({
  systemPrompt: z.string(),
});

export const listCharactersResponseSchema = z.object({
  items: z.array(characterResponseSchema),
  meta: paginationMetaSchema,
});

export const adminListCharactersResponseSchema = z.object({
  items: z.array(adminCharacterResponseSchema),
  meta: paginationMetaSchema,
});

export type CharacterResponse = z.infer<typeof characterResponseSchema>;
export type AdminCharacterResponse = z.infer<typeof adminCharacterResponseSchema>;
export type ListCharactersResponse = z.infer<typeof listCharactersResponseSchema>;
export type AdminListCharactersResponse = z.infer<typeof adminListCharactersResponseSchema>;
