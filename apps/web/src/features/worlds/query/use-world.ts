import { useQuery } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import { worldKeys } from './world-keys';

/**
 * Public detail query. `enabled` keeps a disabled query (never fired) while
 * the slug is empty; 404s surface as ApiError(404) which the route maps to
 * the not-found state.
 */
export function useWorld(slug: string) {
  const { worldGateway } = useGateways();
  return useQuery({
    queryKey: worldKeys.detail(slug),
    queryFn: () => worldGateway.getBySlug(slug),
    enabled: slug.length > 0,
  });
}
