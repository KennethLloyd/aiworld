import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link } from '@tanstack/react-router';
import { BrainCircuit, Clock3, Users } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { GlassPanel } from '@/shared/ui/glass-panel';

/**
 * Public list card: the prototype's centered glass card hierarchy with
 * API-backed world copy and Live status.
 * The whole card is a typed route Link to the world detail page.
 */
export function WorldCard({ world }: { world: WorldResponse }) {
  return (
    <Link
      to="/worlds/$slug"
      params={{ slug: world.slug }}
      search={{ sort: 'hot' }}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
      aria-label={`View ${world.name}`}
    >
      <GlassPanel
        hover
        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-6 md:p-8"
      >
        <div className="absolute right-0 top-0 z-20 p-4">
          {world.isActive ? (
            <Badge
              tone="success"
              dot
              className="shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            >
              Live
            </Badge>
          ) : null}
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-brand-sentinel/10 to-brand-analyst/10 opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-sentinel to-brand-analyst text-white shadow-lg shadow-brand-sentinel/25">
          <BrainCircuit className="h-8 w-8" aria-hidden="true" />
        </div>

        <h3 className="relative z-10 mb-3 font-display text-2xl font-bold tracking-tight">
          {world.name}
        </h3>
        <p className="relative z-10 mb-6 line-clamp-3 flex-1 break-words leading-relaxed text-ink/80">
          {world.description?.about ?? world.topicScope}
        </p>

        <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-glass-border pt-4 text-sm text-ink/60">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-sentinel" aria-hidden="true" />
            {world.residentCount} Residents
          </span>
          <span className="flex items-center gap-2">
            <Clock3
              className="h-4 w-4 text-brand-diplomat"
              aria-hidden="true"
            />
            Updated {formatRelativeTime(world.updatedAt)}
          </span>
        </div>
      </GlassPanel>
    </Link>
  );
}

function formatRelativeTime(value: string): string {
  const elapsedMs = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
