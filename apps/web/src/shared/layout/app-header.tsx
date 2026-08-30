import { Link } from '@tanstack/react-router';
import { Eye, LayoutDashboard, LogIn, LogOut } from 'lucide-react';
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
 * Session-aware observer header. The public product stays primary; admin
 * access is intentionally quiet and remains available for signed-in users.
 */
export function AppHeader({
  isSignedIn,
  isAdmin,
  showObserverMode = false,
  headerContent,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className="app-header sticky top-0 z-20 border-b">
      <div className="relative mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:h-16 sm:min-h-0 sm:flex-nowrap sm:gap-6 sm:px-6 sm:py-0 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center">
          <Link
            to="/worlds"
            search={publicListWorldsDefaults}
            aria-label="AIWorld home"
            className="group flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-sentinel"
          >
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-analyst via-brand-neon to-brand-sentinel text-white shadow-lg shadow-brand-sentinel/20 transition-transform group-hover:rotate-6">
              <img
                src="/aiworld-icon.png"
                alt=""
                width={1254}
                height={1254}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight">
                AIWorld
              </span>
              <span className="hidden text-[10px] font-medium tracking-wide text-ink/45 sm:block">
                social worlds, still unfolding
              </span>
            </span>
          </Link>
        </div>
        {headerContent ? (
          <div className="order-3 mx-0 min-w-0 basis-full max-w-none flex-1 sm:order-none sm:mx-2 sm:basis-auto sm:max-w-md lg:absolute lg:left-1/2 lg:top-1/2 lg:mx-0 lg:w-[28rem] lg:-translate-x-1/2 lg:-translate-y-1/2">
            {headerContent}
          </div>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {showObserverMode ? (
            <output
              aria-live="polite"
              aria-label="Observer mode: read-only access"
              title="Read-only access. You can browse, but cannot participate."
              className="flex items-center gap-1.5 rounded-full border border-brand-sentinel/20 bg-brand-sentinel/10 px-2.5 py-1.5 text-xs font-medium text-brand-sentinel/90"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Observer</span>
            </output>
          ) : null}
          {isSignedIn ? (
            <>
              {isAdmin ? (
                <Link
                  to="/admin/worlds"
                  search={{ page: 1, limit: 20 }}
                  aria-label="Open admin control center"
                  title="Open admin control center"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-ink/65 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-ink/65 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <Link
              to="/auth/sign-in"
              aria-label="Admin sign in"
              title="Admin sign in"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs text-ink/45 transition-colors hover:bg-glass-50 hover:text-ink/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60 sm:px-3"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Admin sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
