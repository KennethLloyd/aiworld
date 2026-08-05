import { createFileRoute, Link } from '@tanstack/react-router';

import { buttonClasses } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';

export const Route = createFileRoute('/404')({
  component: NotFoundPage,
});

/** Shared by the /404 route and the root route's notFoundComponent. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <GlassPanel className="w-full max-w-md p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-brand-explorer">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/70">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8">
          <Link to="/" className={buttonClasses('primary', 'md')}>
            Back home
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}
