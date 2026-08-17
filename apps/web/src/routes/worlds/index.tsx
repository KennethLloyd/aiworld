import {
  createFileRoute,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { useMemo } from 'react';

import {
  publicListWorldsQuerySchema,
  type PublicListWorldsQuery,
} from '@/features/worlds/api/world-gateway';
import { WorldList } from '@/features/worlds/components/world-list';
import { useWorlds } from '@/features/worlds/query/use-worlds';

export const Route = createFileRoute('/worlds/')({
  validateSearch: validatePublicListSearch,
  component: WorldsIndexPage,
});

/**
 * Public search validation: the URL is the source of truth and must stay
 * shareable/typed. Invalid values (e.g. page=abc) fall back to the schema
 * defaults instead of throwing at the route level, and isActive can never be
 * expressed through public URL params.
 */
function validatePublicListSearch(
  input: Record<string, unknown>,
): PublicListWorldsQuery {
  const parsed = publicListWorldsQuerySchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  return publicListWorldsQuerySchema.parse({});
}

function WorldsIndexPage() {
  const search = useSearch({ from: '/worlds/' });
  const navigate = useNavigate({ from: '/worlds/' });

  const query = useMemo<PublicListWorldsQuery>(
    () => ({
      search: search.search,
      page: search.page,
      limit: search.limit,
      isActive: true,
    }),
    [search],
  );
  const worldsQuery = useWorlds(query, { polling: true });

  const handleSearchChange = (nextSearch: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        search: nextSearch === '' ? undefined : nextSearch,
        page: 1,
      }),
    });
  };

  const handlePageChange = (page: number) => {
    void navigate({
      search: (previous) => ({ ...previous, page }),
    });
  };

  return (
    <WorldList
      data={worldsQuery.data}
      isPending={worldsQuery.isPending}
      isError={worldsQuery.isError}
      error={worldsQuery.error}
      search={search.search ?? ''}
      onSearchChange={handleSearchChange}
      onPageChange={handlePageChange}
      onRetry={() => void worldsQuery.refetch()}
    />
  );
}
