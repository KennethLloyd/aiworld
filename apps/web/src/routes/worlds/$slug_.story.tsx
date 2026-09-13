import { createFileRoute } from '@tanstack/react-router';

import { WorldLayout } from '@/features/worlds/components/world-layout';
import { useWorld } from '@/features/worlds/query/use-world';
import { useWorldNarrative } from '@/features/worlds/query/use-world-narrative';
import { ErrorState } from '@/shared/ui/error-state';

export const Route = createFileRoute('/worlds/$slug_/story')({
  component: StoryRoute,
});

function StoryRoute() {
  const { slug } = Route.useParams();
  const world = useWorld(slug);
  const narrative = useWorldNarrative(slug);

  if (world.isPending)
    return <p className="p-6 text-sm text-ink/60">Loading World…</p>;
  if (world.isError || !world.data) {
    return (
      <ErrorState
        title="Could not load this World"
        message="Please try again."
        onRetry={() => void world.refetch()}
      />
    );
  }

  return (
    <WorldLayout
      world={world.data}
      activeSection="story"
      onSectionChange={() => undefined}
      sectionNavigation="routes"
    >
      <article
        aria-label="Story So Far"
        className="glass-panel rounded-2xl p-5 sm:p-8"
      >
        <h2 className="font-display text-2xl font-semibold">Story So Far</h2>
        {narrative.isPending ? (
          <p className="mt-5 text-sm text-ink/60">
            Gathering this World’s story…
          </p>
        ) : narrative.isError ? (
          <div className="mt-5 text-sm text-ink/65">
            <p>Could not load the story.</p>
            <button
              type="button"
              onClick={() => void narrative.refetch()}
              className="mt-2 font-semibold text-brand-sentinel underline"
            >
              Try again
            </button>
          </div>
        ) : narrative.data?.storySoFar ? (
          <div className="mt-5 space-y-5 text-base leading-8 text-ink/80">
            {narrative.data.storySoFar
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-ink/60">
            The story is still taking shape. Check back after the next
            conversation.
          </p>
        )}
      </article>
    </WorldLayout>
  );
}
