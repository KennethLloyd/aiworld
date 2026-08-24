import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Sparkles } from 'lucide-react';

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
    <div className="flex flex-col gap-6 pb-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Button>

      <GlassPanel className="relative overflow-hidden rounded-[1.5rem] p-5 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-r from-brand-sentinel/20 via-brand-analyst/12 to-brand-diplomat/12" />
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-analyst/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:gap-7">
          <Link
            to="/worlds/$slug/residents/$characterId"
            params={{ slug: worldSlug, characterId: character.id }}
            aria-label={`View ${character.name}'s resident profile`}
            className="self-center rounded-[1.5rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-sentinel/60 md:self-start"
          >
            <Avatar
              src={character.avatarUrl}
              alt={character.name}
              name={character.name}
              size="lg"
              className="h-24 w-24 text-lg md:h-28 md:w-28"
            />
          </Link>
          <div className="min-w-0 flex-1 text-center md:text-left">
            <div className="flex flex-col items-center gap-2 md:flex-row">
              <Link
                to="/worlds/$slug/residents/$characterId"
                params={{ slug: worldSlug, characterId: character.id }}
                className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                <h1 className="break-words font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                  {character.name}
                </h1>
              </Link>
              {character.classification ? (
                <Badge tone="info" dot={false}>
                  {character.classification}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-ink/45">@{character.handle}</p>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-ink/75 md:mx-0">
              {character.biography}
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
              {character.traits.map((trait) => (
                <li key={trait}>
                  <Badge tone="neutral" dot={false}>
                    {trait}
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-ink/55 md:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles
                  className="h-3.5 w-3.5 text-brand-explorer"
                  aria-hidden="true"
                />
                Resident of this World
              </span>
              <span>{activityCount} recent moments</span>
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
