import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { createFileRoute } from '@tanstack/react-router';

import { ApiError } from '@/core/api/api-error';
import { ResidentsGrid } from '@/features/characters/components/residents-grid';
import { useCharacters } from '@/features/characters/query/use-characters';
import {
  WorldLayout,
  type WorldSection,
} from '@/features/worlds/components/world-layout';
import { useWorld } from '@/features/worlds/query/use-world';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/worlds/$slug_/residents')({
  component: ResidentsRoute,
});

function ResidentsRoute() {
  const { slug } = Route.useParams();
  const navigate = Route.useNavigate();
  const worldQuery = useWorld(slug, { polling: true });
  const charactersQuery = useCharacters(slug);

  return (
    <ResidentsScreen
      slug={slug}
      world={worldQuery.data}
      characters={charactersQuery.data?.items}
      worldPending={worldQuery.isPending}
      charactersPending={charactersQuery.isPending}
      worldError={worldQuery.error}
      charactersError={charactersQuery.error}
      onRetry={() => {
        void worldQuery.refetch();
        void charactersQuery.refetch();
      }}
      onSectionChange={(section) =>
        void navigate({
          to: '/worlds/$slug',
          params: { slug },
          search: { section, sort: 'hot' },
        })
      }
    />
  );
}

export interface ResidentsScreenProps {
  slug: string;
  world: WorldResponse | undefined;
  characters: CharacterResponse[] | undefined;
  worldPending: boolean;
  charactersPending: boolean;
  worldError: unknown;
  charactersError: unknown;
  onRetry: () => void;
  onSectionChange: (section: WorldSection) => void;
}

export function ResidentsScreen({
  slug,
  world,
  characters,
  worldPending,
  charactersPending,
  worldError,
  charactersError,
  onRetry,
  onSectionChange,
}: ResidentsScreenProps) {
  if (worldPending || charactersPending) {
    return <ResidentsSkeleton />;
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
    return (
      <ErrorState
        title="Could not load this world"
        message={errorMessage(worldError)}
        onRetry={onRetry}
      />
    );
  }

  if (charactersError !== null && charactersError !== undefined) {
    return (
      <ErrorState
        title="Could not load residents"
        message={errorMessage(charactersError)}
        onRetry={onRetry}
      />
    );
  }

  if (world === undefined || characters === undefined) {
    return null;
  }

  return (
    <WorldLayout
      world={world}
      activeSection="residents"
      onSectionChange={onSectionChange}
    >
      <section id="residents" className="scroll-mt-24">
        <ResidentsGrid worldSlug={slug} characters={characters} />
      </section>
    </WorldLayout>
  );
}

function ResidentsSkeleton() {
  return (
    <div
      aria-label="Loading residents"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <Skeleton variant="text" className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton variant="detail" />
        <Skeleton variant="detail" />
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
