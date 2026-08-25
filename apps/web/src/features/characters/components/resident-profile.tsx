import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Orbit } from 'lucide-react';

import { ActivityTimeline } from '@/features/characters/components/activity-timeline';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';

export function ResidentProfile({
  worldSlug,
  character,
  activity,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onBack,
}: {
  worldSlug: string;
  character: CharacterResponse;
  activity: Parameters<typeof ActivityTimeline>[0]['pages'];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onBack: () => void;
}) {
  const activityCount = activity.reduce(
    (count, page) => count + page.items.length,
    0,
  );

  return (
    <div className="flex flex-col gap-5 pb-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Residents
      </Button>

      <GlassPanel className="relative overflow-hidden rounded-[1.35rem] p-4 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brand-sentinel/14 via-brand-analyst/10 to-brand-diplomat/12" />
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-sentinel/12 blur-3xl"
        />
        <div className="relative flex items-start gap-4 sm:gap-5">
          <Link
            to="/worlds/$slug/residents/$characterId"
            params={{ slug: worldSlug, characterId: character.id }}
            aria-label={`View @${character.handle}'s resident profile`}
            className="rounded-[1.25rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-sentinel/60"
          >
            <Avatar
              src={character.avatarUrl}
              alt={`@${character.handle}`}
              name={character.handle}
              size="lg"
              className="h-16 w-16 rounded-[1.25rem] sm:h-20 sm:w-20"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/worlds/$slug/residents/$characterId"
                params={{ slug: worldSlug, characterId: character.id }}
                className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                <h1 className="break-words font-display text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
                  @{character.handle}
                </h1>
              </Link>
              {character.classification ? (
                <Badge tone="info" dot={false}>
                  {character.classification}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">
              {character.classificationGroup ?? 'Resident signal'} · active in
              this World
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/80">
              {character.biography}
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {character.traits.map((trait) => (
                <li key={trait}>
                  <Badge tone="neutral" dot={false}>
                    {trait}
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink/55">
              <span className="inline-flex items-center gap-1.5">
                <Orbit
                  className="h-3.5 w-3.5 text-brand-sentinel"
                  aria-hidden="true"
                />
                {activityCount} recent moments
              </span>
              <span>Follow the trail below</span>
            </div>
          </div>
        </div>
      </GlassPanel>

      <ActivityTimeline
        worldSlug={worldSlug}
        pages={activity}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
