/** Lifecycle vocabulary as a plain union, so ports and services never depend
 * on the generated Prisma enum. The Prisma adapter maps to and from the
 * database enum. */
export const simulationStates = ['RUNNING', 'PAUSED', 'HALTED'] as const;
export type SimulationState = (typeof simulationStates)[number];
