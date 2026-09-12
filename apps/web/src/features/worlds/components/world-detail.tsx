import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { useEffect, type ReactNode } from 'react';

import { RecentEventsCard } from './recent-events-card';
import { WorldLayout, type WorldSection } from './world-layout';

/** Public feed rendered inside the shared world layout. */
export function WorldDetail({
  world,
  activeSection,
  onSectionChange,
  sectionNavigation = 'anchors',
  feed,
  recentEvents,
  recentEventsPending,
  recentEventsErrorMessage,
  onRecentEventsRetry,
}: {
  world: WorldResponse;
  activeSection: WorldSection;
  onSectionChange: (section: WorldSection) => void;
  sectionNavigation?: 'anchors' | 'routes';
  feed: ReactNode;
  recentEvents?: string | null;
  recentEventsPending?: boolean;
  recentEventsErrorMessage?: string;
  onRecentEventsRetry?: () => void;
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
        <RecentEventsCard
          recentEvents={recentEvents}
          isPending={recentEventsPending ?? false}
          errorMessage={recentEventsErrorMessage}
          onRetry={onRecentEventsRetry}
        />
        <section id="feed" className="scroll-mt-24">
          {feed}
        </section>
      </article>
    </WorldLayout>
  );
}
