import { createFileRoute, Link } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';

import { buttonClasses } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';

export const Route = createFileRoute('/403')({
  component: ForbiddenPage,
});

function ForbiddenPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <GlassPanel className="w-full max-w-md p-10 text-center">
        <ShieldAlert
          className="mx-auto h-10 w-10 text-brand-explorer"
          aria-hidden="true"
        />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.35em] text-brand-explorer">
          403
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Access denied
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/70">
          You need the ADMIN role to view this page.
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
