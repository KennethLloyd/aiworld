import type {
  CreateWorldMember,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { characterKeys } from '@/features/characters/query/character-keys';
import { worldKeys } from '@/features/worlds/query/world-keys';
import { useGateways } from '@/providers/gateways-provider';

import { worldMemberKeys } from './world-member-keys';

async function invalidateMembershipReads(
  queryClient: ReturnType<typeof useQueryClient>,
  worldSlug: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: worldMemberKeys.world(worldSlug),
    }),
    queryClient.invalidateQueries({ queryKey: characterKeys.adminLists() }),
    queryClient.invalidateQueries({ queryKey: characterKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: worldKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: worldKeys.details() }),
  ]);
}

export function useAssignWorldMember() {
  const { worldMemberGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorldMember) => worldMemberGateway.create(input),
    onSuccess: async (_member, input) => {
      await invalidateMembershipReads(queryClient, input.worldSlug);
    },
    onError: async (_error, input) => {
      await invalidateMembershipReads(queryClient, input.worldSlug);
    },
  });
}

export interface UpdateWorldMemberVariables {
  worldSlug: string;
  memberId: string;
  input: UpdateWorldMember;
}

export function useUpdateWorldMember() {
  const { worldMemberGateway } = useGateways();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, input }: UpdateWorldMemberVariables) =>
      worldMemberGateway.update(memberId, input),
    onSuccess: async (_member, { worldSlug }) => {
      await invalidateMembershipReads(queryClient, worldSlug);
    },
  });
}
