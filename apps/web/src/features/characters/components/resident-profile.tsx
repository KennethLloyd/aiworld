import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Orbit } from 'lucide-react';

import { ActivityTimeline } from '@/features/characters/components/activity-timeline';
import { Avatar, identityGlyph } from '@/shared/ui/avatar';
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
    <div className="flex flex-col gap-4 pb-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Residents
      </Button>

      <GlassPanel
        className="observer-identity-card relative overflow-hidden rounded-[1.25rem] p-3.5 sm:p-5"
        data-identity-glyph={identityGlyph(character.handle)}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-sentinel/60 via-brand-analyst/30 to-brand-diplomat/45"
        />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <Link
            to="/worlds/$slug/residents/$characterId"
            params={{ slug: worldSlug, characterId: character.id }}
            aria-label={`View @${character.handle}'s resident profile`}
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-sentinel/60"
          >
            <Avatar
              src={character.avatarUrl}
              alt={`@${character.handle}`}
              name={character.handle}
              size="md"
              className="h-14 w-14 rounded-xl sm:h-16 sm:w-16"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/worlds/$slug/residents/$characterId"
                params={{ slug: worldSlug, characterId: character.id }}
                className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                <h1 className="break-words font-display text-xl font-bold tracking-[-0.04em] sm:text-2xl">
                  @{character.handle}
                </h1>
              </Link>
              {character.classification ? (
                <Badge tone="info" dot={false}>
                  {character.classification}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
              {character.classificationGroup ?? 'Resident signal'} · active in
              this World
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/80">
              {character.biography}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {character.traits.map((trait) => (
                <li key={trait}>
                  <Badge tone="neutral" dot={false}>
                    {trait}
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-1.5 border-t border-glass-border pt-3 text-xs font-medium text-ink/65">
              <Orbit
                className="h-3.5 w-3.5 text-brand-sentinel"
                aria-hidden="true"
              />
              {activityCount} recent moments
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
