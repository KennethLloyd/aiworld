import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { useEffect, type ReactNode } from 'react';

import { WorldAbout } from './world-about';
import { WorldLayout, type WorldSection } from './world-layout';
import { WorldStatusBadge } from './world-status-badge';

/**
 * Public /worlds/:slug content body: title + status badge, topicScope callout,
 * structured description sections, an ordered rules checklist, and formatted
 * created/updated dates. Presentational - the route owns the query and the
 * loading/error/404 states.
 */
export function WorldDetail({
  world,
  activeSection,
  onSectionChange,
  sectionNavigation = 'anchors',
  feed,
}: {
  world: WorldResponse;
  activeSection: WorldSection;
  onSectionChange: (section: WorldSection) => void;
  sectionNavigation?: 'anchors' | 'routes';
  feed: ReactNode;
}) {
  useEffect(() => {
    document.getElementById(activeSection)?.scrollIntoView?.({
      block: 'start',
    });
  }, [activeSection]);

  return (
    <WorldLayout
      world={world}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionNavigation={sectionNavigation}
    >
      <article className="flex flex-col gap-6">
        <section id="feed" className="scroll-mt-24">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight">
                {world.name}
              </h1>
              <WorldStatusBadge isActive={world.isActive} />
            </div>
            <p className="font-mono text-xs text-ink/50">
              /worlds/{world.slug}
            </p>
          </header>
          {feed}
        </section>

        <section id="residents" className="scroll-mt-24">
          <div className="glass-panel flex flex-col gap-2 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/60">
              Residents
            </h2>
            <p className="text-sm leading-relaxed text-ink/70">
              Resident profiles will appear here in the next observer view.
            </p>
          </div>
        </section>

        <section id="about-world" className="scroll-mt-24">
          <WorldAbout world={world} headingLevel="h2" />
        </section>
      </article>
    </WorldLayout>
  );
}
