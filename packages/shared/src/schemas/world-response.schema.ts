import { z } from "zod";
import { paginationMetaSchema } from './pagination.schema.ts';

export { z };

export const worldResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.record(z.string(), z.string()).nullable(),
  rules: z.array(z.string()),
  topicScope: z.string(),
  residentCount: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type WorldResponse = z.infer<typeof worldResponseSchema>;

export const listWorldsResponseSchema = z.object({
  items: z.array(worldResponseSchema),
  meta: paginationMetaSchema,
});

export type ListWorldsResponse = z.infer<typeof listWorldsResponseSchema>;
