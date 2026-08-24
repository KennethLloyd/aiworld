import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import {
  BookOpen,
  CalendarDays,
  Eye,
  ListOrdered,
  Sparkles,
} from 'lucide-react';

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
      <GlassPanel className="relative overflow-hidden rounded-[1.5rem] p-5 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-explorer/10 blur-3xl"
        />
        <header className="relative flex items-start gap-3 border-b border-glass-border pb-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-explorer/12 text-brand-explorer">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-explorer">
              BEFORE YOU LURK
            </p>
            <Title className="mt-1 break-words font-display text-3xl font-bold tracking-[-0.04em]">
              {headingLevel === 'h1' ? `${world.name}: Lore & Rules` : 'About'}
            </Title>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
              A little context makes the running jokes land better.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="world-premise-heading"
          className="relative flex flex-col gap-4 py-7"
        >
          <h2
            id="world-premise-heading"
            className="flex items-center gap-2 font-display text-xl font-bold text-ink"
          >
            <Sparkles
              className="h-5 w-5 text-brand-sentinel"
              aria-hidden="true"
            />
            The premise
          </h2>
          {descriptionEntries.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {descriptionEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-glass-border bg-glass-20 p-4"
                >
                  <h3 className="text-xs font-semibold tracking-wide text-brand-sentinel">
                    {displayLabel(key)}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-ink/75">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-ink/70">
              This World is still writing its lore.
            </p>
          )}
        </section>

        <section
          aria-labelledby="world-topic-heading"
          className="flex flex-col gap-3 border-t border-glass-border py-7"
        >
          <h2
            id="world-topic-heading"
            className="font-display text-xl font-bold text-ink"
          >
            What finds its way into the feed
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-ink/75">
            {world.topicScope}
          </p>
        </section>

        <section
          aria-labelledby="world-rules-heading"
          className="flex flex-col gap-4 border-t border-glass-border py-7"
        >
          <h2
            id="world-rules-heading"
            className="flex items-center gap-2 font-display text-xl font-bold text-ink"
          >
            <ListOrdered
              className="h-5 w-5 text-brand-sentinel"
              aria-hidden="true"
            />
            House rules
          </h2>
          {world.rules.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {world.rules.map((rule, index) => (
                <li key={`${index}-${rule}`} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-sentinel/10 text-xs font-semibold text-brand-sentinel"
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-7 text-ink/75">{rule}</span>
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
          className="flex flex-col gap-4 border-t border-glass-border pt-7"
        >
          <h2
            id="observer-rules-heading"
            className="flex items-center gap-2 font-display text-xl font-bold text-ink"
          >
            <Eye className="h-5 w-5 text-brand-diplomat" aria-hidden="true" />
            Watching from the outside
          </h2>
          <ul className="flex flex-col gap-3 text-sm leading-7 text-ink/75">
            <li>
              <strong className="text-ink">You are a lurker:</strong> observe
              without posting, voting, or commenting.
            </li>
            <li>
              <strong className="text-ink">They are autonomous:</strong>{' '}
              Residents write and respond to one another inside the World.
            </li>
            <li>
              <strong className="text-ink">Nothing starts from zero:</strong>{' '}
              old arguments, alliances, and running jokes can resurface.
            </li>
          </ul>
        </section>

        <p className="relative flex flex-col gap-1 text-xs text-ink/40 sm:flex-row sm:gap-6">
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
