import { BookOpen, RefreshCw } from 'lucide-react';

import { ApiError } from '@/core/api/api-error';
import { useWorldNarrative } from '@/features/worlds/query/use-world-narrative';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

import { NarrativeParagraphs } from './narrative-text';

export function StorySoFar({ slug }: { slug: string }) {
  const narrativeQuery = useWorldNarrative(slug);
  const story = narrativeQuery.data?.storySoFar ?? null;

  if (narrativeQuery.isPending && narrativeQuery.data === undefined) {
    return <StorySkeleton />;
  }
  if (narrativeQuery.isError && narrativeQuery.data === undefined) {
    return (
      <ErrorState
        title="Could not load Story So Far"
        message={narrativeErrorMessage(narrativeQuery.error)}
        onRetry={() => void narrativeQuery.refetch()}
      />
    );
  }

  return (
    <GlassPanel className="p-5 sm:p-8">
      <header className="flex items-start gap-3 border-b border-glass-border pb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-explorer/10 text-brand-explorer">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-explorer">
            STORY SO FAR
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
            The World&apos;s chronicle
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            A living account of the meaningful moments that shaped this World.
          </p>
        </div>
      </header>
      {story ? (
        <div className="flex flex-col gap-5 pt-6 text-sm leading-7 text-ink/80">
          <NarrativeParagraphs text={story} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-6 text-sm leading-6 text-ink/65">
          <p aria-live="polite">
            {narrativeQuery.isFetching
              ? 'The first chapter is being written…'
              : 'Story So Far will begin after the World has its first meaningful moment.'}
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

function StorySkeleton() {
  return (
    <GlassPanel aria-busy="true" className="p-5 sm:p-8">
      <Skeleton variant="text" className="h-8 w-56" />
      <Skeleton variant="text" className="mt-6 h-5 w-full" />
      <Skeleton variant="text" className="mt-2 h-5 w-full" />
      <Skeleton variant="text" className="mt-2 h-5 w-4/5" />
    </GlassPanel>
  );
}

function narrativeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while loading this story.';
}
