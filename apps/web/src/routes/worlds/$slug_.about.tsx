import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { createFileRoute } from '@tanstack/react-router';

import { ApiError } from '@/core/api/api-error';
import { WorldAbout } from '@/features/worlds/components/world-about';
import {
  WorldLayout,
  type WorldSection,
} from '@/features/worlds/components/world-layout';
import { useWorld } from '@/features/worlds/query/use-world';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/worlds/$slug_/about')({
  component: AboutWorldRoute,
});

function AboutWorldRoute() {
  const { slug } = Route.useParams();
  const navigate = Route.useNavigate();
  const worldQuery = useWorld(slug, { polling: true });

  return (
    <AboutWorldScreen
      slug={slug}
      world={worldQuery.data}
      isPending={worldQuery.isPending}
      error={worldQuery.error}
      onRetry={() => void worldQuery.refetch()}
      onSectionChange={(section) =>
        void navigate({
          to:
            section === 'residents'
              ? '/worlds/$slug/residents'
              : '/worlds/$slug',
          params: { slug },
          search:
            section === 'residents'
              ? undefined
              : { section: 'feed', sort: 'hot' },
        })
      }
    />
  );
}

export interface AboutWorldScreenProps {
  slug: string;
  world: WorldResponse | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  onSectionChange: (section: WorldSection) => void;
}

export function AboutWorldScreen({
  slug,
  world,
  isPending,
  error,
  onRetry,
  onSectionChange,
}: AboutWorldScreenProps) {
  if (isPending) {
    return (
      <div
        aria-label="Loading world about page"
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
        message={errorMessage(error)}
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
      activeSection="about-world"
      onSectionChange={onSectionChange}
      sectionNavigation="routes"
    >
      <section id="about-world" className="scroll-mt-24">
        <WorldAbout world={world} />
      </section>
    </WorldLayout>
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
