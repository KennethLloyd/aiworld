import { z } from "zod";

// Request DTOs

export const activityQuerySchema = z.object({
  worldSlug: z.string(),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
