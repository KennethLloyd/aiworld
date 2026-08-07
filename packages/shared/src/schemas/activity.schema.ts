import { z } from "zod";

// Request DTOs

export const activityParamsSchema = z.object({
  characterId: z.uuid(),
});

export const activityQuerySchema = z.object({
  worldSlug: z.string(),
});

export type ActivityParams = z.infer<typeof activityParamsSchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
