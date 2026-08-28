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
import { useGateways } from '@/providers/gateways-provider';

import { adminKeys } from './admin-keys';

export const ADMIN_POLL_INTERVAL_MS = 5_000;

const recentLogsQuery: ListSimulationLogsQuery = { page: 1, limit: 5 };

export function useSimulation(slug: string) {
  const { adminGateway } = useGateways();
  return useQuery({
    queryKey: adminKeys.simulation(slug),
    queryFn: () => adminGateway.getSimulation(slug),
    enabled: slug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}

export function useSimulationTelemetry(slug: string) {
  const { adminGateway } = useGateways();
  return useQuery({
    queryKey: adminKeys.telemetry(slug),
    queryFn: () => adminGateway.getSimulationTelemetry(slug),
    enabled: slug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}
export function useSimulationHealth(slug: string) {
  const { adminGateway } = useGateways();
  return useQuery({
    queryKey: adminKeys.health(slug),
    queryFn: () => adminGateway.getSimulationHealth(slug),
    enabled: slug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}

export function useSimulationLogs(
  slug: string,
  query: ListSimulationLogsQuery = recentLogsQuery,
) {
  const { adminGateway } = useGateways();
  return useQuery({
    queryKey: adminKeys.worldLogs(slug, query),
    queryFn: () => adminGateway.listSimulationLogs(slug, query),
    placeholderData: keepPreviousData,
    enabled: slug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}

export function useUpdateSimulationState() {
  const { adminGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      input,
    }: {
      slug: string;
      input: UpdateSimulationState;
    }) => adminGateway.updateSimulationState(slug, input),
    onSuccess: async (config, { slug }) => {
      queryClient.setQueryData(adminKeys.simulation(slug), config);
      await queryClient.invalidateQueries({
        queryKey: adminKeys.simulation(slug),
      });
    },
  });
}

export function useUpdateSimulationSpeed() {
  const { adminGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      input,
    }: {
      slug: string;
      input: UpdateSimulationSpeed;
    }) => adminGateway.updateSimulationSpeed(slug, input),
    onSuccess: async (config, { slug }) => {
      queryClient.setQueryData(adminKeys.simulation(slug), config);
      await queryClient.invalidateQueries({
        queryKey: adminKeys.simulation(slug),
      });
    },
  });
}

async function invalidateManualRunQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.telemetry(slug) }),
    queryClient.invalidateQueries({ queryKey: adminKeys.health(slug) }),
    queryClient.invalidateQueries({ queryKey: adminKeys.logs() }),
  ]);
}

export function useRunOneAction() {
  const { adminGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => adminGateway.runOneAction(slug),
    onSuccess: async (_result, slug) => {
      await invalidateManualRunQueries(queryClient, slug);
    },
  });
}

export function useRunCustomAction() {
  const { adminGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: RunCustomAction }) =>
      adminGateway.runCustomAction(slug, input),
    onSuccess: async (_result, { slug }) => {
      await invalidateManualRunQueries(queryClient, slug);
    },
  });
}
