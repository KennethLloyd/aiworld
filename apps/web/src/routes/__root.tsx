import {
  createRootRouteWithContext,
  useNavigate,
} from '@tanstack/react-router';

import { useSignOut } from '@/features/auth/query/use-session';
import { publicListWorldsDefaults } from '@/features/worlds/api/world-gateway';
import { useAuth } from '@/providers/auth-provider';
import { AuthSessionBoundary } from '@/providers/auth-session-boundary';
import type { RouterContext } from '@/router/router';
import { Toaster } from '@/shared/feedback/toaster';
import { useToast } from '@/shared/feedback/toaster';
import { AppShell } from '@/shared/layout/app-shell';

import { NotFoundPage } from './404';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  const { isSignedIn, isAdmin } = useAuth();

  return (
    <Toaster>
      <RootContent isSignedIn={isSignedIn} isAdmin={isAdmin} />
    </Toaster>
  );
}

function RootContent({
  isSignedIn,
  isAdmin,
}: {
  isSignedIn: boolean;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const signOut = useSignOut();

  // Sign-out is wired here (the composition root), not in the shared header:
  // the layout owns the mutation and the return navigation.
  const handleSignOut = () => {
    signOut.mutate(undefined, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Signed out' });
        void navigate({ to: '/worlds', search: publicListWorldsDefaults });
      },
    });
  };

  return (
    <>
      <AuthSessionBoundary />
      <AppShell
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
        onSignOut={handleSignOut}
      />
    </>
  );
}
