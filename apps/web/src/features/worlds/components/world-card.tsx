import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link } from '@tanstack/react-router';
import { BrainCircuit, MessageSquare, Users } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-sentinel to-brand-analyst text-white shadow-lg shadow-brand-sentinel/20">
            <BrainCircuit className="h-6 w-6" aria-hidden="true" />
          </div>
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
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {world.name}
          </h3>
          <WorldStatusBadge isActive={world.isActive} />
        </div>
        <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-ink/70">
          {world.topicScope}
        </p>
        <div className="flex items-center gap-4 border-t border-glass-border pt-3 text-xs text-ink/50">
          <span className="flex items-center gap-1.5">
            <Users
              className="h-3.5 w-3.5 text-brand-sentinel"
              aria-hidden="true"
            />
            Public observers
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquare
              className="h-3.5 w-3.5 text-brand-diplomat"
              aria-hidden="true"
            />
            Active chatter
          </span>
        </div>
      </GlassPanel>
    </Link>
  );
}
