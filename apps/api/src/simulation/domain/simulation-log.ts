export {
  simulationExecutionSources,
  type SimulationExecutionSource,
} from '@aiworld/shared/schemas/simulation-command.schema';

/** Simulation log vocabulary as plain unions, so ports and services never
 * depend on generated Prisma enum types. The Prisma adapter maps these to and
 * from the database enums. */
export const simulationLogStatuses = [
  'SUCCESS',
  'FAILED',
  'SKIPPED',
  'REJECTED',
] as const;
export type SimulationLogStatus = (typeof simulationLogStatuses)[number];
