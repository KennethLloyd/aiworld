import { ArrowDown, LoaderCircle } from 'lucide-react';
import type { RefObject } from 'react';

import { Skeleton } from '@/shared/ui/skeleton';

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  thresholdReached,
}: {
  pullDistance: number;
  isRefreshing: boolean;
  thresholdReached: boolean;
}) {
  return (
    <div
      className="pointer-events-none flex justify-center overflow-hidden transition-[height] duration-200"
      style={{ height: `${pullDistance}px` }}
    >
      <div
        className="flex h-11 items-center gap-2 text-xs font-medium text-brand-sentinel"
        role={pullDistance > 0 ? 'status' : undefined}
        aria-live={pullDistance > 0 ? 'polite' : undefined}
      >
        {isRefreshing ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowDown
            className={`h-4 w-4 transition-transform ${thresholdReached ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
        {isRefreshing
          ? 'Checking for new activity…'
          : thresholdReached
            ? 'Release to check for new activity'
            : 'Pull to check for new activity'}
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div
      aria-label="Loading conversations"
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      <Skeleton variant="card" className="h-40" />
      <Skeleton variant="card" className="h-36" />
    </div>
  );
}

export function WorldFeedPagination({
  sentinelRef,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
  hasPosts,
}: {
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
  hasPosts: boolean;
}) {
  if (!hasNextPage) {
    return hasPosts ? (
      <p className="py-2 text-center text-xs text-ink/60">
        You&apos;re caught up with this World.
      </p>
    ) : null;
  }
  return (
    <div
      ref={sentinelRef}
      data-testid="feed-pagination-sentinel"
      aria-label="Load older conversations"
      className="flex min-h-10 items-center justify-center"
    >
      {isFetchingNextPage ? (
        <span
          className="flex items-center gap-2 text-xs text-ink/60"
          aria-live="polite"
        >
          <LoaderCircle
            className="h-3.5 w-3.5 animate-spin"
            aria-hidden="true"
          />
          Loading older conversations…
        </span>
      ) : isFetchNextPageError ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="rounded-lg border border-brand-explorer/35 bg-brand-explorer/10 px-3 py-1.5 text-xs font-semibold text-brand-explorer transition-colors hover:bg-brand-explorer/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        >
          Try loading older conversations again
        </button>
      ) : (
        <button
          type="button"
          onClick={onLoadMore}
          className="rounded-lg border border-glass-border bg-glass-20 px-3 py-1.5 text-xs font-semibold text-ink/65 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        >
          Load older conversations
        </button>
      )}
    </div>
  );
}

export function WorldFeedUpdateError({
  isFetchNextPageError,
  onLoadMore,
  onRefresh,
}: {
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
}) {
  return (
    <output
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-explorer/30 bg-brand-explorer/10 px-4 py-3 text-xs text-brand-explorer"
      aria-live="polite"
    >
      <span>
        {isFetchNextPageError
          ? 'Older conversations could not be loaded.'
          : 'Feed update failed. Showing the last known activity.'}
      </span>
      <button
        type="button"
        onClick={isFetchNextPageError ? onLoadMore : onRefresh}
        className="rounded-md px-2 py-1 font-semibold underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
      >
        Try again
      </button>
    </output>
  );
}
