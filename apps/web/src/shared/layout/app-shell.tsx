import { Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { SkipLink } from '@/shared/accessibility/skip-link';
import { AppHeader } from '@/shared/layout/app-header';
import { Footer } from '@/shared/layout/footer';

export interface AppShellProps {
  isSignedIn: boolean;
  isAdmin: boolean;
  showObserverMode?: boolean;
  headerContent?: ReactNode;
  /** Sign-out handler wired by the root layout and forwarded to the header. */
  onSignOut?: () => void;
}

/**
 * The app shell: ambient mesh background + blobs, skip link, sticky header,
 * <main id="main"> landmark wrapping the routed outlet, and footer. Session
 * state is passed in as props so shared/ stays presentational.
 */
export function AppShell({
  isSignedIn,
  isAdmin,
  showObserverMode,
  headerContent,
  onSignOut,
}: AppShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-surface text-ink">
      <AmbientBackground />
      <SkipLink href="#main" />
      <AppHeader
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
        showObserverMode={showObserverMode}
        headerContent={headerContent}
        onSignOut={onSignOut}
      />
      <main
        id="main"
        tabIndex={-1}
        className="relative z-10 mx-auto w-full flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8"
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="mesh-bg absolute inset-0" />
      <div className="absolute -top-24 left-1/4 h-96 w-96 animate-blob rounded-full bg-brand-analyst/30 blur-[120px]" />
      <div className="absolute -right-24 top-1/3 h-80 w-80 animate-blob rounded-full bg-brand-diplomat/20 blur-[120px] [animation-delay:-9s]" />
    </div>
  );
}
