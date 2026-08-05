import {
  listWorldsResponseSchema,
  type CreateWorld,
  type ListWorldsQuery,
  type ListWorldsResponse,
  type UpdateWorld,
  worldResponseSchema,
  type WorldResponse,
} from '@aiworld/shared';

import { endpoints } from '@/core/api/endpoints';
import type { HttpClient } from '@/core/api/http-client';

import type { WorldGateway } from './world-gateway';

/**
 * HTTP adapter for the WorldGateway port. Every response is Zod-parsed at the
 * gateway boundary before it can enter the TanStack Query cache: the client
 * returns raw unknown JSON (or throws ApiError), the schema is the last line
 * of defense, and a malformed payload throws a loud ZodError instead of
 * poisoning the cache.
 */
export class HttpWorldGateway implements WorldGateway {
  constructor(private readonly http: HttpClient) {}

  async list(query: ListWorldsQuery): Promise<ListWorldsResponse> {
    const raw = await this.http.get<unknown>(endpoints.worlds.list(query));
    return listWorldsResponseSchema.parse(raw);
  }

  async getBySlug(slug: string): Promise<WorldResponse> {
    const raw = await this.http.get<unknown>(endpoints.worlds.detail(slug));
    return worldResponseSchema.parse(raw);
  }

  async create(input: CreateWorld): Promise<WorldResponse> {
    const raw = await this.http.post<unknown>(endpoints.worlds.base(), input);
    return worldResponseSchema.parse(raw);
  }

  async update(slug: string, input: UpdateWorld): Promise<WorldResponse> {
    const raw = await this.http.patch<unknown>(
      endpoints.worlds.detail(slug),
      input,
    );
    return worldResponseSchema.parse(raw);
  }

  async delete(slug: string): Promise<void> {
    await this.http.delete(endpoints.worlds.detail(slug));
  }
}
