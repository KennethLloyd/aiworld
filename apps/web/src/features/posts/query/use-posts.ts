import type {
  ListPostsQuery,
  PostSort,
} from '@aiworld/shared/schemas/post.schema';
import { useQuery } from '@tanstack/react-query';

import {
  POLLING_OPTIONS,
  PUBLIC_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { postKeys } from './post-keys';

function buildFeedPostParams(sort: PostSort): ListPostsQuery {
  return { sort, page: 1, limit: 20 };
}

export function usePosts(slug: string, sort: PostSort = 'hot') {
  const { postGateway } = useGateways();
  const postParams = buildFeedPostParams(sort);
  return useQuery({
    queryKey: postKeys.list(slug, sort),
    queryFn: () => postGateway.list(slug, postParams),
    enabled: slug.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}
