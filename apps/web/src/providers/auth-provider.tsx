import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { authApi, type AuthSession } from '@/core/auth/auth-client';
import { sessionKeys } from '@/core/auth/session-keys';

export interface AuthContextValue {
  session: AuthSession | null;
  isSignedIn: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Keeps auth state in the TanStack Query session cache. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: sessionKeys.current,
    queryFn: () => authApi.getSession(),
    // Better Auth handles token refresh; staleTime controls revalidation.
    staleTime: 60_000,
    retry: false,
  });

  const value = useMemo<AuthContextValue>(() => {
    const session = data ?? null;
    return {
      session,
      isSignedIn: session !== null,
      isAdmin: session?.user.role === 'ADMIN',
    };
  }, [data]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return value;
}
