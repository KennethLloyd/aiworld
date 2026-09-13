import { z } from 'zod';

export const narrativeOutputSchema = z.object({
  recentEvents: z.string(),
  storyContinuation: z.string(),
  continuitySummary: z.string(),
});

export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;
