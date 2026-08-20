import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { adminErrorMessage } from '@/features/admin/admin-errors';
import { WorldForm } from '@/features/worlds/forms/world-form';
import {
  toUpdateWorld,
  worldToFormValues,
  type WorldFormValues,
} from '@/features/worlds/forms/world-form-schema';
import { useUpdateWorld } from '@/features/worlds/query/use-world-mutations';
import { adminWorldsDefaults } from '@/routes/admin/worlds';
import { useToast } from '@/shared/feedback/toaster';
import { buttonClasses } from '@/shared/ui/button';

import {
  UnsavedChangesDialog,
  useUnsavedChangesBlocker,
} from './unsaved-changes-dialog';

export function WorldConfigEditor({ world }: { world: WorldResponse }) {
  const navigate = useNavigate({ from: '/admin/' });
  const { toast } = useToast();
  const updateWorld = useUpdateWorld();
  const [savedWorld, setSavedWorld] = useState(world);
  const [formVersion, setFormVersion] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const lastPropUpdatedAt = useRef(world.updatedAt);
  const blocker = useUnsavedChangesBlocker(isDirty);
  const onDirtyChange = useCallback((dirty: boolean) => setIsDirty(dirty), []);

  useEffect(() => {
    if (world.updatedAt === lastPropUpdatedAt.current) {
      return;
    }
    lastPropUpdatedAt.current = world.updatedAt;
    if (!isDirty) {
      setSavedWorld(world);
      setFormVersion((version) => version + 1);
    }
  }, [isDirty, world]);

  const handleSubmit = (values: WorldFormValues) => {
    setSubmitError(null);
    try {
      const input = toUpdateWorld(values);

      updateWorld.mutate(
        { slug: world.slug, input },
        {
          onSuccess: (updatedWorld) => {
            setSavedWorld(updatedWorld);
            setFormVersion((version) => version + 1);
            setIsDirty(false);
            if (updatedWorld.slug !== world.slug) {
              void navigate({
                search: (previous) => ({
                  ...previous,
                  world: updatedWorld.slug,
                }),
              });
            }
            toast({ tone: 'success', title: 'World updated' });
          },
          onError: (error) => {
            setSubmitError(
              adminErrorMessage(
                error,
                'Could not update the World. Please try again.',
              ),
            );
          },
        },
      );
    } catch (error) {
      setSubmitError(
        adminErrorMessage(error, 'Please review the World fields.'),
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            World Config
          </h2>
          <p className="mt-1 font-mono text-xs text-ink/50">
            Editing /{world.slug}
          </p>
        </div>
        <Link
          to="/admin/worlds/new"
          search={adminWorldsDefaults}
          className={buttonClasses('outline', 'sm')}
        >
          Create a World
        </Link>
      </header>
      <WorldForm
        mode="edit"
        initialValues={worldToFormValues(savedWorld)}
        isSubmitting={updateWorld.isPending}
        submitError={submitError}
        resetKey={formVersion}
        onDirtyChange={onDirtyChange}
        onSubmit={handleSubmit}
      />
      <UnsavedChangesDialog
        open={blocker.status === 'blocked'}
        onContinue={() => blocker.reset?.()}
        onDiscard={() => blocker.proceed?.()}
      />
    </div>
  );
}
