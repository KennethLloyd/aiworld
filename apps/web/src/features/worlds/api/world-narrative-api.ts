import {
  worldNarrativeResponseSchema,
  type WorldNarrativeResponse,
} from '@aiworld/shared/schemas/world-narrative-response.schema';

import { apiClient } from '@/core/api/http-client';

import { worldNarrativeEndpoints } from './world-narrative-endpoints';

export async function getWorldNarrative(
  slug: string,
): Promise<WorldNarrativeResponse> {
  const raw = await apiClient.get<unknown>(
    worldNarrativeEndpoints.detail(slug),
  );
  return worldNarrativeResponseSchema.parse(raw);
}
