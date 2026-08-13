import { z } from "zod";

// The transport contract for simulated work. Scheduled ticks, Run One Action,
// and Custom Action all share one serializable command shape that both queue
// adapters (BullMQ and in-process) serialize and deserialize identically.

export const simulationActionTypes = ["POST", "VOTE", "COMMENT"] as const;

export const simulationExecutionSources = [
  "scheduled",
  "one-action",
  "custom",
] as const;

export type SimulationActionType = (typeof simulationActionTypes)[number];
export type SimulationExecutionSource =
  (typeof simulationExecutionSources)[number];

export const simulationCommandSchema = z.object({
  worldSlug: z.string().min(1).max(80),
  characterId: z.string().min(1),
  actionType: z.enum(simulationActionTypes),
  executionSource: z.enum(simulationExecutionSources),
  issuedAt: z.iso.datetime(),
});

export type SimulationCommand = z.infer<typeof simulationCommandSchema>;

// Speed multiplier range. The presets shown in the admin UI are vocabulary,
// not schema values; the shared contract owns the 0.1-100 boundary.
export const simulationSpeedMultiplierSchema = z
  .number()
  .min(0.1)
  .max(100);

export type SimulationSpeedMultiplier = z.infer<
  typeof simulationSpeedMultiplierSchema
>;

/**
 * Completion-to-start cadence math: the next scheduled tick fires after the
 * effective interval plus a uniform jitter. The speed multiplier scales both
 * the interval and the jitter so the pacing stays proportional. `random`
 * returns a value in [0, 1) and is injectable for deterministic tests.
 */
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
