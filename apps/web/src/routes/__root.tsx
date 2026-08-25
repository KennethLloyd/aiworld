import {
  createRootRouteWithContext,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router';

import { useSignOut } from '@/features/auth/query/use-session';
import { DiscussionSearch } from '@/features/search/components/discussion-search';
import { publicListWorldsDefaults } from '@/features/worlds/api/world-gateway';
import { WorldDirectorySearch } from '@/features/worlds/components/world-directory-search';
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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { toast } = useToast();
  const signOut = useSignOut();
  const publicWorldSlug = getPublicWorldSlug(pathname);
  const isWorldDirectory = pathname === '/worlds' || pathname === '/worlds/';

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
        showObserverMode={isWorldDirectory || publicWorldSlug !== undefined}
        headerContent={
          isWorldDirectory ? (
            <WorldDirectorySearch />
          ) : publicWorldSlug ? (
            <DiscussionSearch worldSlug={publicWorldSlug} />
          ) : undefined
        }
        onSignOut={handleSignOut}
      />
    </>
  );
}

function getPublicWorldSlug(pathname: string): string | undefined {
  const match = /^\/worlds\/([^/]+)(?:\/|$)/.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
