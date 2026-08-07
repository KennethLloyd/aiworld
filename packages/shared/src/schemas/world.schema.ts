import { z } from "zod";

// Request DTOs

export const createWorldSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(1)
    .max(80),
  description: z.record(z.string(), z.string()).nullish(),
  rules: z.array(z.string()),
  topicScope: z.string().min(1).max(500),
  isActive: z.boolean().optional(),
});

export const updateWorldSchema = createWorldSchema.partial().extend({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/) // assert the slug format (e.g. this-is-my-slug)
    .min(1)
    .max(80)
    .optional(),
});

export const listWorldsQuerySchema = z.object({
  search: z.string().optional(),
  // .coerce is needed because query strings arrive as strings so we need to convert them
  page: z.coerce.number().pipe(z.int().min(1)).default(1),
  limit: z.coerce.number().pipe(z.int().min(1).max(100)).default(20),
  isActive: z.stringbool().optional(),
});

// Inferred types

export type CreateWorld = z.infer<typeof createWorldSchema>;
export type UpdateWorld = z.infer<typeof updateWorldSchema>;
export type ListWorldsQuery = z.infer<typeof listWorldsQuerySchema>;
