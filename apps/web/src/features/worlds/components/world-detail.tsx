import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { useEffect, type ReactNode } from 'react';

import { WorldAbout } from './world-about';
import { WorldLayout, type WorldSection } from './world-layout';

/** Compact public feed and structured About content. */
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
