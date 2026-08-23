import { useQuery } from '@tanstack/react-query';

import {
  POLLING_OPTIONS,
  PUBLIC_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { postKeys } from './post-keys';

export function usePost(slug: string, postId: string) {
  const { postGateway } = useGateways();

  return useQuery({
    queryKey: postKeys.detail(slug, postId),
    queryFn: () => postGateway.getById(slug, postId),
    enabled: slug.length > 0 && postId.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}
