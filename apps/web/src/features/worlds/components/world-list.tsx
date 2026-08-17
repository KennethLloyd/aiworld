import type { ListWorldsResponse } from '@aiworld/shared/schemas/world-response.schema';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/core/api/api-error';
import { buttonClasses } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';

import { WorldCard } from './world-card';

export interface WorldListProps {
  data: ListWorldsResponse | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  /** Current URL-backed search value ('' when absent). */
  search: string;
  /** Fired with the debounced (300ms) search text after the user stops typing. */
  onSearchChange: (search: string) => void;
  /** Fired when the user requests a specific page. */
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

/**
 * Public /worlds screen: debounced search box, responsive card grid, and the
 * four universal states (loading skeleton, error + retry, empty, content).
 * Presentational: data and callbacks come from the route; the only local
 * state is the search input draft (the URL is the source of truth).
 * placeholderData keeps the previous grid visible while search/pagination
 * changes load, so the skeleton only appears on the first load (no data).
 */
export function WorldList({
  data,
  isPending,
  isError,
  error,
  search,
  onSearchChange,
  onPageChange,
  onRetry,
}: WorldListProps) {
  const [draft, setDraft] = useState(search);
  const didMount = useRef(false);

  // Keep the input in sync when the URL search changes (back/forward, links).
  useEffect(() => {
    setDraft(search);
  }, [search]);

  const debouncedDraft = useDebouncedValue(draft, 300);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (debouncedDraft !== search) {
      onSearchChange(debouncedDraft);
    }
    // The URL-backed `search` is intentionally excluded: this effect fires
    // only when the debounced draft settles, and the guard above makes the
    // round-trip idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft]);

  return (
    <section aria-labelledby="worlds-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1
          id="worlds-heading"
          className="font-display text-3xl font-bold tracking-tight"
        >
          Active Simulations
        </h1>
        <h2 className="sr-only">Worlds</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/70 sm:text-base">
          Observe autonomous worlds living, arguing, and evolving in real-time.
          No human intervention.
        </p>
      </div>

      <div className="relative">
        <Input
          label="Search worlds"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by name or topic..."
          className="pr-11"
        />
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-ink/40"
        />
      </div>

      {isError ? (
        <ErrorState
          title="Could not load worlds"
          message={errorMessage(error)}
          onRetry={onRetry}
        />
      ) : null}

      {!isError && data === undefined ? <WorldListSkeleton /> : null}

      {!isError && data !== undefined && data.items.length === 0 ? (
        <EmptyState
          title={
            search === '' ? 'No worlds yet' : 'No worlds match your search'
          }
          description={
            search === ''
              ? 'The directory is empty - check back soon.'
              : `Nothing matches "${search}". Try a different search.`
          }
          className="py-16"
        />
      ) : null}

      {!isError && data !== undefined && data.items.length > 0 ? (
        <>
          <output className="text-xs text-ink/50">
            {data.meta.total} world{data.meta.total === 1 ? '' : 's'}
          </output>
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy={isPending}
          >
            {data.items.map((world) => (
              <li key={world.id}>
                <WorldCard world={world} />
              </li>
            ))}
          </ul>
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={onPageChange}
          />
        </>
      ) : null}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  return (
    <nav
      aria-label="Worlds pagination"
      className="flex items-center justify-between gap-4"
    >
      <button
        type="button"
        className={buttonClasses('outline', 'sm')}
        disabled={!canGoPrevious}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </button>
      <output className="text-xs text-ink/60">
        Page {page} of {totalPages}
      </output>
      <button
        type="button"
        className={buttonClasses('outline', 'sm')}
        disabled={!canGoNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

function WorldListSkeleton() {
  return (
    <div
      data-testid="world-list-skeleton"
      aria-label="Loading worlds"
      className="flex flex-col gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="card" />
        ))}
      </div>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while loading this content.';
}
