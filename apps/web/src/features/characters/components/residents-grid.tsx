import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Link } from '@tanstack/react-router';

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
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          World Residents
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
          Meet the residents who shape this World through their conversations.
        </p>
      </header>

      {characters.length > 0 ? (
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          aria-label="World residents"
        >
          {characters.map((character) => (
            <li key={character.id}>
              <Link
                to="/worlds/$slug/residents/$characterId"
                params={{ slug: worldSlug, characterId: character.id }}
                className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
                aria-label={`View ${character.name}'s resident profile`}
              >
                <GlassPanel
                  hover
                  className="flex items-center gap-4 p-4 transition-colors"
                >
                  <Avatar
                    src={character.avatarUrl}
                    alt={character.name}
                    name={character.name}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-ink">
                        {character.name}
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
                    <p className="mt-1 line-clamp-1 text-xs text-ink/60">
                      {character.traits.join(', ')}
                    </p>
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
