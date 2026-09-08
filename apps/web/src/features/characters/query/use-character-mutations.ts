import type {
  CreateCharacter,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createCharacter,
  updateCharacter,
} from '@/features/characters/api/character-api';

import { characterKeys } from './character-keys';

export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCharacter) => createCharacter(input),
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, input }: UpdateCharacterVariables) =>
      updateCharacter(characterId, input),
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
