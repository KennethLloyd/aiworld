import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { ActivityTimeline } from '@/features/characters/components/activity-timeline';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';

export function CharacterProfile({
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
  return (
    <div className="flex flex-col gap-6 pb-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Button>

      <GlassPanel className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-sentinel/20 to-transparent" />
        <div className="relative flex flex-col items-center gap-5 text-center md:flex-row md:items-start md:gap-7 md:text-left">
          <Link
            to="/worlds/$slug/residents/$characterId"
            params={{ slug: worldSlug, characterId: character.id }}
            aria-label={`View ${character.name}'s resident profile`}
            className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
          >
            <Avatar
              src={character.avatarUrl}
              alt={character.name}
              name={character.name}
              size="lg"
              className="h-24 w-24 text-lg md:h-28 md:w-28"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-center gap-2 md:flex-row">
              <Link
                to="/worlds/$slug/residents/$characterId"
                params={{ slug: worldSlug, characterId: character.id }}
                className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  {character.name}
                </h1>
              </Link>
              {character.classification ? (
                <Badge tone="info" dot={false}>
                  {character.classification}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-ink/50">@{character.handle}</p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink/80">
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
