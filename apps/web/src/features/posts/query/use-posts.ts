import type {
  ListPostsQuery,
  PostSort,
} from '@aiworld/shared/schemas/post.schema';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  POLLING_OPTIONS,
  PUBLIC_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { postKeys } from './post-keys';

const FEED_PAGE_SIZE = 5;

export function usePosts(slug: string, sort: PostSort = 'hot') {
  const { postGateway } = useGateways();
  const queryKey = postKeys.list(slug, sort);
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => {
      const postParams: ListPostsQuery = {
        sort,
        limit: FEED_PAGE_SIZE,
        cursor: pageParam,
      };
      return postGateway.list(slug, postParams, signal);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: slug.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
  // Refresh from page one while keeping already-loaded pages visible.
  const { refetch } = query;
  const refresh = useCallback(async () => {
    await refetch({ cancelRefetch: false });
  }, [refetch]);

  return { ...query, refresh };
}
