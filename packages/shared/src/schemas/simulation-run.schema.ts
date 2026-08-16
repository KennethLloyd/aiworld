import { z } from "zod";
import { simulationActionTypes } from './simulation-command.schema.ts';
import { simulationLogResponseSchema } from './simulation-log.schema.ts';

// The manual-run contract: the Custom Action body (character and action are
// optional — Any Character / Automatic) and the shared Run One Action / Custom
// Action result. The result reflects exactly what the scheduler returned: a
// completed iteration with its logged outcome, or a logged failure.

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
