import { z } from "zod";
import { paginationMetaSchema, paginationQueryFields } from './pagination.schema.ts';
import {
  simulationActionTypes,
  simulationExecutionSources,
} from './simulation-command.schema.ts';

// Admin logs omit prompts and raw provider responses.

export const simulationLogStatuses = [
  "SUCCESS",
  "FAILED",
  "SKIPPED",
  "REJECTED",
] as const;

export type SimulationLogStatus = (typeof simulationLogStatuses)[number];

export const simulationLogResponseSchema = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  characterId: z.uuid(),
  action: z.enum(simulationActionTypes),
  targetId: z.uuid().nullable(),
  reasoning: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  latencyMs: z.int().nullable(),
  jobId: z.string().nullable(),
  executionSource: z.enum(simulationExecutionSources),
  tokensUsed: z.int().nullable(),
  costEstimate: z.number().nullable(),
  status: z.enum(simulationLogStatuses),
  errorMessage: z.string().nullable(),
  executedAt: z.iso.datetime(),
});

export type SimulationLogResponse = z.infer<typeof simulationLogResponseSchema>;

export const listSimulationLogsQuerySchema = z.object({
  characterId: z.uuid().optional(),
  action: z.enum(simulationActionTypes).optional(),
  status: z.enum(simulationLogStatuses).optional(),
  executionSource: z.enum(simulationExecutionSources).optional(),
  ...paginationQueryFields,
});

export type ListSimulationLogsQuery = z.infer<
  typeof listSimulationLogsQuerySchema
>;

export const listSimulationLogsResponseSchema = z.object({
  items: z.array(simulationLogResponseSchema),
  meta: paginationMetaSchema,
});

export type ListSimulationLogsResponse = z.infer<
  typeof listSimulationLogsResponseSchema
>;
