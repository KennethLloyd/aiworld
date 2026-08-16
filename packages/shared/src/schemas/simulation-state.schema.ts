import { z } from "zod";
import { simulationSpeedMultiplierSchema } from './simulation-command.schema.ts';

// The admin simulation lifecycle contract: the persisted WorldSimulationConfig
// transport shape, the state-mutation body, and the speed-mutation body. The
// state values mirror the lifecycle vocabulary and the speed multiplier reuses
// the shared 0.1-100 boundary owned by the command schema.

export const simulationStates = ["RUNNING", "PAUSED", "HALTED"] as const;

export const simulationStateSchema = z.enum(simulationStates);

export type SimulationState = z.infer<typeof simulationStateSchema>;

export const simulationConfigResponseSchema = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  state: simulationStateSchema,
  speedMultiplier: simulationSpeedMultiplierSchema,
  intervalMs: z.int().min(0),
  jitterMs: z.int().min(0),
  actionWeights: z.object({
    POST: z.number().min(0),
    VOTE: z.number().min(0),
    COMMENT: z.number().min(0),
  }),
  providerId: z.string(),
  model: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SimulationConfigResponse = z.infer<
  typeof simulationConfigResponseSchema
>;

export const updateSimulationStateSchema = z.object({
  state: simulationStateSchema,
});

export type UpdateSimulationState = z.infer<typeof updateSimulationStateSchema>;

export const updateSimulationSpeedSchema = z.object({
  speedMultiplier: simulationSpeedMultiplierSchema,
});

export type UpdateSimulationSpeed = z.infer<typeof updateSimulationSpeedSchema>;
