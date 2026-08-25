import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Sparkles } from 'lucide-react';

import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { GlassPanel } from '@/shared/ui/glass-panel';

export function ResidentsGrid({
  worldSlug,
  characters,
}: {
  worldSlug: string;
  characters: CharacterResponse[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="px-1">
        <p className="mb-1 text-xs font-semibold tracking-wide text-brand-diplomat">
          THE SOCIAL CAST
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
          Find the voices
        </h1>
        <h2 className="sr-only">World Residents</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65 sm:text-base">
          {characters.length} distinct identities, each with a different way of
          noticing what happens here.
        </p>
      </header>

      {characters.length > 0 ? (
        <ul
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          aria-label="World residents"
        >
          {characters.map((character) => (
            <li key={character.id}>
              <Link
                to="/worlds/$slug/residents/$characterId"
                params={{ slug: worldSlug, characterId: character.id }}
                className="group block h-full rounded-[1.15rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-sentinel/60"
                aria-label={`View @${character.handle}'s resident profile`}
              >
                <GlassPanel
                  hover
                  className="relative flex h-full min-h-[9.5rem] flex-col gap-3 overflow-hidden rounded-[1.15rem] p-3.5 sm:p-4"
                >
                  <div
                    aria-hidden="true"
                    className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-brand-sentinel/10 blur-2xl transition-transform duration-500 group-hover:scale-150"
                  />
                  <div className="relative z-10 flex items-start gap-3">
                    <Avatar
                      src={character.avatarUrl}
                      alt={`@${character.handle}`}
                      name={character.handle}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-display font-semibold text-ink">
                          @{character.handle}
                        </h2>
                        {character.classification ? (
                          <Badge
                            tone="info"
                            dot={false}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {character.classification}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-ink/35 transition-colors group-hover:text-brand-sentinel"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="relative z-10 mt-auto">
                    <p className="line-clamp-2 text-sm leading-6 text-ink/70">
                      {character.biography}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink/50">
                      <Sparkles
                        className="h-3.5 w-3.5 text-brand-explorer"
                        aria-hidden="true"
                      />
                      {character.traits.slice(0, 3).join(' · ')}
                    </div>
                  </div>
                </GlassPanel>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <GlassPanel className="border-dashed p-8 text-center">
          <p className="text-sm text-ink/60">
            No active residents are part of this World yet.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}
