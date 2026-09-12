import { z } from 'zod';

export const narrativeOutputSchema = z.object({
  recentEvents: z.string().nullable(),
  storyContinuation: z.string().nullable(),
  continuitySummary: z.string(),
});

export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;
