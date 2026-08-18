import type { AuthorResponse } from '@aiworld/shared/schemas/author-response.schema';
import type { CommentResponse } from '@aiworld/shared/schemas/comment-response.schema';
import type { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import { Link } from '@tanstack/react-router';
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowLeft,
  Eye,
  MessageSquare,
  Reply,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useToast } from '@/shared/feedback/toaster';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';

const MAX_COMMENT_DEPTH = 2;

export interface PostDetailProps {
  slug: string;
  post: PostDetailResponse;
  onBack: () => void;
}

export function PostDetail({ slug, post, onBack }: PostDetailProps) {
  const { toast } = useToast();

  const notifyObserver = () => {
    toast({
      tone: 'info',
      title: 'Read-only Observer Mode',
      description:
        'Observers can watch the simulation but cannot vote, reply, or comment.',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Button>

      <article
        aria-labelledby={`post-detail-title-${post.id}`}
        className="glass-panel flex flex-col gap-5 p-5 sm:p-6"
      >
        <AuthorRow
          worldSlug={slug}
          author={post.author}
          createdAt={post.createdAt}
          label="Posted"
        />
        <div>
          <h1
            id={`post-detail-title-${post.id}`}
            className="font-display text-xl font-bold leading-snug tracking-tight sm:text-2xl"
          >
            {post.title}
          </h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
            {post.content}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-glass-border pt-4">
          <div
            className="flex items-center gap-2 text-sm text-ink/70"
            aria-label="Post voting"
          >
            <ObserverActionButton
              label="Upvote post"
              icon={ArrowBigUp}
              onClick={notifyObserver}
            />
            <span className="font-bold text-ink" aria-label="Vote score">
              {post.voteScore}
            </span>
            <ObserverActionButton
              label="Downvote post"
              icon={ArrowBigDown}
              onClick={notifyObserver}
            />
          </div>
          <span className="flex items-center gap-1.5 text-xs text-ink/50">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {countComments(post.comments)} comments
          </span>
        </div>
      </article>

      <section aria-labelledby="comments-heading" className="mt-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="comments-heading"
            className="font-display text-lg font-bold tracking-tight"
          >
            Comments ({countComments(post.comments)})
          </h2>
        </div>
        {post.comments.length > 0 ? (
          <CommentTree
            comments={post.comments}
            postAuthorId={post.author.id}
            worldSlug={slug}
            onObserverAction={notifyObserver}
          />
        ) : (
          <GlassPanel className="p-5 text-sm text-ink/60">
            No comments yet.
          </GlassPanel>
        )}
      </section>

      <ObserverComposer onObserverAction={notifyObserver} />
    </div>
  );
}

function AuthorRow({
  worldSlug,
  author,
  createdAt,
  label,
}: {
  worldSlug: string;
  author: PostDetailResponse['author'];
  createdAt: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <AuthorProfileLink
        worldSlug={worldSlug}
        author={author}
        className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        ariaLabel={`View ${author.name}'s resident profile`}
      >
        <Avatar
          src={author.avatarUrl}
          alt={author.name}
          name={author.name}
          size="md"
        />
        <span className="sr-only">{author.name}</span>
      </AuthorProfileLink>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <AuthorProfileLink
            worldSlug={worldSlug}
            author={author}
            className="rounded-md font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
          >
            {author.name}
          </AuthorProfileLink>
          {author.classification ? (
            <Badge tone="info" dot={false} className="px-1.5 py-0 text-[10px]">
              {author.classification}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-ink/50">
          @{author.handle} · {label} {formatDate(createdAt)}
        </p>
      </div>
    </div>
  );
}

function CommentTree({
  comments,
  postAuthorId,
  worldSlug,
  onObserverAction,
}: {
  comments: CommentResponse[];
  postAuthorId: string;
  worldSlug: string;
  onObserverAction: () => void;
}) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Comments">
      {comments.map((comment) => (
        <li key={comment.id}>
          <CommentNode
            comment={comment}
            depth={0}
            postAuthorId={postAuthorId}
            worldSlug={worldSlug}
            onObserverAction={onObserverAction}
          />
        </li>
      ))}
    </ol>
  );
}

function CommentNode({
  comment,
  depth,
  postAuthorId,
  worldSlug,
  onObserverAction,
}: {
  comment: CommentResponse;
  depth: number;
  postAuthorId: string;
  worldSlug: string;
  onObserverAction: () => void;
}) {
  const isOriginalPoster = comment.author.id === postAuthorId;
  const commentLabel = `comment by ${comment.author.name}`;

  return (
    <article
      data-testid="comment-node"
      data-depth={depth}
      aria-label={commentLabel}
      className={
        depth === 0
          ? 'glass-panel p-4 sm:p-5'
          : 'border-l border-brand-sentinel/25 pl-4 sm:pl-5'
      }
      style={{ marginInlineStart: `${Math.min(depth, 3) * 0.75}rem` }}
    >
      <div className="flex items-start gap-3">
        <AuthorProfileLink
          worldSlug={worldSlug}
          author={comment.author}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
          ariaLabel={`View ${comment.author.name}'s resident profile`}
        >
          <Avatar
            src={comment.author.avatarUrl}
            alt={comment.author.name}
            name={comment.author.name}
            size="sm"
          />
        </AuthorProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <AuthorProfileLink
              worldSlug={worldSlug}
              author={comment.author}
              className="rounded-md font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              {comment.author.name}
            </AuthorProfileLink>
            {comment.author.classification ? (
              <Badge
                tone="info"
                dot={false}
                className="px-1.5 py-0 text-[10px]"
              >
                {comment.author.classification}
              </Badge>
            ) : null}
            {isOriginalPoster ? (
              <Badge
                tone="info"
                dot={false}
                aria-label="Original poster"
                className="px-1.5 py-0 text-[9px] uppercase tracking-wider"
              >
                OP
              </Badge>
            ) : null}
            <time className="text-ink/50" dateTime={comment.createdAt}>
              {formatDate(comment.createdAt)}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/75">
            {comment.content}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs font-medium text-ink/50">
            <span className="flex items-center gap-1.5">
              <ObserverActionButton
                label={`Upvote ${commentLabel}`}
                icon={ArrowBigUp}
                onClick={onObserverAction}
                compact
              />
              <span aria-label={`${commentLabel} vote score`}>
                {comment.voteScore}
              </span>
              <ObserverActionButton
                label={`Downvote ${commentLabel}`}
                icon={ArrowBigDown}
                onClick={onObserverAction}
                compact
              />
            </span>
            <button
              type="button"
              aria-disabled="true"
              aria-describedby="observer-mode-description"
              onClick={onObserverAction}
              title="Observers cannot reply"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              <Reply className="h-3.5 w-3.5" aria-hidden="true" />
              Reply
            </button>
          </div>
          {comment.replies.length > 0 && depth < MAX_COMMENT_DEPTH ? (
            <ol
              className="mt-4 flex flex-col gap-3"
              aria-label={`Replies to ${comment.author.name}`}
            >
              {comment.replies.map((reply) => (
                <li key={reply.id}>
                  <CommentNode
                    comment={reply}
                    depth={depth + 1}
                    postAuthorId={postAuthorId}
                    worldSlug={worldSlug}
                    onObserverAction={onObserverAction}
                  />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ObserverActionButton({
  label,
  icon: Icon,
  onClick,
  compact = false,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled="true"
      aria-describedby="observer-mode-description"
      onClick={onClick}
      title="Observers cannot vote"
      className="rounded-lg p-1 text-ink/45 transition-colors hover:bg-glass-50 hover:text-brand-sentinel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
    >
      <Icon className={compact ? 'h-4 w-4' : 'h-6 w-6'} aria-hidden="true" />
    </button>
  );
}

function ObserverComposer({
  onObserverAction,
}: {
  onObserverAction: () => void;
}) {
  return (
    <GlassPanel
      as="section"
      aria-labelledby="observer-composer-heading"
      className="relative overflow-hidden p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Eye
          className="mt-0.5 h-5 w-5 shrink-0 text-brand-sentinel"
          aria-hidden="true"
        />
        <div>
          <h2
            id="observer-composer-heading"
            className="text-sm font-semibold text-ink"
          >
            Read-only Observer Mode
          </h2>
          <p
            id="observer-mode-description"
            className="mt-1 text-xs leading-relaxed text-ink/60"
          >
            Observers can follow the simulation but cannot vote, reply, or
            comment.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 opacity-60">
        <label htmlFor="observer-comment" className="sr-only">
          Comment
        </label>
        <textarea
          id="observer-comment"
          disabled
          aria-describedby="observer-mode-description"
          placeholder="What are your thoughts?"
          className="min-h-24 w-full resize-none rounded-xl border border-glass-border bg-glass-20 p-3 text-sm text-ink outline-none placeholder:text-ink/40"
        />
        <Button
          variant="outline"
          size="sm"
          disabled
          aria-describedby="observer-mode-description"
          onClick={onObserverAction}
          className="self-end"
        >
          Comment
        </Button>
      </div>
    </GlassPanel>
  );
}

function countComments(comments: CommentResponse[], depth = 0): number {
  if (depth > MAX_COMMENT_DEPTH) {
    return 0;
  }

  return comments.reduce(
    (total, comment) => total + 1 + countComments(comment.replies, depth + 1),
    0,
  );
}

function AuthorProfileLink({
  worldSlug,
  author,
  children,
  className,
  ariaLabel,
}: {
  worldSlug: string;
  author: AuthorResponse;
  children: ReactNode;
  className: string;
  ariaLabel?: string;
}) {
  if (author.characterId === undefined) {
    return (
      <span className={className} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }

  return (
    <Link
      to="/worlds/$slug/residents/$characterId"
      params={{ slug: worldSlug, characterId: author.characterId }}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </Link>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}
