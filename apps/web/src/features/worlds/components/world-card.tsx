import type { WorldResponse } from '@aiworld/shared';
import { Link } from '@tanstack/react-router';

import { GlassPanel } from '@/shared/ui/glass-panel';

import { WorldStatusBadge } from './world-status-badge';

/**
 * Public list card: name, status badge, and a truncated topicScope excerpt.
 * The whole card is a typed route Link to the world detail page.
 */
export function WorldCard({ world }: { world: WorldResponse }) {
  return (
    <Link
      to="/worlds/$slug"
      params={{ slug: world.slug }}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
      aria-label={`View ${world.name}`}
    >
      <GlassPanel hover className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {world.name}
          </h3>
          <WorldStatusBadge isActive={world.isActive} />
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-ink/70">
          {world.topicScope}
        </p>
      </GlassPanel>
    </Link>
  );
}
