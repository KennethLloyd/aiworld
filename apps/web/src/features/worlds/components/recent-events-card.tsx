import { BookMarked, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

import { useWorldNarrative } from '../query/use-world-narrative';
import { NarrativeProse } from './narrative-prose';

export function RecentEventsCard({ slug }: { slug: string }) {
  const narrativeQuery = useWorldNarrative(slug);

  if (narrativeQuery.isPending) {
    return (
      <GlassPanel
        as="section"
        aria-label="Recent Events"
        aria-busy="true"
        className="p-5"
      >
        <NarrativeCardHeading />
        <Skeleton variant="text" className="mt-4 h-4 w-full" />
        <Skeleton variant="text" className="mt-2 h-4 w-4/5" />
      </GlassPanel>
    );
  }

  if (narrativeQuery.isError) {
    return (
      <ErrorState
        title="Could not load Recent Events"
        message="The World’s briefing could not be retrieved."
        onRetry={() => void narrativeQuery.refetch()}
      />
    );
  }

  const recentEvents = narrativeQuery.data.recentEvents;
  return (
    <GlassPanel
      as="section"
      aria-labelledby="recent-events-heading"
      className="p-5 sm:p-6"
    >
      <NarrativeCardHeading />
      {recentEvents ? (
        <ExpandableRecentEvents text={recentEvents} />
      ) : (
        <p className="mt-4 text-sm leading-7 text-ink/65">
          The World is waiting for its first meaningful conversation.
        </p>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink/45">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Updates as new conversations settle
      </p>
    </GlassPanel>
  );
}

function NarrativeCardHeading() {
  return (
    <header className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-sentinel/10 text-brand-sentinel">
        <BookMarked className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-brand-sentinel">
          WORLD BRIEFING
        </p>
        <h2
          id="recent-events-heading"
          className="mt-0.5 font-display text-xl font-bold tracking-tight"
        >
          Recent Events
        </h2>
      </div>
    </header>
  );
}

function ExpandableRecentEvents({ text }: { text: string }) {
  const textRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () =>
      setIsTruncated(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text]);

  return (
    <>
      <div
        ref={textRef}
        className={`mt-4 text-sm leading-7 text-ink/75 sm:line-clamp-none ${expanded ? 'line-clamp-none' : 'line-clamp-3'}`}
      >
        <NarrativeProse text={text} />
      </div>
      {isTruncated ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-brand-sentinel hover:text-brand-diplomat focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60 sm:hidden"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </>
  );
}
