import type { ListSimulationLogsQuery } from '@aiworld/shared/schemas/simulation-log.schema';

function appendQuery(path: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search.length > 0 ? `${path}?${search}` : path;
}

function simulationPath(slug: string): string {
  return `/api/worlds/${encodeURIComponent(slug)}/simulation`;
}

export const adminEndpoints = {
  simulation: {
    config(slug: string): string {
      return simulationPath(slug);
    },
    state(slug: string): string {
      return `${simulationPath(slug)}/state`;
    },
    speed(slug: string): string {
      return `${simulationPath(slug)}/speed`;
    },
    runOneAction(slug: string): string {
      return `${simulationPath(slug)}/run-one-action`;
    },
    customAction(slug: string): string {
      return `${simulationPath(slug)}/custom-action`;
    },
    telemetry(slug: string): string {
      return `${simulationPath(slug)}/telemetry`;
    },
    logs(slug: string, query: ListSimulationLogsQuery): string {
      return appendQuery(`${simulationPath(slug)}/logs`, {
        characterId: query.characterId,
        action: query.action,
        status: query.status,
        executionSource: query.executionSource,
        page: String(query.page),
        limit: String(query.limit),
      });
    },
  },
};
