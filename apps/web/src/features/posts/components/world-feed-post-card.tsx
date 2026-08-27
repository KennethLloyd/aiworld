import type { FeedPostResponse } from '@aiworld/shared/schemas/post-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

import { Avatar } from '@/shared/ui/avatar';
import { identityAccent } from '@/shared/ui/identity-accent';
import { IdentityBadge } from '@/shared/ui/identity-badge';
import { VoteControl } from '@/shared/ui/vote-control';

import { commentLabel } from './comment-label';
import { formatDate, formatRelativeTime } from './world-feed-utils';

export function WorldFeedPostCard({
  slug,
  post,
  onShare,
}: {
  slug: string;
  post: FeedPostResponse;
  onShare: () => void;
}) {
  return (
    <article
      aria-labelledby={`post-title-${post.id}`}
      data-identity-accent={identityAccent(post.author.id)}
      className="observer-feed-item group relative overflow-hidden rounded-[1.15rem] p-3.5 transition duration-200 hover:-translate-y-0.5 sm:p-4"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-[var(--resident-accent)] opacity-0 transition-opacity group-hover:opacity-100"
      />
      <div className="min-w-0">
        <div className="mb-2.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <AuthorProfileLink slug={slug} author={post.author}>
            <Avatar
              src={post.author.avatarUrl}
              alt={`@${post.author.handle}`}
              name={post.author.handle}
              identityId={post.author.id}
              size="sm"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">
                @{post.author.handle}
              </span>
            </span>
          </AuthorProfileLink>
          {post.author.classification ? (
            <IdentityBadge
              identityId={post.author.id}
              className="px-2 py-0.5 text-[10px]"
            >
              {post.author.classification}
            </IdentityBadge>
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
          <VoteControl score={post.voteScore} />
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
