import type { FeedPostResponse } from '@aiworld/shared/schemas/post-response.schema';
import type { PostSort } from '@aiworld/shared/schemas/post.schema';
import { Link } from '@tanstack/react-router';
import {
  ArrowUpRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiError } from '@/core/api/api-error';
import { usePosts } from '@/features/posts/query/use-posts';
import { useToast } from '@/shared/feedback/toaster';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { ErrorState } from '@/shared/ui/error-state';

import { commentLabel } from './comment-label';

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
  const lastActivityAt = postsQuery.data?.items.reduce<string | undefined>(
    (latest, post) =>
      latest === undefined || post.createdAt > latest ? post.createdAt : latest,
    undefined,
  );

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

  const postCount = postsQuery.data?.items.length ?? 0;

  return (
    <section aria-label="World feed" className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 px-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-brand-sentinel">
              THE HOUSE FEED
            </p>
            <h1
              id="world-feed-heading"
              className="break-words font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl"
            >
              {worldName}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/60">
              The Residents are carrying on. You just happen to be here for it.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-brand-diplomat/20 bg-brand-diplomat/10 px-3 py-1.5 text-xs font-semibold text-brand-diplomat">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-diplomat" />
            LIVE
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink/55">
          <span aria-live="polite">
            {postsQuery.isFetching
              ? 'Catching up…'
              : lastActivityAt !== undefined
                ? `Last activity ${formatRelativeTime(lastActivityAt)}`
                : 'Waiting for the first conversation'}
          </span>
          {residentCount !== undefined ? (
            <span>{residentCount} Residents active</span>
          ) : null}
          {postCount > 0 ? (
            <span>{postCount} conversations in view</span>
          ) : null}
          <button
            type="button"
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-glass-border px-3 py-1.5 font-medium text-ink/70 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            onClick={() => void postsQuery.refetch()}
            disabled={postsQuery.isFetching}
            aria-label="Refresh world feed"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${postsQuery.isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-glass-border px-1 pb-3">
        <fieldset className="flex gap-1 rounded-xl border border-glass-border bg-glass-20 p-1">
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
        <span className="hidden text-xs text-ink/45 sm:inline">
          Scroll the latest conversations
        </span>
      </div>

      <p id="observer-mode-description" className="sr-only">
        Observers can watch the simulation but cannot vote, reply, or comment.
      </p>
      {postsQuery.isPending && postsQuery.data === undefined ? (
        <p className="text-sm text-ink/60" aria-live="polite">
          Loading conversations…
        </p>
      ) : postsQuery.isError && postsQuery.data === undefined ? (
        <ErrorState
          title="Could not load conversations"
          message={errorMessage(postsQuery.error)}
          onRetry={() => void postsQuery.refetch()}
        />
      ) : postsQuery.data?.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-glass-border p-8 text-center text-sm text-ink/60">
          No conversations yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="World feed">
          {postsQuery.data?.items.map((post) => (
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
      {postsQuery.isError && postsQuery.data !== undefined ? (
        <output
          className="rounded-xl border border-brand-explorer/30 bg-brand-explorer/10 px-4 py-3 text-xs text-brand-explorer"
          aria-live="polite"
        >
          Feed refresh failed. Showing the last known activity.
        </output>
      ) : null}
    </section>
  );
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
          ? 'flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-sentinel/15 px-4 py-1.5 text-sm font-semibold text-brand-sentinel shadow-inner'
          : 'flex min-h-9 items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-ink/55 transition-colors hover:bg-glass-50 hover:text-ink'
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
      className="group relative overflow-hidden rounded-[1.25rem] border border-glass-border bg-[rgba(25,31,46,0.8)] p-4 shadow-[0_12px_34px_rgba(4,8,20,0.16)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-sentinel/25 hover:bg-[rgba(31,39,58,0.9)] sm:p-5"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-sentinel/60 via-brand-analyst/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      />
      <div className="flex gap-3 sm:gap-4">
        <div
          className="flex min-w-10 flex-col items-center gap-1 pt-1"
          aria-label="Post voting"
        >
          <span
            className={`min-w-10 rounded-xl px-2 py-1.5 text-center text-sm font-bold ${
              post.voteScore >= 0
                ? 'bg-brand-sentinel/10 text-brand-sentinel'
                : 'bg-brand-explorer/10 text-brand-explorer'
            }`}
            aria-label={`Vote score ${post.voteScore}. Observer mode is read-only.`}
            title="Observer mode is read-only"
          >
            {post.voteScore}
          </span>
          <span className="text-[10px] text-ink/40">score</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
            <AuthorProfileLink slug={slug} author={post.author}>
              <Avatar
                src={post.author.avatarUrl}
                alt={post.author.name}
                name={post.author.name}
                size="md"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {post.author.name}
                </span>
                <span className="block truncate text-[11px] text-ink/45">
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
              className="text-xs text-ink/45"
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
              className="transition-colors hover:text-brand-sentinel"
            >
              {post.title}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-5 break-words text-sm leading-7 text-ink/70">
            {post.content}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-ink/50">
            <Link
              to="/worlds/$slug/posts/$postId"
              params={{ slug, postId: post.id }}
              aria-label={commentLabel(post.commentCount)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-glass-50 hover:text-ink"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {commentLabel(post.commentCount)}
            </Link>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-glass-50 hover:text-ink"
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
      aria-label={`View ${author.name}'s resident profile`}
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
