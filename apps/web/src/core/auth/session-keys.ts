/**
 * Query key factory for the session. The session lives in the TanStack Query
 * cache under ['session','current'] (no Redux/Zustand mirror); the expired
 * marker is written by the QueryClient 401 cache handlers and consumed by
 * AuthSessionBoundary, which performs the redirect navigation.
 */
export const sessionKeys = {
  all: ['session'] as const,
  current: ['session', 'current'] as const,
  expiredMarker: ['session', 'expired'] as const,
};
