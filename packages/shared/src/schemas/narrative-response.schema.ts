import { z } from 'zod';

export const narrativeResponseSchema = z.object({
  recentEvents: z.string().nullable(),
  storySoFar: z.string().nullable(),
});

export type NarrativeResponse = z.infer<typeof narrativeResponseSchema>;
