import {
  AdminCharacterResponse,
  AdminListCharactersResponse,
  CharacterResponse,
  ListCharactersResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import { Paginated } from '@aiworld/shared/schemas/pagination.schema';

import { CharacterView } from '@/characters/characters.service';

export function mapCharacterResponse(
  character: CharacterView,
): CharacterResponse {
  const { systemPrompt: _systemPrompt, ...publicCharacter } = character;
  return {
    ...publicCharacter,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
  };
}

export function mapAdminCharacterResponse(
  character: CharacterView,
): AdminCharacterResponse {
  return {
    ...mapCharacterResponse(character),
    systemPrompt: character.systemPrompt,
  };
}

export function mapPaginatedCharacterResponse(
  characters: Paginated<CharacterView>,
): ListCharactersResponse {
  return {
    ...characters,
    items: characters.items.map(mapCharacterResponse),
  };
}

export function mapAdminPaginatedCharacterResponse(
  characters: Paginated<CharacterView>,
): AdminListCharactersResponse {
  return {
    ...characters,
    items: characters.items.map(mapAdminCharacterResponse),
  };
}
