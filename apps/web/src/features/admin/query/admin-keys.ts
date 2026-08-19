import type { ListSimulationLogsQuery } from '@aiworld/shared/schemas/simulation-log.schema';

export const adminKeys = {
  all: ['admin'] as const,
  simulations: () => [...adminKeys.all, 'simulations'] as const,
  simulation: (slug: string) =>
    [...adminKeys.simulations(), 'config', slug] as const,
  telemetry: (slug: string) =>
    [...adminKeys.simulations(), 'telemetry', slug] as const,
  logs: () => [...adminKeys.simulations(), 'logs'] as const,
  worldLogs: (slug: string, query: ListSimulationLogsQuery) =>
    [...adminKeys.logs(), slug, query] as const,
};
