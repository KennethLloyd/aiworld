import { z } from "zod";

import { booleanQuerySchema } from "./query.schema.ts";

const optionalClassificationFields = {
  classification: z.string().trim().min(1).max(50).nullish(),
  classificationGroup: z.string().trim().min(1).max(50).nullish(),
};

const characterFields = {
  handle: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_]+$/),
  name: z.string().trim().min(1).max(200),
  ...optionalClassificationFields,
  avatarUrl: z.string().trim().min(1).max(2048).nullish(),
  biography: z.string().max(10_000),
  traits: z.array(z.string().trim().min(1).max(100)).max(50),
  systemPrompt: z.string().min(1).max(50_000),
  isActive: z.boolean().optional(),
};

function requireClassificationPair<
  T extends { classification?: string | null; classificationGroup?: string | null },
>(value: T, context: z.RefinementCtx): void {
  const hasClassification = value.classification != null;
  const hasClassificationGroup = value.classificationGroup != null;

  if (hasClassification !== hasClassificationGroup) {
    context.addIssue({
      code: "custom",
      path: [hasClassification ? "classificationGroup" : "classification"],
      message: "classification and classificationGroup must be provided together",
    });
  }
}

export const createCharacterSchema = z
  .object({
    ...characterFields,
    worldSlug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
  })
  .superRefine(requireClassificationPair);

export const updateCharacterSchema = z
  .object({
    ...characterFields,
  })
  .partial()
  .superRefine(requireClassificationPair);

export const listCharactersQuerySchema = z.object({
  worldSlug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  search: z.string().optional(),
  classification: z.string().trim().min(1).max(50).optional(),
  classificationGroup: z.string().trim().min(1).max(50).optional(),
  page: z.coerce.number().pipe(z.int().min(1)).default(1),
  limit: z.coerce.number().pipe(z.int().min(1).max(100)).default(20),
  isActive: booleanQuerySchema.optional(),
});

export type CreateCharacter = z.infer<typeof createCharacterSchema>;
export type UpdateCharacter = z.infer<typeof updateCharacterSchema>;
export type ListCharactersQuery = z.infer<typeof listCharactersQuerySchema>;
