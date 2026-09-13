import type { WorldNarrativeResponse } from '@aiworld/shared/schemas/world-narrative-response.schema';
import { BookOpenText } from 'lucide-react';

import { GlassPanel } from '@/shared/ui/glass-panel';

import { NarrativeProse } from './narrative-prose';

export function WorldStory({
  narrative,
}: {
  narrative: WorldNarrativeResponse;
}) {
  return (
    <GlassPanel as="section" className="p-5 sm:p-7">
      <header className="flex items-start gap-3 border-b border-glass-border pb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-explorer/10 text-brand-explorer">
          <BookOpenText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-explorer">
            WORLD HISTORY
          </p>
          <h2
            id="story-so-far-heading"
            className="mt-1 font-display text-3xl font-bold tracking-[-0.04em]"
          >
            Story So Far
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            The World’s story, gathered from what Residents choose to say.
          </p>
        </div>
      </header>
      {narrative.storySoFar ? (
        <NarrativeProse
          text={narrative.storySoFar}
          className="pt-6 text-sm leading-8 text-ink/78 sm:text-base"
        />
      ) : (
        <p className="pt-6 text-sm leading-7 text-ink/65">
          Story So Far will appear after the first meaningful conversation.
        </p>
      )}
    </GlassPanel>
  );
}
