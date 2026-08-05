import type { WorldResponse } from '@aiworld/shared';
import { CalendarDays, Compass, ListOrdered } from 'lucide-react';

import { GlassPanel } from '@/shared/ui/glass-panel';

import { WorldStatusBadge } from './world-status-badge';

/**
 * Public /worlds/:slug content body: title + status badge, topicScope callout,
 * structured description sections, an ordered rules checklist, and formatted
 * created/updated dates. Presentational - the route owns the query and the
 * loading/error/404 states.
 */
export function WorldDetail({ world }: { world: WorldResponse }) {
  const descriptionEntries = Object.entries(world.description ?? {});
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {world.name}
          </h1>
          <WorldStatusBadge isActive={world.isActive} />
        </div>
        <p className="font-mono text-xs text-ink/50">/worlds/{world.slug}</p>
      </header>

      <GlassPanel className="flex items-start gap-3 border-brand-sentinel/30 p-5">
        <Compass
          className="mt-0.5 h-5 w-5 shrink-0 text-brand-sentinel"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/60">
            Topic scope
          </h2>
          <p className="text-sm leading-relaxed text-ink/85">
            {world.topicScope}
          </p>
        </div>
      </GlassPanel>

      {descriptionEntries.length > 0 ? (
        <GlassPanel as="section" className="flex flex-col gap-4 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/60">
            Description
          </h2>
          {descriptionEntries.map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-brand-analyst">
                {displayLabel(key)}
              </h3>
              <p className="text-sm leading-relaxed text-ink/80">{value}</p>
            </div>
          ))}
        </GlassPanel>
      ) : null}

      {world.rules.length > 0 ? (
        <GlassPanel as="section" className="flex flex-col gap-4 p-5">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink/60">
            <ListOrdered className="h-4 w-4" aria-hidden="true" />
            Rules
          </h2>
          <ol className="flex flex-col gap-2">
            {world.rules.map((rule, index) => (
              <li key={index} className="flex items-start gap-3">
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
        </GlassPanel>
      ) : null}

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
    </article>
  );
}

/**
 * Display labels for structured description keys: "about" -> "About",
 * "long_description" -> "Long Description". Keys are presentation labels, not
 * raw JSON property names.
 */
function displayLabel(key: string): string {
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
