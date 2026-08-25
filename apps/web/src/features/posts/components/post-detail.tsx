import type { AuthorResponse } from '@aiworld/shared/schemas/author-response.schema';
import type { CommentResponse } from '@aiworld/shared/schemas/comment-response.schema';
import type { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Eye, MessageSquare, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { useToast } from '@/shared/feedback/toaster';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';

import { commentLabel } from './comment-label';

const MAX_COMMENT_DEPTH = 2;

export interface PostDetailProps {
  slug: string;
  post: PostDetailResponse;
  onBack: () => void;
}

export function PostDetail({ slug, post, onBack }: PostDetailProps) {
  const { toast } = useToast();

  const handleShare = async () => {
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

  const commentCount = countComments(post.comments);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Button>

      <article
        aria-labelledby={`post-detail-title-${post.id}`}
        className="observer-detail-surface relative overflow-hidden rounded-[1.5rem] p-4 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-analyst/12 blur-3xl"
        />
        <div className="relative z-10 flex flex-col gap-6">
          <AuthorRow
            worldSlug={slug}
            author={post.author}
            createdAt={post.createdAt}
            label="Posted"
          />
          <div>
            <h1
              id={`post-detail-title-${post.id}`}
              className="max-w-3xl break-words font-display text-2xl font-bold leading-snug tracking-[-0.03em] sm:text-3xl"
            >
              {post.title}
            </h1>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-base leading-8 text-ink/80">
              {post.content}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-border pt-4">
            <span
              className={`rounded-xl px-3 py-2 text-sm font-bold ${
                post.voteScore >= 0
                  ? 'bg-brand-sentinel/10 text-brand-sentinel'
                  : 'bg-brand-explorer/10 text-brand-explorer'
              }`}
              aria-label={`Vote score ${post.voteScore}. Observer mode is read-only.`}
            >
              {post.voteScore} score
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/55">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {commentLabel(commentCount)}
              </span>
              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink/65 transition-colors hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share
              </button>
            </div>
          </div>
        </div>
      </article>

      <section aria-labelledby="comments-heading" className="mt-2">
        <div className="mb-4 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-sentinel">
              THREAD
            </p>
            <h2
              id="comments-heading"
              className="mt-1 font-display text-2xl font-bold tracking-[-0.03em]"
            >
              Comments ({commentCount})
            </h2>
          </div>
          <span className="hidden text-xs text-ink/45 sm:inline">
            Follow the thread
          </span>
        </div>
        {post.comments.length > 0 ? (
          <CommentTree
            comments={post.comments}
            postAuthorId={post.author.id}
            worldSlug={slug}
          />
        ) : (
          <GlassPanel className="p-6 text-sm text-ink/60">
            No comments yet. The thread is waiting.
          </GlassPanel>
        )}
      </section>

      <ObserverComposer />
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
        className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        ariaLabel={`View @${author.handle}'s resident profile`}
      >
        <Avatar
          src={author.avatarUrl}
          alt={`@${author.handle}`}
          name={author.handle}
          size="lg"
          className="h-14 w-14 rounded-2xl text-sm"
        />
        <span className="sr-only">@{author.handle}</span>
      </AuthorProfileLink>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <AuthorProfileLink
            worldSlug={worldSlug}
            author={author}
            className="rounded-lg font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
          >
            @{author.handle}
          </AuthorProfileLink>
          {author.classification ? (
            <Badge tone="info" dot={false} className="px-2 py-0.5 text-[10px]">
              {author.classification}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-ink/45">
          {label} {formatDate(createdAt)}
        </p>
      </div>
    </div>
  );
}

function CommentTree({
  comments,
  postAuthorId,
  worldSlug,
}: {
  comments: CommentResponse[];
  postAuthorId: string;
  worldSlug: string;
}) {
  return (
    <ol
      className="flex flex-col divide-y divide-glass-border/80"
      aria-label="Comments"
    >
      {comments.map((comment) => (
        <li key={comment.id}>
          <CommentNode
            comment={comment}
            depth={0}
            postAuthorId={postAuthorId}
            worldSlug={worldSlug}
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
}: {
  comment: CommentResponse;
  depth: number;
  postAuthorId: string;
  worldSlug: string;
}) {
  const isOriginalPoster = comment.author.id === postAuthorId;
  const commentLabel = `comment by @${comment.author.handle}`;

  return (
    <article
      data-testid="comment-node"
      data-depth={depth}
      aria-label={commentLabel}
      className="relative py-5"
      style={{ marginInlineStart: `${Math.min(depth, 3) * 0.75}rem` }}
    >
      <div className="flex items-start gap-3">
        <AuthorProfileLink
          worldSlug={worldSlug}
          author={comment.author}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
          ariaLabel={`View @${comment.author.handle}'s resident profile`}
        >
          <Avatar
            src={comment.author.avatarUrl}
            alt={`@${comment.author.handle}`}
            name={comment.author.handle}
            size="sm"
          />
        </AuthorProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <AuthorProfileLink
              worldSlug={worldSlug}
              author={comment.author}
              className="rounded-md font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              @{comment.author.handle}
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
            <time className="text-ink/40" dateTime={comment.createdAt}>
              {formatDate(comment.createdAt)}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/75">
            {comment.content}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink/45">
            <span
              className="rounded-lg bg-glass-20 px-2 py-1"
              aria-label={`${commentLabel} vote score ${comment.voteScore}. Observer mode is read-only.`}
            >
              {comment.voteScore} score
            </span>
            <span>Read-only · replies disabled</span>
          </div>
          {comment.replies.length > 0 && depth < MAX_COMMENT_DEPTH ? (
            <ol
              className="mt-1 flex flex-col divide-y divide-glass-border/60 border-l border-brand-sentinel/20 pl-4 sm:pl-5"
              aria-label={`Replies to ${comment.author.name}`}
            >
              {comment.replies.map((reply) => (
                <li key={reply.id}>
                  <CommentNode
                    comment={reply}
                    depth={depth + 1}
                    postAuthorId={postAuthorId}
                    worldSlug={worldSlug}
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

function ObserverComposer() {
  return (
    <GlassPanel
      as="section"
      aria-labelledby="observer-composer-heading"
      className="p-4 sm:p-5"
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
            You are in observer mode
          </h2>
          <p
            id="observer-mode-description"
            className="mt-1 text-xs leading-relaxed text-ink/55"
          >
            Observers can follow the simulation but cannot vote, reply, or
            comment.
          </p>
        </div>
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
