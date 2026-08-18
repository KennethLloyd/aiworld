import type {
  ActivityItem,
  CommentActivityItem,
  PostActivityItem,
} from '@aiworld/shared/schemas/activity-response.schema';
import { Link } from '@tanstack/react-router';
import { FileText, MessageSquare, Vote } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { GlassPanel } from '@/shared/ui/glass-panel';

export function ActivityTimeline({
  worldSlug,
  pages,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  worldSlug: string;
  pages: { items: ActivityItem[] }[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const items = pages.flatMap((page) => page.items);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (node === null || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMore();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <section aria-labelledby="activity-timeline-heading" className="mt-8">
      <h2
        id="activity-timeline-heading"
        className="flex items-center gap-2 font-display text-xl font-bold tracking-tight"
      >
        <MessageSquare
          className="h-5 w-5 text-brand-sentinel"
          aria-hidden="true"
        />
        Activity Timeline
      </h2>

      {items.length > 0 ? (
        <ol
          className="relative mt-5 flex flex-col gap-4 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-glass-border"
          aria-label="Activity timeline"
        >
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="relative pl-10">
              <span
                aria-hidden="true"
                className="absolute left-0 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-glass-border bg-surface text-brand-sentinel"
              >
                {item.kind === 'post' ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </span>
              <ActivityCard worldSlug={worldSlug} item={item} />
            </li>
          ))}
        </ol>
      ) : (
        <GlassPanel className="mt-5 border-dashed p-8 text-center">
          <p className="text-sm text-ink/60">
            No recent activity found for this resident yet. Check back soon!
          </p>
        </GlassPanel>
      )}

      {hasNextPage ? (
        <div
          ref={sentinelRef}
          data-testid="activity-sentinel"
          aria-label="Load more activity"
          className="h-8"
        />
      ) : null}
      {isFetchingNextPage ? (
        <p className="mt-3 text-center text-sm text-ink/60" aria-live="polite">
          Loading more activity...
        </p>
      ) : null}
    </section>
  );
}

function ActivityCard({
  worldSlug,
  item,
}: {
  worldSlug: string;
  item: ActivityItem;
}) {
  const targetTitle = item.kind === 'post' ? item.title : item.postTitle;
  const action = item.kind === 'post' ? 'Started a discussion' : 'Commented on';

  return (
    <GlassPanel hover className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/60">
        <span>{action}</span>
        <Link
          to="/worlds/$slug/posts/$postId"
          params={{ slug: worldSlug, postId: getPostId(item) }}
          aria-label={`Open post: ${targetTitle}`}
          className="font-medium text-ink transition-colors hover:text-brand-sentinel"
        >
          &quot;{targetTitle}&quot;
        </Link>
        <time className="ml-auto" dateTime={item.createdAt}>
          {formatDate(item.createdAt)}
        </time>
      </div>
      <p className="line-clamp-3 text-sm leading-relaxed text-ink/75">
        &quot;{item.content}&quot;
      </p>
      <span
        className="flex items-center gap-1.5 text-xs font-medium text-ink/55"
        aria-label={`${item.voteScore} vote score`}
      >
        <Vote className="h-4 w-4" aria-hidden="true" />
        {item.voteScore}
      </span>
    </GlassPanel>
  );
}

function getPostId(item: PostActivityItem | CommentActivityItem): string {
  return item.kind === 'post' ? item.id : item.postId;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
