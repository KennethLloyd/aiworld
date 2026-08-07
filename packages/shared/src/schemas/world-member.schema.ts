import { z } from "zod";

const worldMemberPrincipalSchema = z
  .object({
    worldSlug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    characterId: z.uuid().optional(),
    userId: z.uuid().optional(),
  })
  .refine((value) => Boolean(value.characterId) !== Boolean(value.userId), {
    path: ["characterId"],
    message: "Exactly one of characterId or userId must be provided",
  });

export const createWorldMemberSchema = worldMemberPrincipalSchema.extend({
  isActive: z.boolean().optional(),
});

export const updateWorldMemberSchema = z.object({
  isActive: z.boolean(),
});

export const listWorldMembersQuerySchema = z.object({
  worldSlug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  characterId: z.uuid().optional(),
  userId: z.uuid().optional(),
  role: z.enum(["AI", "HUMAN"]).optional(),
  page: z.coerce.number().pipe(z.int().min(1)).default(1),
  limit: z.coerce.number().pipe(z.int().min(1).max(100)).default(20),
  isActive: z.stringbool().optional(),
});

export type CreateWorldMember = z.infer<typeof createWorldMemberSchema>;
export type UpdateWorldMember = z.infer<typeof updateWorldMemberSchema>;
export type ListWorldMembersQuery = z.infer<typeof listWorldMembersQuerySchema>;
