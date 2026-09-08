import type { ListSimulationLogsQuery } from '@aiworld/shared/schemas/simulation-log.schema';
import type { RunCustomAction } from '@aiworld/shared/schemas/simulation-run.schema';
import type {
  UpdateSimulationSpeed,
  UpdateSimulationState,
} from '@aiworld/shared/schemas/simulation-state.schema';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { POLLING_OPTIONS } from '@/core/query/public-polling';
import {
  getSimulation,
  getSimulationHealth,
  listSimulationLogs,
  runCustomAction,
  runOneAction,
  updateSimulationSpeed,
  updateSimulationState,
} from '@/features/admin/api/admin-api';

import { adminKeys } from './admin-keys';

export const ADMIN_POLL_INTERVAL_MS = 5_000;

const recentLogsQuery: ListSimulationLogsQuery = { page: 1, limit: 5 };

export function useSimulation(slug: string) {
  return useQuery({
    queryKey: adminKeys.simulation(slug),
    queryFn: () => getSimulation(slug),
    enabled: slug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}

export function useSimulationHealth(slug: string) {
  return useQuery({
    queryKey: adminKeys.health(slug),
    queryFn: () => getSimulationHealth(slug),
    enabled: slug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}

export function useSimulationLogs(
  slug: string,
  query: ListSimulationLogsQuery = recentLogsQuery,
) {
  return useQuery({
    queryKey: adminKeys.worldLogs(slug, query),
    queryFn: () => listSimulationLogs(slug, query),
    placeholderData: keepPreviousData,
    enabled: slug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}

export function useUpdateSimulationState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      input,
    }: {
      slug: string;
      input: UpdateSimulationState;
    }) => updateSimulationState(slug, input),
    onSuccess: async (config, { slug }) => {
      queryClient.setQueryData(adminKeys.simulation(slug), config);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminKeys.simulation(slug),
        }),
        queryClient.invalidateQueries({
          queryKey: adminKeys.health(slug),
        }),
      ]);
    },
  });
}

export function useUpdateSimulationSpeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      input,
    }: {
      slug: string;
      input: UpdateSimulationSpeed;
    }) => updateSimulationSpeed(slug, input),
    onSuccess: async (config, { slug }) => {
      queryClient.setQueryData(adminKeys.simulation(slug), config);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminKeys.simulation(slug),
        }),
        queryClient.invalidateQueries({
          queryKey: adminKeys.health(slug),
        }),
      ]);
    },
  });
}

async function invalidateManualRunQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.health(slug) }),
    queryClient.invalidateQueries({ queryKey: adminKeys.logs() }),
  ]);
}

export function useRunOneAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => runOneAction(slug),
    onSuccess: async (_result, slug) => {
      await invalidateManualRunQueries(queryClient, slug);
    },
  });
}

export function useRunCustomAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: RunCustomAction }) =>
      runCustomAction(slug, input),
    onSuccess: async (_result, { slug }) => {
      await invalidateManualRunQueries(queryClient, slug);
    },
  });
}
