import { MessageSquare } from 'lucide-react';

import { ApiError } from '@/core/api/api-error';
import { usePosts } from '@/features/posts/query/use-posts';
import { Avatar } from '@/shared/ui/avatar';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';

export function WorldFeed({ slug }: { slug: string }) {
  const postsQuery = usePosts(slug);

  return (
    <GlassPanel className="mt-6 flex flex-col gap-4 border-brand-sentinel/30 p-5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/60">
          Feed
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Latest conversations from this world.
        </p>
      </div>
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
        <ul className="flex flex-col gap-3" aria-label="Latest conversations">
          {postsQuery.data.items.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-glass-border bg-glass-20 p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={post.author.avatarUrl}
                  alt={post.author.name}
                  name={post.author.name}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs text-ink/60">
                    {post.author.name}
                  </p>
                  <h3 className="font-display font-semibold tracking-tight">
                    {post.title}
                  </h3>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/70">
                {post.content}
              </p>
              <span className="mt-3 flex items-center gap-1.5 text-xs text-ink/50">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                {post.commentCount} comments
              </span>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
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
