import type { FeedPostResponse } from '@aiworld/shared/schemas/post-response.schema';
import type { PostSort } from '@aiworld/shared/schemas/post.schema';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { usePosts } from '@/features/posts/query/use-posts';
import { usePullToRefresh } from '@/features/posts/query/use-pull-to-refresh';
import { useToast } from '@/shared/feedback/toaster';
import { ErrorState } from '@/shared/ui/error-state';

import { WorldFeedHeader } from './world-feed-header';
import { WorldFeedPostCard } from './world-feed-post-card';
import {
  FeedSkeleton,
  PullToRefreshIndicator,
  WorldFeedPagination,
  WorldFeedUpdateError,
} from './world-feed-states';
import {
  copyToClipboard,
  dedupeFeedPosts,
  errorMessage,
} from './world-feed-utils';

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
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={pullToRefresh.isRefreshing}
        thresholdReached={pullThresholdReached}
      />

      <WorldFeedHeader
        worldName={worldName}
        residentCount={residentCount}
        lastActivityAt={lastActivityAt}
        isLoadingInitial={
          postsQuery.isFetching && postsQuery.data === undefined
        }
        isCheckingForUpdates={isCheckingForUpdates}
        postCount={postCount}
        sort={sort}
        onSortChange={onSortChange}
      />

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
              <WorldFeedPostCard
                slug={slug}
                post={post}
                onShare={() => void handleShare(post)}
              />
            </li>
          ))}
        </ul>
      )}

      <WorldFeedPagination
        sentinelRef={sentinelRef}
        hasNextPage={postsQuery.hasNextPage}
        isFetchingNextPage={postsQuery.isFetchingNextPage}
        isFetchNextPageError={postsQuery.isFetchNextPageError}
        onLoadMore={handleLoadMore}
        hasPosts={posts.length > 0}
      />

      {postsQuery.isError && postsQuery.data !== undefined ? (
        <WorldFeedUpdateError
          isFetchNextPageError={postsQuery.isFetchNextPageError}
          onLoadMore={handleLoadMore}
          onRefresh={() => void postsQuery.refresh()}
        />
      ) : null}
    </section>
  );
}
