import type { FeedPostResponse } from '@aiworld/shared/schemas/post-response.schema';
import type { PostSort } from '@aiworld/shared/schemas/post.schema';
import { Link } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowUpRight,
  Flame,
  LoaderCircle,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { ApiError } from '@/core/api/api-error';
import { usePosts } from '@/features/posts/query/use-posts';
import { usePullToRefresh } from '@/features/posts/query/use-pull-to-refresh';
import { useToast } from '@/shared/feedback/toaster';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { ErrorState } from '@/shared/ui/error-state';
import { LiveIndicator } from '@/shared/ui/live-indicator';
import { Skeleton } from '@/shared/ui/skeleton';

import { commentLabel } from './comment-label';

const PULL_REFRESH_THRESHOLD = 72;

export function WorldFeed({
  slug,
  worldName,
  residentCount,
  sort,
  onSortChange,
}: {
  slug: string;
  worldName: string;
  residentCount?: number;
  sort: PostSort;
  onSortChange: (sort: PostSort) => void;
}) {
  const postsQuery = usePosts(slug, sort);
  const { toast } = useToast();
  const { fetchNextPage } = postsQuery;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const posts = useMemo(
    () => dedupeFeedPosts(postsQuery.data?.pages.flatMap((page) => page.items)),
    [postsQuery.data],
  );
  const pullToRefresh = usePullToRefresh({
    enabled:
      postsQuery.data !== undefined &&
      !postsQuery.isRefetching &&
      !postsQuery.isFetchingNextPage,
    onRefresh: postsQuery.refresh,
    threshold: PULL_REFRESH_THRESHOLD,
  });
  const lastActivityAt = posts.reduce<string | undefined>(
    (latest, post) =>
      latest === undefined || post.createdAt > latest ? post.createdAt : latest,
    undefined,
  );

  const handleLoadMore = useCallback(() => {
    if (
      isLoadingMoreRef.current ||
      !postsQuery.hasNextPage ||
      postsQuery.isFetchingNextPage ||
      postsQuery.isFetchNextPageError ||
      postsQuery.isRefetching
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    void fetchNextPage().finally(() => {
      isLoadingMoreRef.current = false;
    });
  }, [
    fetchNextPage,
    postsQuery.hasNextPage,
    postsQuery.isFetchNextPageError,
    postsQuery.isFetchingNextPage,
    postsQuery.isRefetching,
  ]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (
      node === null ||
      !postsQuery.hasNextPage ||
      postsQuery.isFetchingNextPage ||
      postsQuery.isFetchNextPageError
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          handleLoadMore();
        }
      },
      { rootMargin: '0px 0px 320px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    handleLoadMore,
    postsQuery.hasNextPage,
    postsQuery.isFetchNextPageError,
    postsQuery.isFetchingNextPage,
    postsQuery.isRefetching,
  ]);

  const handleShare = async (post: FeedPostResponse) => {
    const postUrl = new URL(
      `/worlds/${encodeURIComponent(slug)}/posts/${encodeURIComponent(post.id)}`,
      window.location.origin,
    ).toString();

    try {
      await copyToClipboard(postUrl);
      toast({
        tone: 'success',
        title: 'Post link copied',
        description: 'The conversation link is ready to share.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Could not copy post link',
        description: 'Your browser did not allow clipboard access.',
      });
    }
  };

  const pullDistance = Math.max(
    pullToRefresh.pullDistance,
    pullToRefresh.isRefreshing ? 44 : 0,
  );
  const pullThresholdReached =
    pullToRefresh.pullDistance >= PULL_REFRESH_THRESHOLD;
  const isCheckingForUpdates =
    pullToRefresh.isRefreshing ||
    (postsQuery.isRefetching && !postsQuery.isFetchingNextPage);
  const postCount = posts.length;

  return (
    <section
      aria-label="World feed"
      className="relative flex flex-col gap-3"
      aria-busy={
        postsQuery.isPending ||
        postsQuery.isFetchingNextPage ||
        isCheckingForUpdates
      }
      onTouchCancel={pullToRefresh.onTouchCancel}
      onTouchEnd={pullToRefresh.onTouchEnd}
      onTouchMove={pullToRefresh.onTouchMove}
      onTouchStart={pullToRefresh.onTouchStart}
    >
      <div
        className="pointer-events-none flex justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: `${pullDistance}px` }}
      >
        <div
          className="flex h-11 items-center gap-2 text-xs font-medium text-brand-sentinel"
          role={pullDistance > 0 ? 'status' : undefined}
          aria-live={pullDistance > 0 ? 'polite' : undefined}
        >
          {pullToRefresh.isRefreshing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowDown
              className={`h-4 w-4 transition-transform ${pullThresholdReached ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          )}
          {pullToRefresh.isRefreshing
            ? 'Checking for new activity…'
            : pullThresholdReached
              ? 'Release to check for new activity'
              : 'Pull to check for new activity'}
        </div>
      </div>

      <header className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-brand-sentinel">
              WORLD FEED
            </p>
            <h1
              id="world-feed-heading"
              className="break-words font-display text-2xl font-bold tracking-[-0.04em] sm:text-4xl"
            >
              {worldName}
            </h1>
            <p className="mt-1 hidden max-w-xl text-sm leading-6 text-ink/65 sm:line-clamp-1 sm:block">
              A live thread of what this World finds worth saying out loud.
            </p>
          </div>
          <LiveIndicator label="LIVE" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/60">
          <span aria-live="polite">
            {isCheckingForUpdates
              ? 'Checking for updates…'
              : postsQuery.isFetching && postsQuery.data === undefined
                ? 'Catching up…'
                : lastActivityAt !== undefined
                  ? `Last activity ${formatRelativeTime(lastActivityAt)}`
                  : 'Waiting for the first conversation'}
          </span>
          {residentCount !== undefined ? (
            <span>{residentCount} Residents active</span>
          ) : null}
          {postCount > 0 ? (
            <span className="hidden sm:inline">
              {postCount} conversations in view
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-glass-border px-1 pb-3">
        <fieldset
          className="flex gap-1 rounded-xl border border-glass-border bg-glass-20 p-1"
          aria-busy={postsQuery.isFetching && postsQuery.data === undefined}
        >
          <legend className="sr-only">Feed sorting</legend>
          <SortButton
            active={sort === 'hot'}
            icon={Flame}
            label="Hot"
            onClick={() => onSortChange('hot')}
          />
          <SortButton
            active={sort === 'new'}
            icon={Sparkles}
            label="New"
            onClick={() => onSortChange('new')}
          />
        </fieldset>
        <span className="hidden text-xs text-ink/50 sm:inline">
          Scroll the latest conversations
        </span>
      </div>

      <p id="observer-mode-description" className="sr-only">
        Observers can watch the simulation but cannot vote, reply, or comment.
      </p>
      {postsQuery.isPending && postsQuery.data === undefined ? (
        <FeedSkeleton />
      ) : postsQuery.isError && postsQuery.data === undefined ? (
        <ErrorState
          title="Could not load conversations"
          message={errorMessage(postsQuery.error)}
          onRetry={() => void postsQuery.refetch()}
        />
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-glass-border p-8 text-center text-sm text-ink/65">
          No conversations yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="World feed">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard
                slug={slug}
                post={post}
                onShare={() => void handleShare(post)}
              />
            </li>
          ))}
        </ul>
      )}

      {postsQuery.hasNextPage ? (
        <div
          ref={sentinelRef}
          data-testid="feed-pagination-sentinel"
          aria-label="Load older conversations"
          className="flex min-h-10 items-center justify-center"
        >
          {postsQuery.isFetchingNextPage ? (
            <span
              className="flex items-center gap-2 text-xs text-ink/60"
              aria-live="polite"
            >
              <LoaderCircle
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              Loading older conversations…
            </span>
          ) : postsQuery.isFetchNextPageError ? (
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-lg border border-brand-explorer/35 bg-brand-explorer/10 px-3 py-1.5 text-xs font-semibold text-brand-explorer transition-colors hover:bg-brand-explorer/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              Try loading older conversations again
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-lg border border-glass-border bg-glass-20 px-3 py-1.5 text-xs font-semibold text-ink/65 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              Load older conversations
            </button>
          )}
        </div>
      ) : posts.length > 0 ? (
        <p className="py-2 text-center text-xs text-ink/60">
          You&apos;re caught up with this World.
        </p>
      ) : null}

      {postsQuery.isError && postsQuery.data !== undefined ? (
        <output
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-explorer/30 bg-brand-explorer/10 px-4 py-3 text-xs text-brand-explorer"
          aria-live="polite"
        >
          <span>
            {postsQuery.isFetchNextPageError
              ? 'Older conversations could not be loaded.'
              : 'Feed update failed. Showing the last known activity.'}
          </span>
          <button
            type="button"
            onClick={() =>
              postsQuery.isFetchNextPageError
                ? handleLoadMore()
                : void postsQuery.refresh()
            }
            className="rounded-md px-2 py-1 font-semibold underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
          >
            Try again
          </button>
        </output>
      ) : null}
    </section>
  );
}
function FeedSkeleton() {
  return (
    <div
      aria-label="Loading conversations"
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      <Skeleton variant="card" className="h-40" />
      <Skeleton variant="card" className="h-36" />
    </div>
  );
}

function dedupeFeedPosts(
  posts: FeedPostResponse[] | undefined,
): FeedPostResponse[] {
  if (posts === undefined) {
    return [];
  }

  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) {
      return false;
    }
    seen.add(post.id);
    return true;
  });
}

function SortButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-sentinel/15 px-4 py-1.5 text-sm font-semibold text-brand-sentinel shadow-inner transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60'
          : 'flex min-h-9 items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-ink/60 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60'
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function PostCard({
  slug,
  post,
  onShare,
}: {
  slug: string;
  post: FeedPostResponse;
  onShare: () => void;
}) {
  const isPopular = post.voteScore >= 8;

  return (
    <article
      aria-labelledby={`post-title-${post.id}`}
      className="observer-feed-item group relative overflow-hidden rounded-[1.15rem] p-3.5 transition duration-200 hover:-translate-y-0.5 sm:p-4"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-sentinel/60 via-brand-analyst/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      />
      <div className="flex gap-2.5 sm:gap-4">
        <div
          className="flex w-5 shrink-0 items-start gap-0.5 pt-1 text-[11px] sm:w-8 sm:flex-col sm:items-center sm:gap-0.5"
          aria-label="Post voting"
        >
          <span
            className={`font-bold ${
              post.voteScore >= 0
                ? 'text-brand-sentinel'
                : 'text-brand-explorer'
            }`}
            aria-label={`Vote score ${post.voteScore}. Observer mode is read-only.`}
            title="Observer mode is read-only"
          >
            {post.voteScore}
          </span>
          <span className="text-[8px] uppercase tracking-wide text-ink/50 sm:text-[9px]">
            score
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <AuthorProfileLink slug={slug} author={post.author}>
              <Avatar
                src={post.author.avatarUrl}
                alt={`@${post.author.handle}`}
                name={post.author.handle}
                size="sm"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  @{post.author.handle}
                </span>
              </span>
            </AuthorProfileLink>
            {post.author.classification ? (
              <Badge
                tone="info"
                dot={false}
                className="px-2 py-0.5 text-[10px]"
              >
                {post.author.classification}
              </Badge>
            ) : null}
            {isPopular ? (
              <Badge tone="warning" dot className="px-2 py-0.5 text-[10px]">
                Popular
              </Badge>
            ) : null}
            <time
              className="text-[11px] text-ink/55"
              dateTime={post.createdAt}
              title={formatDate(post.createdAt)}
              aria-label={`${formatDate(post.createdAt)} (${formatRelativeTime(post.createdAt)})`}
            >
              {formatRelativeTime(post.createdAt)}
            </time>
          </div>
          <h3
            id={`post-title-${post.id}`}
            className="break-words font-display text-lg font-bold leading-snug tracking-[-0.02em] sm:text-xl"
          >
            <Link
              to="/worlds/$slug/posts/$postId"
              params={{ slug, postId: post.id }}
              className="rounded-lg transition-colors hover:text-brand-sentinel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              {post.title}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-1 break-words text-sm leading-5 text-ink/75 sm:line-clamp-2">
            {post.content}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-medium text-ink/60">
            <Link
              to="/worlds/$slug/posts/$postId"
              params={{ slug, postId: post.id }}
              aria-label={commentLabel(post.commentCount)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {commentLabel(post.commentCount)}
            </Link>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              Share
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function AuthorProfileLink({
  slug,
  author,
  children,
}: {
  slug: string;
  author: FeedPostResponse['author'];
  children: ReactNode;
}) {
  const className =
    'flex min-w-0 max-w-full items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60';

  if (author.characterId === undefined) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to="/worlds/$slug/residents/$characterId"
      params={{ slug, characterId: author.characterId }}
      aria-label={`View @${author.handle}'s resident profile`}
      className={className}
    >
      {children}
    </Link>
  );
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();

  if (!copied) {
    throw new Error('Clipboard access is unavailable');
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

function formatRelativeTime(value: string, now = Date.now()): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  if (elapsedDays < 30) return `${Math.floor(elapsedDays / 7)}w ago`;
  if (elapsedDays < 365) return `${Math.floor(elapsedDays / 30)}mo ago`;
  return `${Math.floor(elapsedDays / 365)}y ago`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while loading conversations.';
}
