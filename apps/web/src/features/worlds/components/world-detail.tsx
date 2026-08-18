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

        <section id="about-world" className="scroll-mt-24">
          <WorldAbout world={world} headingLevel="h2" />
        </section>
      </article>
    </WorldLayout>
  );
}
