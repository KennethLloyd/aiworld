import type { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import {
  createFileRoute,
  Link,
  useCanGoBack,
  useRouter,
} from '@tanstack/react-router';
import { Globe } from 'lucide-react';

import { ApiError } from '@/core/api/api-error';
import { PostDetail } from '@/features/posts/components/post-detail';
import { usePost } from '@/features/posts/query/use-post';
import { publicListWorldsDefaults } from '@/features/worlds/api/world-gateway';
import { buttonClasses } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/worlds/$slug_/posts/$postId')({
  component: PostDetailRoute,
});

function PostDetailRoute() {
  const { slug, postId } = Route.useParams();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const postQuery = usePost(slug, postId);

  const handleBack = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }

    void navigate({
      to: '/worlds/$slug',
      params: { slug },
      search: { section: 'feed', sort: 'hot' },
    });
  };

  return (
    <PostDetailScreen
      slug={slug}
      data={postQuery.data}
      isPending={postQuery.isPending}
      isError={postQuery.isError}
      error={postQuery.error}
      onRetry={() => void postQuery.refetch()}
      onBack={handleBack}
    />
  );
}

export interface PostDetailScreenProps {
  slug: string;
  data: PostDetailResponse | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onBack: () => void;
}

export function PostDetailScreen({
  slug,
  data,
  isPending,
  isError,
  error,
  onRetry,
  onBack,
}: PostDetailScreenProps) {
  if (isPending) {
    return <PostDetailSkeleton />;
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <PostNotFound slug={slug} onBack={onBack} />;
    }

    return (
      <ErrorState
        title="Could not load this post"
        message={errorMessage(error)}
        onRetry={onRetry}
      />
    );
  }

  if (data === undefined) {
    return null;
  }

  return <PostDetail slug={slug} post={data} onBack={onBack} />;
}

function PostDetailSkeleton() {
  return (
    <div
      aria-label="Loading post"
      aria-busy="true"
      className="flex flex-col gap-4"
    >
      <Skeleton variant="text" className="h-9 w-24" />
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
    </div>
  );
}

function PostNotFound({ slug, onBack }: { slug: string; onBack: () => void }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <GlassPanel className="w-full max-w-md p-10 text-center">
        <Globe
          className="mx-auto h-10 w-10 text-brand-explorer"
          aria-hidden="true"
        />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.35em] text-brand-explorer">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Post not found
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/70">
          No post matches this address in &quot;{slug}&quot;.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={buttonClasses('ghost', 'md')}
          >
            Back
          </button>
          <Link
            to="/worlds"
            search={publicListWorldsDefaults}
            className={buttonClasses('primary', 'md')}
          >
            Back to worlds
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while loading this post.';
}
