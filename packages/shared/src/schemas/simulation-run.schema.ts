import { z } from "zod";
import { simulationActionTypes } from './simulation-command.schema.ts';
import { simulationLogResponseSchema } from './simulation-log.schema.ts';

// Manual runs share the scheduler result shape.

export const runCustomActionSchema = z.object({
  characterId: z.uuid().optional(),
  actionType: z.enum(simulationActionTypes).optional(),
});

export type RunCustomAction = z.infer<typeof runCustomActionSchema>;

export const actionFailureSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});

export type ActionFailure = z.infer<typeof actionFailureSchema>;

export const simulationRunResultResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    log: simulationLogResponseSchema,
  }),
  z.object({
    status: z.literal("failed"),
    failure: actionFailureSchema,
    log: simulationLogResponseSchema,
  }),
]);

export type SimulationRunResultResponse = z.infer<
  typeof simulationRunResultResponseSchema
>;
