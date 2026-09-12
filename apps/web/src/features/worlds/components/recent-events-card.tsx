import { Activity, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

export function RecentEventsCard({
  recentEvents,
  isPending,
  errorMessage,
  onRetry,
}: {
  recentEvents: string | null | undefined;
  isPending: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}) {
  const briefingRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    setExpanded(false);
  }, [recentEvents]);

  useLayoutEffect(() => {
    const element = briefingRef.current;
    if (!element || !recentEvents) {
      setIsTruncated(false);
      return;
    }

    const checkTruncation = () => {
      const isMobile =
        typeof window.matchMedia !== 'function' ||
        window.matchMedia('(max-width: 639px)').matches;
      if (!isMobile) {
        setIsTruncated(false);
        return;
      }
      if (!expanded) {
        setIsTruncated(element.scrollHeight > element.clientHeight + 1);
      }
    };

    checkTruncation();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', checkTruncation);
      return () => window.removeEventListener('resize', checkTruncation);
    }
    window.addEventListener('resize', checkTruncation);
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(element);
    return () => {
      window.removeEventListener('resize', checkTruncation);
      observer.disconnect();
    };
  }, [expanded, recentEvents]);

  return (
    <GlassPanel
      aria-busy={isPending}
      className="relative overflow-hidden rounded-[1.25rem] p-4 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-sentinel/10 blur-3xl"
      />
      <header className="relative flex items-center gap-2 sm:items-start sm:gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-sentinel/10 text-brand-sentinel sm:h-9 sm:w-9">
          <Activity className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sentinel sm:block">
            Recent events
          </p>
          <h2 className="font-display text-lg font-bold tracking-tight sm:mt-1 sm:text-xl">
            What is unfolding
          </h2>
        </div>
      </header>
      <div className="relative mt-3 text-sm leading-6 text-ink/78 sm:mt-4 sm:leading-7">
        {isPending ? (
          <div className="flex flex-col gap-2" data-testid="narrative-skeleton">
            <Skeleton variant="text" className="h-4 w-full" />
            <Skeleton variant="text" className="h-4 w-11/12" />
            <Skeleton variant="text" className="h-4 w-2/3" />
          </div>
        ) : errorMessage !== undefined ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-sm text-rose-200"
          >
            <div>
              <p className="font-semibold">Recent Events unavailable</p>
              <p className="mt-1">{errorMessage}</p>
            </div>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md px-2 py-1 font-semibold underline underline-offset-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : recentEvents ? (
          <>
            <p
              id="recent-events-briefing"
              ref={briefingRef}
              className={
                expanded
                  ? 'sm:line-clamp-none'
                  : 'line-clamp-3 sm:line-clamp-none'
              }
            >
              {renderNarrativeText(recentEvents)}
            </p>
            {isTruncated ? (
              <button
                type="button"
                aria-controls="recent-events-briefing"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
                className="mt-2 rounded-md text-xs font-semibold text-brand-sentinel underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-ink/60">
            The World is waiting for its first meaningful turn of events.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function renderNarrativeText(text: string) {
  return text.split(/(@[a-zA-Z0-9_-]+)/g).map((part, index) =>
    part.startsWith('@') ? (
      <span
        key={`${part}-${index}`}
        className="font-semibold text-brand-sentinel"
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function StorySoFar({
  story,
  isPending = false,
}: {
  story: string | null;
  isPending?: boolean;
}) {
  const paragraphs = story?.split(/\n\s*\n/).filter(Boolean) ?? [];

  return (
    <article className="flex flex-col gap-5">
      <header className="flex items-start gap-3 px-1">
        <Sparkles
          className="mt-1 h-5 w-5 shrink-0 text-brand-explorer"
          aria-hidden="true"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-explorer">
            World chronicle
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.04em]">
            Story So Far
          </h1>
        </div>
      </header>
      <GlassPanel className="relative overflow-hidden rounded-[1.35rem] p-5 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-explorer/10 blur-3xl"
        />
        {isPending ? (
          <div className="relative flex flex-col gap-3">
            <Skeleton variant="text" className="h-4 w-full" />
            <Skeleton variant="text" className="h-4 w-full" />
            <Skeleton variant="text" className="h-4 w-10/12" />
            <Skeleton variant="text" className="h-4 w-2/3" />
          </div>
        ) : paragraphs.length > 0 ? (
          <div className="relative flex flex-col gap-5 text-[1.02rem] leading-8 text-ink/80">
            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 20)}`}>
                {renderNarrativeText(paragraph)}
              </p>
            ))}
          </div>
        ) : (
          <p className="relative text-sm leading-7 text-ink/65">
            The story is waiting for its first chapter.
          </p>
        )}
      </GlassPanel>
    </article>
  );
}
