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

import type { HttpClient } from '@/core/api/http-client';

import { characterEndpoints } from './character-endpoints';
import type {
  AdminCharacterGateway,
  CharacterGateway,
} from './character-gateway';

export class HttpCharacterGateway
  implements CharacterGateway, AdminCharacterGateway
{
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

  async listAdmin(
    query: ListCharactersQuery,
  ): Promise<AdminListCharactersResponse> {
    const raw = await this.http.get<unknown>(characterEndpoints.list(query));
    return adminListCharactersResponseSchema.parse(raw);
  }

  async getAdminById(characterId: string): Promise<AdminCharacterResponse> {
    const raw = await this.http.get<unknown>(
      characterEndpoints.detail(characterId),
    );
    return adminCharacterResponseSchema.parse(raw);
  }

  async create(input: CreateCharacter): Promise<AdminCharacterResponse> {
    const body = createCharacterSchema.parse(input);
    const raw = await this.http.post<unknown>(characterEndpoints.base(), body);
    return adminCharacterResponseSchema.parse(raw);
  }

  async update(
    characterId: string,
    input: UpdateCharacter,
  ): Promise<AdminCharacterResponse> {
    const body = updateCharacterSchema.parse(input);
    const raw = await this.http.patch<unknown>(
      characterEndpoints.detail(characterId),
      body,
    );
    return adminCharacterResponseSchema.parse(raw);
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
