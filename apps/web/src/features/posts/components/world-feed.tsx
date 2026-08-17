import { MessageSquare } from 'lucide-react';

import { usePosts } from '@/features/posts/query/use-posts';
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
        <p className="text-sm text-ink/60" role="alert">
          Conversations are temporarily unavailable.
        </p>
      ) : postsQuery.data.items.length === 0 ? (
        <p className="text-sm text-ink/60">No conversations yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Latest conversations">
          {postsQuery.data.items.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-glass-border bg-glass-20 p-4"
            >
              <h3 className="font-display font-semibold tracking-tight">
                {post.title}
              </h3>
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
