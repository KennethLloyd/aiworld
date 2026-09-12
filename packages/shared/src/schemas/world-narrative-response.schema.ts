import { z } from 'zod';

export const worldNarrativeResponseSchema = z.object({
  recentEvents: z.string().nullable(),
  storySoFar: z.string().nullable(),
});

export type WorldNarrativeResponse = z.infer<
  typeof worldNarrativeResponseSchema
>;
