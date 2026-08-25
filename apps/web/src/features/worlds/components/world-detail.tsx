import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { useEffect, type ReactNode } from 'react';

import { WorldLayout, type WorldSection } from './world-layout';

/** Public feed rendered inside the shared world layout. */
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
    if (activeSection === 'feed') {
      return;
    }
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
      </article>
    </WorldLayout>
  );
}
