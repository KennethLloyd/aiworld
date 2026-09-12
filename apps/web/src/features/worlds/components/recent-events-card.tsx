import { Activity, Sparkles } from 'lucide-react';

import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

export function RecentEventsCard({
  recentEvents,
  isPending,
}: {
  recentEvents: string | null | undefined;
  isPending: boolean;
}) {
  return (
    <GlassPanel
      aria-busy={isPending}
      className="relative overflow-hidden rounded-[1.25rem] p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-sentinel/10 blur-3xl"
      />
      <header className="relative flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-sentinel/10 text-brand-sentinel">
          <Activity className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sentinel">
            Recent events
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
            What is unfolding
          </h2>
        </div>
      </header>
      <div className="relative mt-4 text-sm leading-7 text-ink/78">
        {isPending ? (
          <div className="flex flex-col gap-2" data-testid="narrative-skeleton">
            <Skeleton variant="text" className="h-4 w-full" />
            <Skeleton variant="text" className="h-4 w-11/12" />
            <Skeleton variant="text" className="h-4 w-2/3" />
          </div>
        ) : recentEvents ? (
          <p>{recentEvents}</p>
        ) : (
          <p className="text-ink/60">
            The World is waiting for its first meaningful turn of events.
          </p>
        )}
      </div>
    </GlassPanel>
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
              <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
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
