import type { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import type { ActivityQuery } from '@aiworld/shared/schemas/activity.schema';
import type {
  AdminCharacterResponse,
  AdminListCharactersResponse,
  CharacterResponse,
  ListCharactersResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import type {
  CreateCharacter,
  ListCharactersQuery,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';

export interface CharacterGateway {
  list(query: ListCharactersQuery): Promise<ListCharactersResponse>;
  getById(characterId: string): Promise<CharacterResponse>;
  getActivity(
    characterId: string,
    query: ActivityQuery,
  ): Promise<CharacterActivityResponse>;
}

/** Admin-only projection and mutation port; never expose it to public features. */
export interface AdminCharacterGateway {
  listAdmin(query: ListCharactersQuery): Promise<AdminListCharactersResponse>;
  getAdminById(characterId: string): Promise<AdminCharacterResponse>;
  create(input: CreateCharacter): Promise<AdminCharacterResponse>;
  update(
    characterId: string,
    input: UpdateCharacter,
  ): Promise<AdminCharacterResponse>;
}
