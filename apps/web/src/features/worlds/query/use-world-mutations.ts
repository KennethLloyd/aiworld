import type { CreateWorld, UpdateWorld } from '@aiworld/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import { worldKeys } from './world-keys';

/**
 * Mutation hooks mirror the plan's invalidation table (Section 6.5): create
 * refreshes every list entry, update refreshes the detail + lists, delete
 * refreshes lists and evicts the stale detail cache entry.
 */
export function useCreateWorld() {
  const { worldGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorld) => worldGateway.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: worldKeys.lists() });
    },
  });
}

export interface UpdateWorldVariables {
  slug: string;
  input: UpdateWorld;
}

export function useUpdateWorld() {
  const { worldGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: UpdateWorldVariables) =>
      worldGateway.update(slug, input),
    onSuccess: async (_data, { slug }) => {
      await queryClient.invalidateQueries({
        queryKey: worldKeys.detail(slug),
      });
      await queryClient.invalidateQueries({ queryKey: worldKeys.lists() });
    },
  });
}

export function useDeleteWorld() {
  const { worldGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => worldGateway.delete(slug),
    onSuccess: async (_data, slug) => {
      await queryClient.invalidateQueries({ queryKey: worldKeys.lists() });
      queryClient.setQueryData(worldKeys.detail(slug), undefined);
    },
  });
}
