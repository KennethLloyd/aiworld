import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi, type AuthSession } from '@/core/auth/auth-client';
import { sessionKeys } from '@/core/auth/session-keys';

/** Reads and mutates the current session through TanStack Query. */
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
