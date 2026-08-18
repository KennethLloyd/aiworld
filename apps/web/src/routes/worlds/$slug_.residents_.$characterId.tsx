import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import {
  createFileRoute,
  useCanGoBack,
  useRouter,
} from '@tanstack/react-router';

import { ApiError } from '@/core/api/api-error';
import { ResidentProfile } from '@/features/characters/components/resident-profile';
import { useCharacter } from '@/features/characters/query/use-character';
import { useCharacterActivity } from '@/features/characters/query/use-character-activity';
import {
  WorldLayout,
  type WorldSection,
} from '@/features/worlds/components/world-layout';
import { useWorld } from '@/features/worlds/query/use-world';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/worlds/$slug_/residents_/$characterId')({
  component: ResidentProfileRoute,
});

function ResidentProfileRoute() {
  const { slug, characterId } = Route.useParams();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const worldQuery = useWorld(slug, { polling: true });
  const characterQuery = useCharacter(characterId);
  const activityQuery = useCharacterActivity(slug, characterId);

  const handleBack = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({
      to: '/worlds/$slug/residents',
      params: { slug },
    });
  };

  return (
    <ResidentProfileScreen
      slug={slug}
      world={worldQuery.data}
      character={characterQuery.data}
      activity={activityQuery.data?.pages}
      worldPending={worldQuery.isPending}
      characterPending={characterQuery.isPending}
      activityPending={activityQuery.isPending}
      worldError={worldQuery.error}
      characterError={characterQuery.error}
      activityError={activityQuery.error}
      hasNextPage={activityQuery.hasNextPage}
      isFetchingNextPage={activityQuery.isFetchingNextPage}
      onLoadMore={() => void activityQuery.fetchNextPage()}
      onRetry={() => {
        void worldQuery.refetch();
        void characterQuery.refetch();
        void activityQuery.refetch();
      }}
      onBack={handleBack}
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

export interface ResidentProfileScreenProps {
  slug: string;
  world: WorldResponse | undefined;
  character: CharacterResponse | undefined;
  activity:
    | {
        items: Parameters<
          typeof ResidentProfile
        >[0]['activity'][number]['items'];
      }[]
    | undefined;
  worldPending: boolean;
  characterPending: boolean;
  activityPending: boolean;
  worldError: unknown;
  characterError: unknown;
  activityError: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onBack: () => void;
  onSectionChange: (section: WorldSection) => void;
}

export function ResidentProfileScreen({
  slug,
  world,
  character,
  activity,
  worldPending,
  characterPending,
  activityPending,
  worldError,
  characterError,
  activityError,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  onBack,
  onSectionChange,
}: ResidentProfileScreenProps) {
  if (worldPending || characterPending || activityPending) {
    return <ProfileSkeleton />;
  }

  if (worldError instanceof ApiError && worldError.status === 404) {
    return <ErrorState title="World not found" onRetry={onRetry} />;
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
  if (characterError instanceof ApiError && characterError.status === 404) {
    return <ErrorState title="Resident not found" onRetry={onRetry} />;
  }
  if (characterError !== null && characterError !== undefined) {
    return (
      <ErrorState
        title="Could not load this resident"
        message={errorMessage(characterError)}
        onRetry={onRetry}
      />
    );
  }
  if (activityError !== null && activityError !== undefined) {
    return (
      <ErrorState
        title="Could not load resident activity"
        message={errorMessage(activityError)}
        onRetry={onRetry}
      />
    );
  }
  if (
    world === undefined ||
    character === undefined ||
    activity === undefined
  ) {
    return null;
  }

  return (
    <WorldLayout
      world={world}
      activeSection="residents"
      onSectionChange={onSectionChange}
      sectionNavigation="routes"
    >
      <ResidentProfile
        worldSlug={slug}
        character={character}
        activity={activity}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
        onBack={onBack}
      />
    </WorldLayout>
  );
}

function ProfileSkeleton() {
  return (
    <div
      aria-label="Loading resident profile"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <Skeleton variant="text" className="h-8 w-24" />
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
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
