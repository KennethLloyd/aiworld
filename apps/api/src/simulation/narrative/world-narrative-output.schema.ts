import { z } from 'zod';

export const worldNarrativeOutputSchema = z.object({
  recentEvents: z.string(),
  storyContinuation: z.string(),
  continuitySummary: z.string(),
});

export type WorldNarrativeOutput = z.infer<typeof worldNarrativeOutputSchema>;
