import { z } from 'zod';

import { simulationStateSchema } from './simulation-state.schema.ts';
import { simulationTelemetryResponseSchema } from './simulation-telemetry.schema.ts';

export const simulationHealthStatuses = [
  'HEALTHY',
  'DEGRADED',
  'UNHEALTHY',
  'IDLE',
  'UNKNOWN',
] as const;

export const simulationProviderHealthStatuses = [
  'HEALTHY',
  'DEGRADED',
  'UNKNOWN',
] as const;

const timestampSchema = z.iso.datetime().nullable();

export const simulationHealthResponseSchema = z.object({
  lifecycle: z.object({
    state: simulationStateSchema,
  }),
  health: z.object({
    status: z.enum(simulationHealthStatuses),
    reason: z.string().nullable(),
  }),
  scheduler: z.object({
    available: z.boolean(),
    pending: z.boolean(),
    workExpected: z.boolean(),
    nextTickAt: timestampSchema,
    lastTickStartedAt: timestampSchema,
    lastTickCompletedAt: timestampSchema,
    retrying: z.boolean(),
    recentRetryCount: z.int().min(0),
    deadLetterCount: z.int().min(0),
    lastDeadLetterAt: timestampSchema,
    lastDeadLetterReason: z.string().nullable(),
    bootResumeFailure: z
      .object({
        occurredAt: z.iso.datetime(),
        reason: z.string(),
      })
      .nullable(),
  }),
  execution: z.object({
    lastSuccessAt: timestampSchema,
    lastFailureAt: timestampSchema,
  }),
  provider: z.object({
    status: z.enum(simulationProviderHealthStatuses),
    lastSuccessAt: timestampSchema,
    lastFailureAt: timestampSchema,
  }),
  telemetry: simulationTelemetryResponseSchema,
});

export type SimulationHealthResponse = z.infer<
  typeof simulationHealthResponseSchema
>;
