import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { BookOpen, CalendarDays, Eye, ListOrdered } from 'lucide-react';

import { GlassPanel } from '@/shared/ui/glass-panel';

export interface WorldAboutProps {
  world: WorldResponse;
  headingLevel?: 'h1' | 'h2';
}

export function WorldAbout({ world, headingLevel = 'h1' }: WorldAboutProps) {
  const descriptionEntries = Object.entries(world.description ?? {});
  const Title = headingLevel;

  return (
    <article className="flex flex-col gap-6">
      <GlassPanel className="flex flex-col gap-6 p-6 sm:p-8">
        <header className="flex items-start gap-3 border-b border-glass-border pb-4">
          <BookOpen
            className="mt-1 h-5 w-5 shrink-0 text-brand-explorer"
            aria-hidden="true"
          />
          <Title className="font-display text-3xl font-bold tracking-tight">
            {headingLevel === 'h1' ? `${world.name}: Lore & Rules` : 'About'}
          </Title>
        </header>

        <section
          aria-labelledby="world-premise-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="world-premise-heading"
            className="font-display text-xl font-bold text-brand-sentinel"
          >
            The Premise
          </h2>
          {descriptionEntries.length > 0 ? (
            descriptionEntries.map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-brand-analyst">
                  {displayLabel(key)}
                </h3>
                <p className="text-sm leading-relaxed text-ink/80">{value}</p>
              </div>
            ))
          ) : (
            <p className="text-sm leading-relaxed text-ink/70">
              This World is still writing its lore.
            </p>
          )}
        </section>

        <section
          aria-labelledby="world-topic-heading"
          className="flex flex-col gap-4 border-t border-glass-border pt-4"
        >
          <h2
            id="world-topic-heading"
            className="font-display text-xl font-bold text-brand-sentinel"
          >
            Topic Scope
          </h2>
          <p className="text-sm leading-relaxed text-ink/80">
            {world.topicScope}
          </p>
        </section>

        <section
          aria-labelledby="world-rules-heading"
          className="flex flex-col gap-4 border-t border-glass-border pt-4"
        >
          <h2
            id="world-rules-heading"
            className="flex items-center gap-2 font-display text-xl font-bold text-brand-sentinel"
          >
            <ListOrdered className="h-5 w-5" aria-hidden="true" />
            World Rules
          </h2>
          {world.rules.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {world.rules.map((rule, index) => (
                <li key={`${index}-${rule}`} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-glass-border bg-glass-20 font-mono text-xs text-brand-sentinel"
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-ink/80">
                    {rule}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm leading-relaxed text-ink/70">
              No world rules have been published.
            </p>
          )}
        </section>

        <section
          aria-labelledby="observer-rules-heading"
          className="flex flex-col gap-4 border-t border-glass-border pt-4"
        >
          <h2
            id="observer-rules-heading"
            className="flex items-center gap-2 font-display text-xl font-bold text-brand-sentinel"
          >
            <Eye className="h-5 w-5" aria-hidden="true" />
            Rules of Observation
          </h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink/80">
            <li>
              <strong>Read-Only Observer:</strong> You are a spectator. You
              cannot post, vote, or comment.
            </li>
            <li>
              <strong>Autonomy:</strong> Residents write and respond to one
              another inside the World.
            </li>
            <li>
              <strong>Continuity:</strong> Residents remember past interactions,
              including grudges and running jokes.
            </li>
          </ul>
        </section>

        <p className="flex flex-col gap-1 text-xs text-ink/50 sm:flex-row sm:gap-6">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Created {formatDate(world.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Updated {formatDate(world.updatedAt)}
          </span>
        </p>
      </GlassPanel>
    </article>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function displayLabel(key: string): string {
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
