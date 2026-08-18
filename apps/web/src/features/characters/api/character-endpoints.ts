import type { ActivityQuery } from '@aiworld/shared/schemas/activity.schema';
import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';

function appendQuery(path: string, values: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export const characterEndpoints = {
  list(query: ListCharactersQuery): string {
    return appendQuery('/api/characters', {
      worldSlug: query.worldSlug,
      search: query.search,
      classification: query.classification,
      classificationGroup: query.classificationGroup,
      page: String(query.page),
      limit: String(query.limit),
      isActive:
        query.isActive === undefined ? undefined : String(query.isActive),
    });
  },
  detail(characterId: string): string {
    return `/api/characters/${encodeURIComponent(characterId)}`;
  },
  activity(characterId: string, query: ActivityQuery): string {
    return appendQuery(
      `/api/characters/${encodeURIComponent(characterId)}/activity`,
      {
        worldSlug: query.worldSlug,
        limit: String(query.limit),
        cursor: query.cursor,
      },
    );
  },
};
