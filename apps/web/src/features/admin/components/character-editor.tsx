import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { X } from 'lucide-react';
import { useState } from 'react';

import { adminErrorMessage } from '@/features/admin/admin-errors';
import { CharacterForm } from '@/features/characters/forms/character-form';
import {
  characterToFormValues,
  toCreateCharacter,
  toUpdateCharacter,
  type CharacterFormValues,
} from '@/features/characters/forms/character-form-schema';
import {
  useCreateCharacter,
  useUpdateCharacter,
} from '@/features/characters/query/use-character-mutations';
import { useToast } from '@/shared/feedback/toaster';
import { Button } from '@/shared/ui/button';

import {
  UnsavedChangesDialog,
  useUnsavedChangesBlocker,
} from './unsaved-changes-dialog';

interface CharacterEditorProps {
  mode: 'create' | 'edit';
  character: AdminCharacterResponse | undefined;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function CharacterEditor({
  mode,
  character,
  onClose,
  onDirtyChange,
}: CharacterEditorProps) {
  const { toast } = useToast();
  const createCharacter = useCreateCharacter();
  const updateCharacter = useUpdateCharacter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedCharacter, setSavedCharacter] = useState(character);
  const [createVersion, setCreateVersion] = useState(0);
  const [formVersion, setFormVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChangesBlocker(isDirty);

  if (mode === 'edit' && savedCharacter === undefined) {
    return null;
  }

  const initialValues =
    mode === 'edit' && savedCharacter !== undefined
      ? characterToFormValues(savedCharacter)
      : blankCharacterFormValues();

  const handleSubmit = (values: CharacterFormValues) => {
    setSubmitError(null);
    try {
      if (mode === 'create') {
        createCharacter.mutate(toCreateCharacter(values), {
          onSuccess: () => {
            onDirtyChange(false);
            setCreateVersion((version) => version + 1);
            setFormVersion((version) => version + 1);
            toast({ tone: 'success', title: 'Character created' });
          },
          onError: (error) => {
            setSubmitError(
              adminErrorMessage(error, 'Could not create the Character.'),
            );
          },
        });
        return;
      }

      if (savedCharacter === undefined) {
        return;
      }
      updateCharacter.mutate(
        {
          characterId: savedCharacter.id,
          input: toUpdateCharacter(values),
        },
        {
          onSuccess: (updated) => {
            setSavedCharacter(updated);
            setFormVersion((version) => version + 1);
            onDirtyChange(false);
            toast({ tone: 'success', title: 'Character updated' });
          },
          onError: (error) => {
            setSubmitError(
              adminErrorMessage(error, 'Could not update the Character.'),
            );
          },
        },
      );
    } catch (error) {
      setSubmitError(
        adminErrorMessage(error, 'Please review the Character fields.'),
      );
    }
  };

  return (
    <section
      className="glass-panel flex flex-col gap-5 p-5 sm:p-6"
      aria-label="Character editor"
    >
      <header className="flex items-start justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h3 className="font-display text-xl font-semibold">
            {mode === 'create'
              ? 'New Character'
              : `Edit ${savedCharacter?.name}`}
          </h3>
          <p className="mt-1 text-sm text-ink/60">
            {mode === 'create'
              ? 'Add a reusable Character.'
              : 'Edit identity and simulation settings.'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
          Close editor
        </Button>
      </header>
      <CharacterForm
        key={
          mode === 'create' ? `new-${createVersion}` : savedCharacter?.updatedAt
        }
        mode={mode}
        initialValues={initialValues}
        isSubmitting={createCharacter.isPending || updateCharacter.isPending}
        submitError={submitError}
        resetKey={formVersion}
        onDirtyChange={(dirty) => {
          setIsDirty(dirty);
          onDirtyChange(dirty);
        }}
        onSubmit={handleSubmit}
      />
      <UnsavedChangesDialog
        open={blocker.status === 'blocked'}
        onContinue={() => blocker.reset?.()}
        onDiscard={() => blocker.proceed?.()}
      />
    </section>
  );
}

function blankCharacterFormValues(): CharacterFormValues {
  return {
    handle: '',
    name: '',
    classification: '',
    classificationGroup: '',
    avatarUrl: '',
    biography: '',
    traits: [{ value: '' }],
    systemPrompt: '',
    isActive: true,
  };
}
