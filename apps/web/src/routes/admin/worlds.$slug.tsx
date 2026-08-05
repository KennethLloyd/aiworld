import type { WorldResponse } from '@aiworld/shared';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Globe } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/core/api/api-error';
import { WorldForm } from '@/features/worlds/forms/world-form';
import {
  toUpdateWorld,
  type WorldFormValues,
} from '@/features/worlds/forms/world-form-schema';
import { useWorld } from '@/features/worlds/query/use-world';
import { useUpdateWorld } from '@/features/worlds/query/use-world-mutations';
import { adminWorldsDefaults } from '@/routes/admin/worlds';
import { useToast } from '@/shared/feedback/toaster';
import { buttonClasses } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/admin/worlds/$slug')({
  component: EditWorldRoute,
});

function EditWorldRoute() {
  const { slug } = Route.useParams();
  const worldQuery = useWorld(slug);
  return (
    <EditWorldScreen
      slug={slug}
      data={worldQuery.data}
      isPending={worldQuery.isPending}
      isError={worldQuery.isError}
      error={worldQuery.error}
      onRetry={() => void worldQuery.refetch()}
    />
  );
}

export interface EditWorldScreenProps {
  slug: string;
  data: WorldResponse | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/**
 * State switch for the admin edit screen: skeleton while loading, the
 * not-found visual for ApiError(404), ErrorState + retry for anything else,
 * and the hydrated WorldForm on success. Exported so route states are
 * unit-testable without the router.
 */
export function EditWorldScreen({
  slug,
  data,
  isPending,
  isError,
  error,
  onRetry,
}: EditWorldScreenProps) {
  if (isPending) {
    return <EditWorldSkeleton />;
  }
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <AdminWorldNotFound slug={slug} />;
    }
    return (
      <ErrorState
        title="Could not load this world"
        message={errorMessage(
          error,
          'Something went wrong while loading this world.',
        )}
        onRetry={onRetry}
      />
    );
  }
  if (data === undefined) {
    return null;
  }
  return <EditWorldForm world={data} />;
}

function EditWorldForm({ world }: { world: WorldResponse }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const updateWorld = useUpdateWorld();
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Hydrate once from the loaded world (description record -> rows); the form
  // becomes the source of truth while editing.
  const [initialValues] = useState<WorldFormValues>(() =>
    worldToFormValues(world),
  );

  const handleSubmit = (values: WorldFormValues) => {
    setSubmitError(null);
    const input = toUpdateWorld(values);
    updateWorld.mutate(
      { slug: world.slug, input },
      {
        onSuccess: (updated) => {
          toast({ tone: 'success', title: 'World updated' });
          // A slug edit changes the public URL: follow it so the address bar
          // and the detail cache key stay correct.
          if (updated.slug !== world.slug) {
            void navigate({
              to: '/admin/worlds/$slug',
              params: { slug: updated.slug },
              search: adminWorldsDefaults,
              replace: true,
            });
          }
        },
        onError: (error) => {
          setSubmitError(
            errorMessage(
              error,
              'Could not update the world. Please try again.',
            ),
          );
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          Edit {world.name}
        </h2>
        <p className="font-mono text-xs text-ink/50">
          /admin/worlds/{world.slug}
        </p>
      </header>
      <WorldForm
        mode="edit"
        initialValues={initialValues}
        isSubmitting={updateWorld.isPending}
        submitError={submitError}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

/** Description record -> editable rows; rules strings -> rows (one empty row for adding). */
function worldToFormValues(world: WorldResponse): WorldFormValues {
  const descriptionEntries = Object.entries(world.description ?? {}).map(
    ([key, value]) => ({ key, value }),
  );
  return {
    name: world.name,
    slug: world.slug,
    topicScope: world.topicScope,
    rules:
      world.rules.length > 0
        ? world.rules.map((rule) => ({ value: rule }))
        : [{ value: '' }],
    isActive: world.isActive,
    descriptionEntries: descriptionEntries.length > 0 ? descriptionEntries : [],
  };
}

function EditWorldSkeleton() {
  return (
    <div
      aria-label="Loading world"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <Skeleton variant="text" className="h-8 w-64" />
      <Skeleton variant="text" className="h-4 w-40" />
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
    </div>
  );
}

/** The admin not-found visual with a link back to the admin list. */
function AdminWorldNotFound({ slug }: { slug: string }) {
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
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
          World not found
        </h2>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/70">
          No world matches &quot;{slug}&quot; - it may have been renamed or
          removed.
        </p>
        <div className="mt-8">
          <Link
            to="/admin/worlds"
            search={adminWorldsDefaults}
            className={buttonClasses('primary', 'md')}
          >
            Back to admin worlds
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
