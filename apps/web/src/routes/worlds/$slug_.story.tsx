import type { WorldNarrativeResponse } from '@aiworld/shared/schemas/world-narrative-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { createFileRoute } from '@tanstack/react-router';

import { ApiError } from '@/core/api/api-error';
import {
  WorldLayout,
  type WorldSection,
} from '@/features/worlds/components/world-layout';
import { WorldStory } from '@/features/worlds/components/world-story';
import { useWorld } from '@/features/worlds/query/use-world';
import { useWorldNarrative } from '@/features/worlds/query/use-world-narrative';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/worlds/$slug_/story')({
  component: StoryRoute,
});

function StoryRoute() {
  const { slug } = Route.useParams();
  const navigate = Route.useNavigate();
  const worldQuery = useWorld(slug);
  const narrativeQuery = useWorldNarrative(slug);

  return (
    <StoryScreen
      slug={slug}
      world={worldQuery.data}
      narrative={narrativeQuery.data}
      worldPending={worldQuery.isPending}
      narrativePending={narrativeQuery.isPending}
      worldError={worldQuery.error}
      narrativeError={narrativeQuery.error}
      onRetry={() => {
        void worldQuery.refetch();
        void narrativeQuery.refetch();
      }}
      onNarrativeRetry={() => void narrativeQuery.refetch()}
      onSectionChange={(section) => {
        if (section === 'feed') {
          void navigate({
            to: '/worlds/$slug',
            params: { slug },
            search: { section: 'feed', sort: 'hot' },
          });
        } else if (section === 'residents') {
          void navigate({ to: '/worlds/$slug/residents', params: { slug } });
        } else if (section === 'about-world') {
          void navigate({ to: '/worlds/$slug/about', params: { slug } });
        }
      }}
    />
  );
}

export interface StoryScreenProps {
  slug: string;
  world: WorldResponse | undefined;
  narrative: WorldNarrativeResponse | undefined;
  worldPending: boolean;
  narrativePending: boolean;
  worldError: unknown;
  narrativeError: unknown;
  onRetry: () => void;
  onNarrativeRetry: () => void;
  onSectionChange: (section: WorldSection) => void;
}

export function StoryScreen({
  slug,
  world,
  narrative,
  worldPending,
  narrativePending,
  worldError,
  narrativeError,
  onRetry,
  onNarrativeRetry,
  onSectionChange,
}: StoryScreenProps) {
  if (worldPending) {
    return (
      <div
        aria-label="Loading world story"
        aria-busy="true"
        className="flex flex-col gap-6"
      >
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="detail" />
      </div>
    );
  }
  if (worldError instanceof ApiError && worldError.status === 404) {
    return (
      <ErrorState
        title="World not found"
        message={`No world matches "${slug}".`}
        onRetry={onRetry}
      />
    );
  }
  if (worldError !== null && worldError !== undefined) {
    return <ErrorState title="Could not load this world" onRetry={onRetry} />;
  }
  if (world === undefined) return null;

  return (
    <WorldLayout
      world={world}
      activeSection="story"
      onSectionChange={onSectionChange}
      sectionNavigation="routes"
    >
      <section aria-labelledby="story-so-far-heading">
        {narrativePending ? (
          <div
            aria-label="Loading Story So Far"
            aria-busy="true"
            className="glass-panel p-7"
          >
            <Skeleton variant="text" className="h-8 w-56" />
            <Skeleton variant="detail" className="mt-6" />
          </div>
        ) : narrativeError !== null && narrativeError !== undefined ? (
          <ErrorState
            title="Could not load Story So Far"
            message={errorMessage(narrativeError)}
            onRetry={onNarrativeRetry}
          />
        ) : narrative === undefined ? null : (
          <WorldStory narrative={narrative} />
        )}
      </section>
    </WorldLayout>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.toUserMessage();
  if (error instanceof Error) return error.message;
  return 'Something went wrong while loading this story.';
}
