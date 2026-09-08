import { useQuery } from '@tanstack/react-query';

import {
  POLLING_OPTIONS,
  PUBLIC_FEED_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { getPostById } from '@/features/posts/api/post-api';

import { postKeys } from './post-keys';

export function usePost(slug: string, postId: string) {
  return useQuery({
    queryKey: postKeys.detail(slug, postId),
    queryFn: () => getPostById(slug, postId),
    enabled: slug.length > 0 && postId.length > 0,
    refetchInterval: PUBLIC_FEED_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}
