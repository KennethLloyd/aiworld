import type {
  CreateCharacter,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import { characterKeys } from './character-keys';

export function useCreateCharacter() {
  const { adminCharacterGateway } = useGateways();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCharacter) => adminCharacterGateway.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: characterKeys.adminLists(),
      });
    },
  });
}

export interface UpdateCharacterVariables {
  characterId: string;
  input: UpdateCharacter;
}

export function useUpdateCharacter() {
  const { adminCharacterGateway } = useGateways();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, input }: UpdateCharacterVariables) =>
      adminCharacterGateway.update(characterId, input),
    onSuccess: async (_data, { characterId }) => {
      await queryClient.invalidateQueries({
        queryKey: characterKeys.adminLists(),
      });
      await queryClient.invalidateQueries({
        queryKey: characterKeys.adminDetail(characterId),
      });
      await queryClient.invalidateQueries({
        queryKey: characterKeys.detail(characterId),
      });
      await queryClient.invalidateQueries({
        queryKey: characterKeys.lists(),
      });
    },
  });
}
