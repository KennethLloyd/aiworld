import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';

import {
  adminErrorMessage,
  isForbiddenError,
  isNotFoundError,
} from '@/features/admin/admin-errors';
import { useWorld } from '@/features/worlds/query/use-world';
import { buttonClasses } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

import { WorldConfigEditor } from './world-config-editor';

export function WorldConfigTab({
  world,
  title = 'World Config',
  cancelTab = 'status',
  onDirtyChange,
  onNavigationReset,
}: {
  world: WorldResponse;
  title?: string;
  cancelTab?: 'overview' | 'status';
  onDirtyChange?: (dirty: boolean) => void;
  onNavigationReset?: (reset: () => void) => void;
}) {
  const worldQuery = useWorld(world.slug);

  if (worldQuery.isPending && worldQuery.data === undefined) {
    return <WorldConfigSkeleton />;
  }
  if (worldQuery.isError && worldQuery.data === undefined) {
    const notFound = isNotFoundError(worldQuery.error);
    return (
      <ErrorState
        title={notFound ? 'World not found' : 'Could not load this world'}
        message={
          notFound
            ? `World /${world.slug} not found.`
            : isForbiddenError(worldQuery.error)
              ? undefined
              : adminErrorMessage(worldQuery.error, 'World unavailable.')
        }
        forbidden={isForbiddenError(worldQuery.error)}
        onRetry={() => void worldQuery.refetch()}
      />
    );
  }
  if (worldQuery.data === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {worldQuery.isError ? (
        <QueryRefreshNotice
          message={
            isNotFoundError(worldQuery.error)
              ? `World /${world.slug} not found.`
              : 'World could not be refreshed.'
          }
          onRetry={() => void worldQuery.refetch()}
        />
      ) : null}
      <WorldConfigEditor
        world={worldQuery.data}
        title={title}
        cancelTab={cancelTab}
        onDirtyChange={onDirtyChange}
        onNavigationReset={onNavigationReset}
      />
    </div>
  );
}

function WorldConfigSkeleton() {
  return (
    <div
      aria-label="Loading World Config"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <Skeleton variant="text" className="h-8 w-64" />
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
    </div>
  );
}

function QueryRefreshNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"
    >
      <span>{message}</span>
      <button
        type="button"
        className={buttonClasses('outline', 'sm')}
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}
