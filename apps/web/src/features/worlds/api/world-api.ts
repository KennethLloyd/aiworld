import { worldNarrativeResponseSchema } from '@aiworld/shared/schemas/world-narrative.schema';
import type {
  ListWorldsResponse,
  WorldResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import {
  listWorldsResponseSchema,
  worldResponseSchema,
} from '@aiworld/shared/schemas/world-response.schema';
import type {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { listWorldsQuerySchema } from '@aiworld/shared/schemas/world.schema';
import { z } from 'zod';

import { endpoints } from '@/core/api/endpoints';
import { apiClient } from '@/core/api/http-client';

export const publicListWorldsQuerySchema = listWorldsQuerySchema.omit({
  isActive: true,
});

export type PublicListWorldsQuery = z.infer<typeof publicListWorldsQuerySchema>;

export const publicListWorldsDefaults: PublicListWorldsQuery =
  publicListWorldsQuerySchema.parse({});

export async function listWorlds(
  query: ListWorldsQuery,
): Promise<ListWorldsResponse> {
  const raw = await apiClient.get<unknown>(endpoints.worlds.list(query));
  return listWorldsResponseSchema.parse(raw);
}

export async function getWorldBySlug(slug: string): Promise<WorldResponse> {
  const raw = await apiClient.get<unknown>(endpoints.worlds.detail(slug));
  return worldResponseSchema.parse(raw);
}

export async function getWorldNarrative(slug: string) {
  const raw = await apiClient.get<unknown>(endpoints.worlds.narrative(slug));
  return worldNarrativeResponseSchema.parse(raw);
}

export async function createWorld(input: CreateWorld): Promise<WorldResponse> {
  const raw = await apiClient.post<unknown>(endpoints.worlds.base(), input);
  return worldResponseSchema.parse(raw);
}

export async function updateWorld(
  slug: string,
  input: UpdateWorld,
): Promise<WorldResponse> {
  const raw = await apiClient.patch<unknown>(
    endpoints.worlds.detail(slug),
    input,
  );
  return worldResponseSchema.parse(raw);
}

export async function deleteWorld(slug: string): Promise<void> {
  await apiClient.delete(endpoints.worlds.detail(slug));
}
