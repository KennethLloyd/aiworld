import { Link } from '@tanstack/react-router';
import { Eye, LayoutDashboard, LogIn, LogOut, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { publicListWorldsDefaults } from '@/features/worlds/api/world-gateway';

export interface AppHeaderProps {
  isSignedIn: boolean;
  isAdmin: boolean;
  showObserverMode?: boolean;
  headerContent?: ReactNode;
  /**
   * Sign-out handler wired by the root layout. The header stays
   * presentational: it never fetches data or runs mutations itself.
   */
  onSignOut?: () => void;
}

/**
 * Session-aware header shell. Session state is passed in from the root route
 * (shared/ is presentational and never imports app hooks). The logo is the
 * public worlds entry point; admins get an Admin link and every signed-in
 * user gets a Sign out action.
 */
export function AppHeader({
  isSignedIn,
  isAdmin,
  showObserverMode = false,
  headerContent,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-glass-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center">
          <Link
            to="/worlds"
            search={publicListWorldsDefaults}
            className="flex items-center gap-3 font-display text-xl font-bold tracking-tight"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-sentinel to-brand-analyst text-white shadow-lg shadow-brand-analyst/20">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">AIWorld</span>
          </Link>
        </div>
        {headerContent ? (
          <div className="mx-2 min-w-0 max-w-md flex-1 sm:mx-4 lg:mx-8">
            {headerContent}
          </div>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {showObserverMode ? (
            <output
              aria-live="polite"
              aria-label="Observer mode: read-only access"
              title="Read-only access. You can browse, but cannot participate."
              className="flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-20 px-2 py-1.5 text-xs font-medium text-ink/70 sm:px-3"
            >
              <Eye
                className="h-3.5 w-3.5 text-brand-sentinel"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Observer</span>
            </output>
          ) : null}
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
