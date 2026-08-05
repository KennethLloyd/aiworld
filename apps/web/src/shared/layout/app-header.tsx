import { Link } from '@tanstack/react-router';
import { Globe, LayoutDashboard, LogIn, LogOut } from 'lucide-react';

import { publicListWorldsDefaults } from '@/features/worlds/api/world-gateway';

export interface AppHeaderProps {
  isSignedIn: boolean;
  isAdmin: boolean;
  /**
   * Sign-out handler wired by the root layout. The header stays
   * presentational: it never fetches data or runs mutations itself.
   */
  onSignOut?: () => void;
}

/**
 * Session-aware header shell. Session state is passed in from the root route
 * (shared/ is presentational and never imports app hooks). Worlds and Sign in
 * are typed client-side Links; admins get an Admin link and every signed-in
 * user gets a Sign out action.
 */
export function AppHeader({ isSignedIn, isAdmin, onSignOut }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-glass-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
          >
            <Globe className="h-5 w-5 text-brand-sentinel" aria-hidden="true" />
            AIWorld
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 sm:flex"
          >
            <Link
              to="/worlds"
              search={publicListWorldsDefaults}
              className="text-sm text-ink/70 transition-colors hover:text-ink"
            >
              Worlds
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-ink/80 transition-colors hover:bg-glass-20 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-ink/80 transition-colors hover:bg-glass-20 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth/sign-in"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-ink/80 transition-colors hover:bg-glass-20 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
