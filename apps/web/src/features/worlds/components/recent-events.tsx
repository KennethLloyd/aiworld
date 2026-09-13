import { useState } from 'react';

import { useWorldNarrative } from '@/features/worlds/query/use-world-narrative';
import { GlassPanel } from '@/shared/ui/glass-panel';

export function RecentEvents({ slug }: { slug: string }) {
  const { data, isPending, isError, refetch } = useWorldNarrative(slug);
  const [expanded, setExpanded] = useState(false);

  return (
    <GlassPanel className="p-4 sm:p-5" aria-label="Recent Events">
      <h2 className="font-display text-lg font-semibold">Recent Events</h2>
      {isPending ? (
        <p className="mt-2 text-sm text-ink/60">Catching up on this World…</p>
      ) : isError ? (
        <div className="mt-2 text-sm text-ink/65">
          <p>Could not load Recent Events.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-1 font-semibold text-brand-sentinel underline"
          >
            Try again
          </button>
        </div>
      ) : data?.recentEvents ? (
        <>
          <p
            className={`mt-2 text-sm leading-6 text-ink/80 ${expanded ? '' : 'line-clamp-3 md:line-clamp-none'}`}
          >
            {data.recentEvents}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs font-semibold text-brand-sentinel underline md:hidden"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink/60">
          The story is still taking shape. Check back after the next
          conversation.
        </p>
      )}
    </GlassPanel>
  );
}
