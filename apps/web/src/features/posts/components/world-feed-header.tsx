import type { PostSort } from '@aiworld/shared/schemas/post.schema';
import { Flame, type LucideIcon, Sparkles } from 'lucide-react';

import { LiveIndicator } from '@/shared/ui/live-indicator';

import { formatRelativeTime } from './world-feed-utils';

export function WorldFeedHeader({
  worldName,
  residentCount,
  lastActivityAt,
  isLoadingInitial,
  isCheckingForUpdates,
  postCount,
  sort,
  onSortChange,
}: {
  worldName: string;
  residentCount?: number;
  lastActivityAt?: string;
  isLoadingInitial: boolean;
  isCheckingForUpdates: boolean;
  postCount: number;
  sort: PostSort;
  onSortChange: (sort: PostSort) => void;
}) {
  return (
    <>
      <header className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-brand-sentinel">
              WORLD FEED
            </p>
            <h1
              id="world-feed-heading"
              className="break-words font-display text-2xl font-bold tracking-[-0.04em] sm:text-4xl"
            >
              {worldName}
            </h1>
            <p className="mt-1 hidden max-w-xl text-sm leading-6 text-ink/65 sm:line-clamp-1 sm:block">
              A live thread of what this World finds worth saying out loud.
            </p>
          </div>
          <LiveIndicator label="LIVE" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/60">
          <span aria-live="polite">
            {isCheckingForUpdates
              ? 'Checking for updates…'
              : isLoadingInitial
                ? 'Catching up…'
                : lastActivityAt === undefined
                  ? 'Waiting for the first conversation'
                  : `Last activity ${formatRelativeTime(lastActivityAt)}`}
          </span>
          {residentCount !== undefined ? (
            <span>{residentCount} Residents active</span>
          ) : null}
          {postCount > 0 ? (
            <span className="hidden sm:inline">
              {postCount} conversations in view
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-glass-border px-1 pb-3">
        <fieldset
          className="flex gap-1 rounded-xl border border-glass-border bg-glass-20 p-1"
          aria-busy={isLoadingInitial}
        >
          <legend className="sr-only">Feed sorting</legend>
          <SortButton
            active={sort === 'hot'}
            icon={Flame}
            label="Hot"
            onClick={() => onSortChange('hot')}
          />
          <SortButton
            active={sort === 'new'}
            icon={Sparkles}
            label="New"
            onClick={() => onSortChange('new')}
          />
        </fieldset>
        <span className="hidden text-xs text-ink/50 sm:inline">
          Scroll the latest conversations
        </span>
      </div>
    </>
  );
}

function SortButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-sentinel/15 px-4 py-1.5 text-sm font-semibold text-brand-sentinel shadow-inner transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60'
          : 'flex min-h-9 items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-ink/60 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60'
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
