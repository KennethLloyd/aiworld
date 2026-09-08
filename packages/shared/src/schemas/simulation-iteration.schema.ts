import { z } from 'zod';

// Scheduled turns and manual iterations share this serializable shape.

export const simulationActionTypes = ["POST", "VOTE", "COMMENT"] as const;

export const simulationExecutionSources = [
  "scheduled",
  "one-action",
  "custom",
] as const;

export type SimulationActionType = (typeof simulationActionTypes)[number];
export type SimulationExecutionSource =
  (typeof simulationExecutionSources)[number];

export const simulationIterationSchema = z.object({
  worldSlug: z.string().min(1).max(80),
  characterId: z.string().min(1),
  actionType: z.enum(simulationActionTypes),
  executionSource: z.enum(simulationExecutionSources),
  issuedAt: z.iso.datetime(),
});

export type SimulationIteration = z.infer<typeof simulationIterationSchema>;

export const scheduledTurnSchema = simulationIterationSchema.extend({
  executionSource: z.literal('scheduled'),
});

export type ScheduledTurn = z.infer<typeof scheduledTurnSchema>;

// UI presets map to this shared 0.1-100 range.
export const simulationSpeedMultiplierSchema = z
  .number()
  .min(0.1)
  .max(100);

export type SimulationSpeedMultiplier = z.infer<
  typeof simulationSpeedMultiplierSchema
>;

/** Computes the next turn delay with speed-scaled jitter. */
export function deriveScheduledDelayMs(input: {
  intervalMs: number;
  jitterMs: number;
  speedMultiplier: number;
  random?: () => number;
}): number {
  const random = input.random ?? Math.random;
  const effectiveInterval = input.intervalMs / input.speedMultiplier;
  const effectiveJitter = input.jitterMs / input.speedMultiplier;
  const delta = (random() * 2 - 1) * effectiveJitter;
  return Math.max(0, Math.round(effectiveInterval + delta));
}
