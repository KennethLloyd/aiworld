import { useLayoutEffect, useRef, useState } from 'react';

import { NarrativeProse } from '@/features/worlds/components/narrative-prose';
import { useWorldNarrative } from '@/features/worlds/query/use-world-narrative';
import { GlassPanel } from '@/shared/ui/glass-panel';

export function RecentEvents({ slug }: { slug: string }) {
  const { data, isPending, isError, refetch } = useWorldNarrative(slug);

  return (
    <GlassPanel className="p-4 sm:p-5" aria-label="Recent Events">
      <h2 className="font-display text-lg font-semibold">Recent Events</h2>
      {isPending ? (
        <p className="mt-2 text-sm text-ink/60">Catching up on this World…</p>
      ) : isError ? (
        <div className="mt-2 text-sm text-ink/65">
          <p>Could not load Recent Events.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-1 font-semibold text-brand-sentinel underline"
          >
            Try again
          </button>
        </div>
      ) : data?.recentEvents ? (
        <RecentEventsText key={data.recentEvents} text={data.recentEvents} />
      ) : (
        <p className="mt-2 text-sm text-ink/60">
          The story is still taking shape. Check back after the next
          conversation.
        </p>
      )}
    </GlassPanel>
  );
}

function RecentEventsText({ text }: { text: string }) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph || expanded) return;

    const measure = () => {
      setIsTruncated(paragraph.scrollHeight > paragraph.clientHeight + 1);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(paragraph.parentElement ?? paragraph);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <>
      <p
        ref={paragraphRef}
        className={`mt-2 text-sm leading-6 text-ink/80 ${expanded ? '' : 'line-clamp-3 md:line-clamp-none'}`}
      >
        <NarrativeProse text={text} />
      </p>
      {(expanded || isTruncated) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-semibold text-brand-sentinel underline md:hidden"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </>
  );
}
