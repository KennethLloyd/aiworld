import { z } from "zod";

export const activityParamsSchema = z.object({
  characterId: z.uuid(),
});

export const activityQuerySchema = z.object({
  worldSlug: z.string(),
  // Query strings are coerced to numbers.
  limit: z.coerce.number().pipe(z.int().min(1).max(50)).default(20),
  // Opaque keyset cursor; absent on the first page.
  cursor: z.string().optional(),
});

export type ActivityParams = z.infer<typeof activityParamsSchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
