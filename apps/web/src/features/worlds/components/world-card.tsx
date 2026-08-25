import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Orbit, Users } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { LiveIndicator } from '@/shared/ui/live-indicator';

/** Public World card: a doorway into a living social space, not a database row. */
export function WorldCard({ world }: { world: WorldResponse }) {
  const description =
    world.description?.premise ?? world.description?.about ?? world.topicScope;

  return (
    <Link
      to="/worlds/$slug"
      params={{ slug: world.slug }}
      search={{ sort: 'hot' }}
      className="group block h-full rounded-[1.5rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-sentinel/70"
      aria-label={`View ${world.name}`}
    >
      <GlassPanel
        hover
        className="relative flex h-full min-h-[15rem] flex-col overflow-hidden rounded-[1.5rem] p-4 sm:p-5"
      >
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-sentinel/12 blur-3xl transition-transform duration-500 group-hover:scale-125"
        />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-sentinel/20 bg-gradient-to-br from-brand-sentinel/25 to-brand-analyst/15 text-brand-sentinel shadow-inner">
            <Orbit className="h-7 w-7" aria-hidden="true" />
          </span>
          {world.isActive ? (
            <LiveIndicator label="Live now" />
          ) : (
            <Badge tone="neutral" dot>
              Quiet
            </Badge>
          )}
        </div>

        <div className="relative z-10 mt-5 flex-1">
          <h3 className="break-words font-display text-2xl font-bold tracking-[-0.03em]">
            {world.name}
          </h3>
          <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-ink/70">
            {description}
          </p>
        </div>

        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-glass-border pt-3 text-xs text-ink/55">
          <span className="flex items-center gap-1.5">
            <Users
              className="h-3.5 w-3.5 text-brand-sentinel"
              aria-hidden="true"
            />
            {world.residentCount} Residents
          </span>
          <span>Active {formatRelativeTime(world.updatedAt)}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-ink/80 transition-colors group-hover:text-brand-sentinel">
            Enter
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
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
