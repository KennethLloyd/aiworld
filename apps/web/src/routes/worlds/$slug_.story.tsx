import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { createFileRoute } from '@tanstack/react-router';

import { ApiError } from '@/core/api/api-error';
import { StorySoFar } from '@/features/worlds/components/story-so-far';
import {
  WorldLayout,
  type WorldSection,
} from '@/features/worlds/components/world-layout';
import { useWorld } from '@/features/worlds/query/use-world';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/worlds/$slug_/story')({
  component: StoryRoute,
});

function StoryRoute() {
  const { slug } = Route.useParams();
  const navigate = Route.useNavigate();
  const worldQuery = useWorld(slug);

  return (
    <StoryScreen
      slug={slug}
      world={worldQuery.data}
      isPending={worldQuery.isPending}
      error={worldQuery.error}
      onRetry={() => void worldQuery.refetch()}
      onSectionChange={(section) =>
        void navigate({
          to:
            section === 'feed'
              ? '/worlds/$slug'
              : section === 'residents'
                ? '/worlds/$slug/residents'
                : section === 'about-world'
                  ? '/worlds/$slug/about'
                  : '/worlds/$slug/story',
          params: { slug },
          search:
            section === 'feed' ? { section: 'feed', sort: 'hot' } : undefined,
        })
      }
    />
  );
}

export interface StoryScreenProps {
  slug: string;
  world: WorldResponse | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  onSectionChange: (section: WorldSection) => void;
}

export function StoryScreen({
  slug,
  world,
  isPending,
  error,
  onRetry,
  onSectionChange,
}: StoryScreenProps) {
  if (isPending) {
    return (
      <div
        aria-label="Loading Story So Far"
        aria-busy="true"
        className="flex flex-col gap-6"
      >
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="detail" />
      </div>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <ErrorState
        title="World not found"
        message={`No world matches "${slug}".`}
        onRetry={onRetry}
      />
    );
  }
  if (error !== null && error !== undefined) {
    return (
      <ErrorState
        title="Could not load this world"
        message={
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading this content.'
        }
        onRetry={onRetry}
      />
    );
  }
  if (world === undefined) {
    return null;
  }
  return (
    <WorldLayout
      world={world}
      activeSection="story"
      onSectionChange={onSectionChange}
      sectionNavigation="routes"
    >
      <section aria-label="Story So Far">
        <StorySoFar slug={slug} />
      </section>
    </WorldLayout>
  );
}
