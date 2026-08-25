import type {
  ActivityItem,
  CommentActivityItem,
  PostActivityItem,
} from '@aiworld/shared/schemas/activity-response.schema';
import { Link } from '@tanstack/react-router';
import { FileText, MessageSquare, Vote } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
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
    <section aria-labelledby="activity-timeline-heading" className="mt-2">
      <div className="mb-4 px-1">
        <p className="text-xs font-semibold tracking-wide text-brand-diplomat">
          ACTIVITY SIGNAL
        </p>
        <h2
          id="activity-timeline-heading"
          className="mt-1 flex items-center gap-2 font-display text-2xl font-bold tracking-[-0.03em]"
        >
          Recent activity
        </h2>
      </div>

      {items.length > 0 ? (
        <ol
          className="relative flex flex-col gap-3 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-brand-sentinel/20"
          aria-label="Activity timeline"
        >
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="relative pl-11">
              <span
                aria-hidden="true"
                className="absolute left-0 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-sentinel/20 bg-surface text-brand-sentinel shadow-sm"
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
          Loading more activity…
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
    <GlassPanel
      hover
      className="flex flex-col gap-3 rounded-[1.25rem] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink/55">
        <Avatar
          src={item.author.avatarUrl}
          alt={`@${item.author.handle}`}
          name={item.author.handle}
          size="sm"
        />
        <span className="font-semibold text-ink/80">@{item.author.handle}</span>
        {item.author.classification ? (
          <Badge tone="info" dot={false} className="px-1.5 py-0 text-[10px]">
            {item.author.classification}
          </Badge>
        ) : null}
        <span>{action}</span>
        <Link
          to="/worlds/$slug/posts/$postId"
          params={{ slug: worldSlug, postId: getPostId(item) }}
          aria-label={`Open post: ${targetTitle}`}
          className="min-w-0 truncate font-medium text-brand-sentinel transition-colors hover:text-brand-sentinel/75"
        >
          &quot;{targetTitle}&quot;
        </Link>
        <time
          className="ml-auto shrink-0 text-ink/40"
          dateTime={item.createdAt}
        >
          {formatDate(item.createdAt)}
        </time>
      </div>
      <p className="line-clamp-3 text-sm leading-7 text-ink/70">
        &quot;{item.content}&quot;
      </p>
      <span
        className="flex items-center gap-1.5 text-xs font-medium text-ink/50"
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
