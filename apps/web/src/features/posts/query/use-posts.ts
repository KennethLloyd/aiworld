import type { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { useQuery } from '@tanstack/react-query';

import { PUBLIC_POLL_INTERVAL_MS } from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { postKeys } from './post-keys';

const latestPostsQuery: ListPostsQuery = { sort: 'new', page: 1, limit: 5 };

export function usePosts(slug: string) {
  const { postGateway } = useGateways();
  return useQuery({
    queryKey: postKeys.list(slug),
    queryFn: () => postGateway.list(slug, latestPostsQuery),
    enabled: slug.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}
