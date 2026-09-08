import {
  characterActivityResponseSchema,
  type CharacterActivityResponse,
} from '@aiworld/shared/schemas/activity-response.schema';
import type { ActivityQuery } from '@aiworld/shared/schemas/activity.schema';
import {
  adminCharacterResponseSchema,
  adminListCharactersResponseSchema,
  characterResponseSchema,
  listCharactersResponseSchema,
  type AdminCharacterResponse,
  type AdminListCharactersResponse,
  type CharacterResponse,
  type ListCharactersResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import {
  createCharacterSchema,
  type CreateCharacter,
  type ListCharactersQuery,
  updateCharacterSchema,
  type UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';

import { apiClient } from '@/core/api/http-client';

import { characterEndpoints } from './character-endpoints';

export async function listCharacters(
  query: ListCharactersQuery,
): Promise<ListCharactersResponse> {
  const raw = await apiClient.get<unknown>(characterEndpoints.list(query));
  return listCharactersResponseSchema.parse(raw);
}

export async function getCharacterById(
  characterId: string,
): Promise<CharacterResponse> {
  const raw = await apiClient.get<unknown>(
    characterEndpoints.detail(characterId),
  );
  return characterResponseSchema.parse(raw);
}

export async function listAdminCharacters(
  query: ListCharactersQuery,
): Promise<AdminListCharactersResponse> {
  const raw = await apiClient.get<unknown>(characterEndpoints.list(query));
  return adminListCharactersResponseSchema.parse(raw);
}

export async function getAdminCharacterById(
  characterId: string,
): Promise<AdminCharacterResponse> {
  const raw = await apiClient.get<unknown>(
    characterEndpoints.detail(characterId),
  );
  return adminCharacterResponseSchema.parse(raw);
}

export async function createCharacter(
  input: CreateCharacter,
): Promise<AdminCharacterResponse> {
  const body = createCharacterSchema.parse(input);
  const raw = await apiClient.post<unknown>(characterEndpoints.base(), body);
  return adminCharacterResponseSchema.parse(raw);
}

export async function updateCharacter(
  characterId: string,
  input: UpdateCharacter,
): Promise<AdminCharacterResponse> {
  const body = updateCharacterSchema.parse(input);
  const raw = await apiClient.patch<unknown>(
    characterEndpoints.detail(characterId),
    body,
  );
  return adminCharacterResponseSchema.parse(raw);
}

export async function getCharacterActivity(
  characterId: string,
  query: ActivityQuery,
): Promise<CharacterActivityResponse> {
  const raw = await apiClient.get<unknown>(
    characterEndpoints.activity(characterId, query),
  );
  return characterActivityResponseSchema.parse(raw);
}
