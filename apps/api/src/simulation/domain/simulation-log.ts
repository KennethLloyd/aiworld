/** Simulation log vocabulary as plain unions, so ports and services never
 * depend on generated Prisma enum types. The Prisma adapter maps these to and
 * from the database enums. */
export const simulationLogStatuses = ['SUCCESS', 'FAILED', 'SKIPPED'] as const;
export type SimulationLogStatus = (typeof simulationLogStatuses)[number];

export const simulationExecutionSources = [
  'SCHEDULED',
  'MANUAL',
  'RUN_ONE_CYCLE',
] as const;
export type SimulationExecutionSource =
  (typeof simulationExecutionSources)[number];
