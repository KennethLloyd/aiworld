export {
  simulationExecutionSources,
  type SimulationExecutionSource,
} from '@aiworld/shared/schemas/simulation-command.schema';
// Log status vocabulary as plain unions, so ports and services never depend on
// generated Prisma enum types. The shared schema owns the vocabulary; the
// Prisma adapter maps these to and from the database enum.
export {
  simulationLogStatuses,
  type SimulationLogStatus,
} from '@aiworld/shared/schemas/simulation-log.schema';
