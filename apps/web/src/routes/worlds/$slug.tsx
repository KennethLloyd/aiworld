import {
  postSortSchema,
  type PostSort,
} from '@aiworld/shared/schemas/post.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Globe } from 'lucide-react';
import { z } from 'zod';

import { ApiError } from '@/core/api/api-error';
import { WorldFeed } from '@/features/posts/components/world-feed';
import { publicListWorldsDefaults } from '@/features/worlds/api/world-gateway';
import { WorldDetail } from '@/features/worlds/components/world-detail';
import type { WorldSection } from '@/features/worlds/components/world-layout';
import { useWorld } from '@/features/worlds/query/use-world';
import { buttonClasses } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

const worldDetailSearchSchema = z.object({
  section: z.enum(['feed', 'residents', 'about-world']).optional(),
  sort: postSortSchema.default('hot'),
});

export const Route = createFileRoute('/worlds/$slug')({
  validateSearch: (input) => worldDetailSearchSchema.parse(input),
  beforeLoad: ({ params, search }) => {
    if (search.section === 'residents') {
      throw redirect({
        to: '/worlds/$slug/residents',
        params: { slug: params.slug },
        replace: true,
      });
    }
    if (search.section === 'about-world') {
      throw redirect({
        to: '/worlds/$slug/about',
        params: { slug: params.slug },
        replace: true,
      });
    }
  },
  component: WorldDetailRoute,
});

function WorldDetailRoute() {
  const { slug } = Route.useParams();
  const { section, sort } = Route.useSearch();
  const navigate = Route.useNavigate();
  const worldQuery = useWorld(slug, { polling: true });
  return (
    <WorldDetailScreen
      slug={slug}
      sort={sort}
      activeSection={section ?? 'feed'}
      onSectionChange={(nextSection) =>
        void navigate({
          search: (previous) => ({
            ...previous,
            section: nextSection,
          }),
        })
      }
      onSortChange={(nextSort) =>
        void navigate({
          search: (previous) => ({ ...previous, sort: nextSort }),
        })
      }
      data={worldQuery.data}
      isPending={worldQuery.isPending}
      isError={worldQuery.isError}
      error={worldQuery.error}
      onRetry={() => void worldQuery.refetch()}
    />
  );
}

export interface WorldDetailScreenProps {
  slug: string;
  sort: PostSort;
  activeSection: WorldSection;
  onSectionChange: (section: WorldSection) => void;
  onSortChange: (sort: PostSort) => void;
  data: WorldResponse | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/**
 * State switch for the public detail screen: skeleton while loading, the 404
 * visual for ApiError(404), ErrorState + retry for anything else, and the
 * WorldDetail body on success. Exported so route states are unit-testable
 * without the router.
 */
export function WorldDetailScreen({
  slug,
  sort,
  activeSection,
  onSectionChange,
  onSortChange,
  data,
  isPending,
  isError,
  error,
  onRetry,
}: WorldDetailScreenProps) {
  if (isPending) {
    return <WorldDetailSkeleton />;
  }
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <WorldNotFound slug={slug} />;
    }
    return (
      <ErrorState
        title="Could not load this world"
        message={errorMessage(error)}
        onRetry={onRetry}
      />
    );
  }
  if (data === undefined) {
    // Unreachable: a settled query with no error always has data, but keep
    // the switch total for type safety.
    return null;
  }
  return (
    <WorldDetail
      world={data}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionNavigation="routes"
      feed={
        <WorldFeed
          slug={data.slug}
          worldName={data.name}
          sort={sort}
          onSortChange={onSortChange}
        />
      }
    />
  );
}

function WorldDetailSkeleton() {
  return (
    <div
      aria-label="Loading world"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <Skeleton variant="text" className="h-8 w-64" />
      <Skeleton variant="text" className="h-4 w-40" />
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
    </div>
  );
}

/** The not-found visual, mirroring the shared 404 page language. */
function WorldNotFound({ slug }: { slug: string }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <GlassPanel className="w-full max-w-md p-10 text-center">
        <Globe
          className="mx-auto h-10 w-10 text-brand-explorer"
          aria-hidden="true"
        />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.35em] text-brand-explorer">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          World not found
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/70">
          No world matches &quot;{slug}&quot; - it may have been renamed or
          removed.
        </p>
        <div className="mt-8">
          <Link
            to="/worlds"
            search={publicListWorldsDefaults}
            className={buttonClasses('primary', 'md')}
          >
            Back to worlds
          </Link>
        </div>
      </GlassPanel>
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
  return 'Something went wrong while loading this world.';
}
