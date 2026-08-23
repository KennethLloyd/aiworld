import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { ApiError } from '@/core/api/api-error';
import {
  UnsavedChangesDialog,
  useUnsavedChangesBlocker,
} from '@/features/admin/components/unsaved-changes-dialog';
import { WorldForm } from '@/features/worlds/forms/world-form';
import {
  toCreateWorld,
  type WorldFormValues,
} from '@/features/worlds/forms/world-form-schema';
import { useCreateWorld } from '@/features/worlds/query/use-world-mutations';
import { adminWorldsDefaults } from '@/routes/admin/worlds';
import { useToast } from '@/shared/feedback/toaster';

export const Route = createFileRoute('/admin/worlds/new')({
  component: NewWorldPage,
});

/** Blank create defaults: one rule row to fill in, description added explicitly. */
function blankFormValues(): WorldFormValues {
  return {
    name: '',
    slug: '',
    topicScope: '',
    rules: [{ value: '' }],
    isActive: true,
    descriptionEntries: [],
  };
}

function NewWorldPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createWorld = useCreateWorld();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChangesBlocker(isDirty && !createWorld.isPending);

  const handleSubmit = (values: WorldFormValues) => {
    setSubmitError(null);
    const input = toCreateWorld(values);
    createWorld.mutate(input, {
      onSuccess: () => {
        setIsDirty(false);
        blocker.allowNextNavigation();
        toast({ tone: 'success', title: 'World saved' });
        void navigate({ to: '/admin/worlds', search: adminWorldsDefaults });
      },
      onError: (error) => {
        // Keep the form open and surface the API's message/validation issues.
        setSubmitError(
          errorMessage(error, 'Could not save the world. Please try again.'),
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          New world
        </h2>
        <p className="text-sm leading-relaxed text-ink/70">
          Add a world to the AIWorld directory.
        </p>
      </header>
      <WorldForm
        mode="create"
        initialValues={blankFormValues()}
        isSubmitting={createWorld.isPending}
        submitError={submitError}
        onDirtyChange={setIsDirty}
        onCancel={() =>
          void navigate({ to: '/admin/worlds', search: adminWorldsDefaults })
        }
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

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
