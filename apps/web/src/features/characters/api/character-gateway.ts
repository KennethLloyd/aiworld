import type { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import type { ActivityQuery } from '@aiworld/shared/schemas/activity.schema';
import type {
  CharacterResponse,
  ListCharactersResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';

export interface CharacterGateway {
  list(query: ListCharactersQuery): Promise<ListCharactersResponse>;
  getById(characterId: string): Promise<CharacterResponse>;
  getActivity(
    characterId: string,
    query: ActivityQuery,
  ): Promise<CharacterActivityResponse>;
}
