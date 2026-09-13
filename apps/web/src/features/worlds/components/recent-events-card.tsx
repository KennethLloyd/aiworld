import { RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/core/api/api-error';
import { useWorldNarrative } from '@/features/worlds/query/use-world-narrative';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

import { NarrativeText } from './narrative-text';

export function RecentEventsCard({ slug }: { slug: string }) {
  const narrativeQuery = useWorldNarrative(slug);
  const recentEvents = narrativeQuery.data?.recentEvents ?? null;

  if (narrativeQuery.isPending && narrativeQuery.data === undefined) {
    return (
      <GlassPanel aria-busy="true" className="p-5 sm:p-6">
        <NarrativeHeading />
        <Skeleton variant="text" className="mt-4 h-5 w-full" />
        <Skeleton variant="text" className="mt-2 h-5 w-4/5" />
      </GlassPanel>
    );
  }

  if (narrativeQuery.isError && narrativeQuery.data === undefined) {
    return (
      <ErrorState
        title="Could not load recent events"
        message={narrativeErrorMessage(narrativeQuery.error)}
        onRetry={() => void narrativeQuery.refetch()}
      />
    );
  }

  return (
    <GlassPanel className="p-5 sm:p-6">
      <NarrativeHeading />
      {recentEvents ? (
        <ExpandableNarrative text={recentEvents} />
      ) : (
        <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-ink/65">
          <p aria-live="polite">
            {narrativeQuery.isFetching
              ? 'Residents are writing the next briefing…'
              : 'Recent Events will appear after the World has its next meaningful moment.'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => void narrativeQuery.refetch()}
            loading={narrativeQuery.isFetching}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Check again
          </Button>
        </div>
      )}
    </GlassPanel>
  );
}

function NarrativeHeading() {
  return (
    <header className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-sentinel/10 text-brand-sentinel">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-brand-sentinel">
          RECENT EVENTS
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
          What matters now
        </h2>
      </div>
    </header>
  );
}

function ExpandableNarrative({ text }: { text: string }) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph || expanded) {
      return;
    }
    const update = () =>
      setIsTruncated(paragraph.scrollHeight > paragraph.clientHeight + 1);
    update();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(update);
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [text, expanded, isMobile]);

  const clamped = isMobile && !expanded;
  return (
    <div className="mt-4">
      <p
        ref={paragraphRef}
        className={`text-sm leading-7 text-ink/78 ${clamped ? 'line-clamp-3' : ''}`}
      >
        <NarrativeText text={text} />
      </p>
      {isMobile && isTruncated ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-brand-sentinel underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </div>
  );
}

function narrativeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while loading recent events.';
}
