import {
  characterActivityResponseSchema,
  type CharacterActivityResponse,
} from '@aiworld/shared/schemas/activity-response.schema';
import type { ActivityQuery } from '@aiworld/shared/schemas/activity.schema';
import {
  characterResponseSchema,
  listCharactersResponseSchema,
  type CharacterResponse,
  type ListCharactersResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';

import type { HttpClient } from '@/core/api/http-client';

import { characterEndpoints } from './character-endpoints';
import type { CharacterGateway } from './character-gateway';

export class HttpCharacterGateway implements CharacterGateway {
  constructor(private readonly http: HttpClient) {}

  async list(query: ListCharactersQuery): Promise<ListCharactersResponse> {
    const raw = await this.http.get<unknown>(characterEndpoints.list(query));
    return listCharactersResponseSchema.parse(raw);
  }

  async getById(characterId: string): Promise<CharacterResponse> {
    const raw = await this.http.get<unknown>(
      characterEndpoints.detail(characterId),
    );
    return characterResponseSchema.parse(raw);
  }

  async getActivity(
    characterId: string,
    query: ActivityQuery,
  ): Promise<CharacterActivityResponse> {
    const raw = await this.http.get<unknown>(
      characterEndpoints.activity(characterId, query),
    );
    return characterActivityResponseSchema.parse(raw);
  }
}
