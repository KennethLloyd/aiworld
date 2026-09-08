import type {
  CreateWorld,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createWorld,
  deleteWorld,
  updateWorld,
} from '@/features/worlds/api/world-api';

import { worldKeys } from './world-keys';

/** Keeps world mutation invalidation aligned with the query-key hierarchy. */
export function useCreateWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorld) => createWorld(input),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: UpdateWorldVariables) =>
      updateWorld(slug, input),
    onSuccess: async (_data, { slug }) => {
      await queryClient.invalidateQueries({
        queryKey: worldKeys.detail(slug),
      });
      await queryClient.invalidateQueries({ queryKey: worldKeys.lists() });
    },
  });
}

export function useDeleteWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => deleteWorld(slug),
    onSuccess: async (_data, slug) => {
      await queryClient.invalidateQueries({ queryKey: worldKeys.lists() });
      queryClient.setQueryData(worldKeys.detail(slug), undefined);
    },
  });
}
