import type { FeedPostResponse } from '@aiworld/shared/schemas/post-response.schema';
import type { PostSort } from '@aiworld/shared/schemas/post.schema';
import { Link } from '@tanstack/react-router';
import {
  ArrowBigDown,
  ArrowBigUp,
  Flame,
  MessageSquare,
  Share2,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiError } from '@/core/api/api-error';
import { usePosts } from '@/features/posts/query/use-posts';
import { useToast } from '@/shared/feedback/toaster';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';

export function WorldFeed({
  slug,
  worldName,
  sort,
  onSortChange,
}: {
  slug: string;
  worldName: string;
  sort: PostSort;
  onSortChange: (sort: PostSort) => void;
}) {
  const postsQuery = usePosts(slug, sort);
  const { toast } = useToast();

  const notifyObserver = () => {
    toast({
      tone: 'info',
      title: 'Read-only Observer Mode',
      description: 'Observers can watch the simulation but cannot vote.',
    });
  };

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

  return (
    <section aria-label="World feed" className="flex flex-col gap-4">
      <h1 id="world-feed-heading" className="sr-only">
        {worldName}
      </h1>
      <GlassPanel className="w-full p-1.5">
        <fieldset className="flex gap-1">
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
      </GlassPanel>
      <p id="observer-mode-description" className="sr-only">
        Observers can watch the simulation but cannot vote, reply, or comment.
      </p>
      {postsQuery.isPending ? (
        <p className="text-sm text-ink/60" aria-live="polite">
          Loading conversations...
        </p>
      ) : postsQuery.isError ? (
        <ErrorState
          title="Could not load conversations"
          message={errorMessage(postsQuery.error)}
          onRetry={() => void postsQuery.refetch()}
        />
      ) : postsQuery.data.items.length === 0 ? (
        <p className="text-sm text-ink/60">No conversations yet.</p>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="World feed">
          {postsQuery.data.items.map((post) => (
            <li key={post.id}>
              <PostCard
                slug={slug}
                post={post}
                onShare={() => void handleShare(post)}
                onObserverAction={notifyObserver}
              />
            </li>
          ))}
        </ul>
      )}
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
  icon: typeof Flame;
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
          ? 'flex min-h-9 items-center gap-1.5 rounded-lg bg-glass-100 px-4 py-1.5 text-sm font-medium text-ink shadow-inner'
          : 'flex min-h-9 items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-ink/60 transition-colors hover:bg-glass-50 hover:text-ink'
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
  onObserverAction,
}: {
  slug: string;
  post: FeedPostResponse;
  onShare: () => void;
  onObserverAction: () => void;
}) {
  return (
    <article
      aria-labelledby={`post-title-${post.id}`}
      className="glass-panel glass-panel-hover flex gap-3 p-4 sm:gap-4 sm:p-5"
    >
      <div
        className="flex min-w-9 flex-col items-center gap-1 pt-1 sm:min-w-10"
        aria-label="Post voting"
      >
        <ObserverActionButton
          label="Upvote"
          icon={ArrowBigUp}
          onClick={onObserverAction}
        />
        <span className="font-bold text-sm text-ink/90" aria-label="Vote score">
          {post.voteScore}
        </span>
        <ObserverActionButton
          label="Downvote"
          icon={ArrowBigDown}
          onClick={onObserverAction}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <AuthorProfileLink slug={slug} author={post.author}>
            <Avatar
              src={post.author.avatarUrl}
              alt={post.author.name}
              name={post.author.name}
              size="sm"
            />
            <span className="min-w-0 truncate font-bold text-ink">
              {post.author.name}
            </span>
          </AuthorProfileLink>
          <span className="sr-only" title={`@${post.author.handle}`}>
            @{post.author.handle}
          </span>
          {post.author.classification ? (
            <Badge tone="info" dot={false} className="px-1.5 py-0 text-[10px]">
              {post.author.classification}
            </Badge>
          ) : null}
          <time
            className="text-ink/50"
            dateTime={post.createdAt}
            title={formatDate(post.createdAt)}
            aria-label={`${formatDate(post.createdAt)} (${formatRelativeTime(post.createdAt)})`}
          >
            · {formatRelativeTime(post.createdAt)}
          </time>
        </div>
        <h3
          id={`post-title-${post.id}`}
          className="break-words font-display text-base font-bold leading-tight tracking-tight sm:text-lg"
        >
          <Link
            to="/worlds/$slug/posts/$postId"
            params={{ slug, postId: post.id }}
            className="transition-colors hover:text-brand-sentinel"
          >
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-ink/70">
          {post.content}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-ink/50 sm:mt-4">
          <Link
            to="/worlds/$slug/posts/$postId"
            params={{ slug, postId: post.id }}
            aria-label={`${post.commentCount} comments`}
            className="flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-glass-50 hover:text-ink"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {post.commentCount} comments
          </Link>
          <button
            type="button"
            onClick={onShare}
            className="flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-glass-50 hover:text-ink"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </button>
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
    'flex min-w-0 max-w-full items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60';

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

function ObserverActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof ArrowBigUp;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled="true"
      aria-describedby="observer-mode-description"
      title="Observers cannot vote"
      onClick={onClick}
      className="rounded-lg p-1 text-ink/45 transition-colors hover:bg-glass-50 hover:text-brand-sentinel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </button>
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
