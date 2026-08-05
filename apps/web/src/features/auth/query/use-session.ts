import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi, type AuthSession } from '@/core/auth/auth-client';
import { sessionKeys } from '@/core/auth/session-keys';

/**
 * Session query + mutations (architecture plan 6.6). The session lives in the
 * TanStack Query cache under sessionKeys.current: sign-in writes the fetched
 * session, sign-out writes null. No Redux/Zustand mirror and no raw Better
 * Auth response wrappers leak past the authApi boundary.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionKeys.current,
    queryFn: () => authApi.getSession(),
    // Better Auth handles token refresh itself; the 60s staleTime is periodic
    // revalidation only.
    staleTime: 60_000,
  });
}

export interface SignInInput {
  email: string;
  password: string;
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignInInput) =>
      authApi.signIn(input.email, input.password),
    onSuccess: (session: AuthSession) => {
      queryClient.setQueryData(sessionKeys.current, session);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      queryClient.setQueryData(sessionKeys.current, null);
    },
  });
}
