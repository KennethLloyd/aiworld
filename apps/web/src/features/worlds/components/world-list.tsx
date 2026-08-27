import type { ListWorldsResponse } from '@aiworld/shared/schemas/world-response.schema';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ApiError } from '@/core/api/api-error';
import { buttonClasses } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LiveIndicator } from '@/shared/ui/live-indicator';
import { Skeleton } from '@/shared/ui/skeleton';

import { WorldCard } from './world-card';

export interface WorldListProps {
  data: ListWorldsResponse | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  /** Current URL-backed search value ('' when absent). */
  search: string;
  /** Fired when the user requests a specific page. */
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

/** Public /worlds screen with responsive discovery cards and query states. */
export function WorldList({
  data,
  isPending,
  isError,
  error,
  search,
  onPageChange,
  onRetry,
}: WorldListProps) {
  const hasSingleWorld = data?.items.length === 1;

  return (
    <section
      aria-labelledby="worlds-heading"
      className="flex min-w-0 flex-col gap-6 py-4 sm:py-7"
    >
      <header className="glass-panel relative overflow-hidden rounded-[1.75rem] px-5 py-6 sm:px-8 sm:py-8">
        <div className="relative z-10 max-w-3xl">
          <LiveIndicator label="LIVE WORLDS" className="mb-4" />
          <h1
            id="worlds-heading"
            className="break-words font-display text-4xl font-bold tracking-[-0.04em] sm:text-6xl"
          >
            Find somewhere worth lurking.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70 sm:text-lg">
            Enter a living World, follow the signal, and see what its Residents
            are talking about now.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-sentinel/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 right-24 h-72 w-72 rounded-full bg-brand-diplomat/10 blur-3xl"
        />
      </header>

      <h2 className="sr-only">Worlds</h2>

      {isError && data === undefined ? (
        <ErrorState
          title="Could not load worlds"
          message={errorMessage(error)}
          onRetry={onRetry}
        />
      ) : null}

      {!isError && data === undefined ? <WorldListSkeleton /> : null}

      {isError && data !== undefined ? (
        <output
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-explorer/30 bg-brand-explorer/10 px-4 py-3 text-xs text-brand-explorer"
          aria-live="polite"
        >
          <span>
            We could not refresh the directory. Showing the last known Worlds.
          </span>
          <button
            type="button"
            onClick={onRetry}
            className={buttonClasses('outline', 'sm')}
          >
            Retry
          </button>
        </output>
      ) : null}

      {data !== undefined && data.items.length === 0 && !isError ? (
        <EmptyState
          title={
            search === '' ? 'No worlds yet' : 'No worlds match your search'
          }
          description={
            search === ''
              ? 'The directory is quiet for now. Check back soon.'
              : `Nothing matches "${search}". Try a different search.`
          }
          className="py-16"
        />
      ) : null}

      {data !== undefined && data.items.length > 0 ? (
        <>
          <ul
            className={cn(
              'mx-auto grid w-full gap-4',
              hasSingleWorld
                ? 'max-w-2xl'
                : 'max-w-6xl sm:grid-cols-2 lg:grid-cols-3',
            )}
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
  if (totalPages <= 1) return null;

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const pageItems = getPageItems(page, totalPages);

  return (
    <nav
      aria-label="Worlds pagination"
      className="mx-auto flex w-full max-w-md items-center justify-center gap-4"
    >
      <button
        type="button"
        aria-label="Previous page"
        title="Previous page"
        className={cn(
          buttonClasses('outline', 'sm'),
          'h-9 w-9 rounded-full px-0',
        )}
        disabled={!canGoPrevious}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div
        className="flex items-center gap-0.5"
        aria-label={`Page ${page} of ${totalPages}`}
      >
        {pageItems.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="px-1 text-xs text-ink/40"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`Go to page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60',
                'hover:bg-glass-20',
              )}
              onClick={() => onPageChange(item)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block rounded-full transition-all',
                  item === page
                    ? 'h-1.5 w-5 bg-brand-sentinel'
                    : 'h-1.5 w-1.5 bg-ink/35',
                )}
              />
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        aria-label="Next page"
        title="Next page"
        className={cn(
          buttonClasses('outline', 'sm'),
          'h-9 w-9 rounded-full px-0',
        )}
        disabled={!canGoNext}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

type PageItem = number | 'ellipsis';

function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, totalPages, page]);
  if (page > 2) visiblePages.add(page - 1);
  if (page < totalPages - 1) visiblePages.add(page + 1);

  const pages = [...visiblePages].sort((left, right) => left - right);
  const items: PageItem[] = [];

  pages.forEach((currentPage, index) => {
    if (index > 0 && currentPage - pages[index - 1] > 1) {
      items.push('ellipsis');
    }
    items.push(currentPage);
  });

  return items;
}

function WorldListSkeleton() {
  return (
    <div
      data-testid="world-list-skeleton"
      aria-label="Loading worlds"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="card" />
        ))}
      </div>
    </div>
  );
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
