import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Edit3, Plus, UserRound, X } from 'lucide-react';
import { useState } from 'react';

import {
  adminErrorMessage,
  isForbiddenError,
} from '@/features/admin/admin-errors';
import { CharacterForm } from '@/features/characters/forms/character-form';
import {
  characterToFormValues,
  toCreateCharacter,
  toUpdateCharacter,
  type CharacterFormValues,
} from '@/features/characters/forms/character-form-schema';
import { useAdminCharacters } from '@/features/characters/query/use-admin-characters';
import {
  useCreateCharacter,
  useUpdateCharacter,
} from '@/features/characters/query/use-character-mutations';
import { useToast } from '@/shared/feedback/toaster';
import { Avatar } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

import {
  UnsavedChangesDialog,
  useUnsavedChangesBlocker,
} from './unsaved-changes-dialog';

type EditorSelection = 'new' | string | null;

export function CharacterRegistryTab() {
  const [page, setPage] = useState(1);
  const charactersQuery = useAdminCharacters({ page, limit: 20 });
  const characters = charactersQuery.data?.items ?? [];
  const [editor, setEditor] = useState<EditorSelection>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEditor, setPendingEditor] = useState<EditorSelection>(null);
  const [hasPendingEditor, setHasPendingEditor] = useState(false);

  const requestEditor = (next: EditorSelection) => {
    if (next === editor) {
      return;
    }
    if (editor !== null && editorDirty) {
      setPendingEditor(next);
      setHasPendingEditor(true);
      return;
    }
    setEditor(next);
  };

  const discardAndSwitch = () => {
    setEditorDirty(false);
    setEditor(pendingEditor);
    setPendingEditor(null);
    setHasPendingEditor(false);
  };

  const selectedCharacter =
    editor !== null && editor !== 'new'
      ? characters.find((character) => character.id === editor)
      : undefined;

  if (charactersQuery.isPending && charactersQuery.data === undefined) {
    return <CharacterRegistrySkeleton />;
  }
  if (charactersQuery.isError && charactersQuery.data === undefined) {
    return (
      <ErrorState
        title="Could not load Character registry"
        message={
          isForbiddenError(charactersQuery.error)
            ? undefined
            : adminErrorMessage(
                charactersQuery.error,
                'Something went wrong while loading Characters.',
              )
        }
        forbidden={isForbiddenError(charactersQuery.error)}
        onRetry={() => void charactersQuery.refetch()}
      />
    );
  }

  const columns: readonly DataTableColumn<AdminCharacterResponse>[] = [
    {
      header: 'Character',
      cell: (character) => (
        <div className="flex items-center gap-3">
          <Avatar
            src={character.avatarUrl}
            alt={character.name}
            name={character.name}
            size="sm"
          />
          <div>
            <p className="font-medium">{character.name}</p>
            <p className="font-mono text-xs text-ink/50">@{character.handle}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Classification',
      cell: (character) => (
        <span className="text-ink/70">
          {character.classification ?? 'Unclassified'}
          {character.classificationGroup
            ? ` · ${character.classificationGroup}`
            : ''}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (character) => (
        <span
          className={character.isActive ? 'text-emerald-300' : 'text-ink/50'}
        >
          {character.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (character) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => requestEditor(character.id)}
          aria-label={`Edit ${character.name}`}
        >
          <Edit3 className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Global Character Registry
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/70">
            Manage reusable Characters globally. Unassigned Characters remain
            visible here; World membership is managed in the Members tab.
          </p>
        </div>
        <Button onClick={() => requestEditor('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Character
        </Button>
      </header>

      <DataTable
        rows={characters}
        columns={columns}
        rowKey={(character) => character.id}
        caption="Global Character Registry"
        loading={charactersQuery.isPending}
        loadingSlot={<CharacterRegistrySkeleton />}
        emptySlot={
          <EmptyState
            icon={UserRound}
            title="No Characters in the registry"
            description="Create the first reusable Character before assigning it to a World."
            action={
              <Button onClick={() => requestEditor('new')}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Character
              </Button>
            }
          />
        }
      />

      {charactersQuery.data !== undefined &&
      charactersQuery.data.meta.totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Character registry pages"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || charactersQuery.isFetching || editorDirty}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="font-mono text-xs text-ink/60">
            Page {page} of {charactersQuery.data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={
              page >= charactersQuery.data.meta.totalPages ||
              charactersQuery.isFetching ||
              editorDirty
            }
            onClick={() =>
              setPage((current) =>
                Math.min(current + 1, charactersQuery.data!.meta.totalPages),
              )
            }
          >
            Next
          </Button>
        </nav>
      ) : null}

      {charactersQuery.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          <span>
            The registry could not be refreshed. Your current editor values are
            preserved.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void charactersQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {editor !== null ? (
        selectedCharacter !== undefined || editor === 'new' ? (
          <CharacterEditor
            key={editor}
            mode={editor === 'new' ? 'create' : 'edit'}
            character={selectedCharacter}
            onClose={() => requestEditor(null)}
            onDirtyChange={setEditorDirty}
          />
        ) : (
          <ErrorState
            title="Character no longer available"
            message="Refresh the registry and choose another Character."
            onRetry={() => void charactersQuery.refetch()}
          />
        )
      ) : null}

      <UnsavedChangesDialog
        open={hasPendingEditor}
        onContinue={() => {
          setPendingEditor(null);
          setHasPendingEditor(false);
        }}
        onDiscard={discardAndSwitch}
      />
    </div>
  );
}

interface CharacterEditorProps {
  mode: 'create' | 'edit';
  character: AdminCharacterResponse | undefined;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function CharacterEditor({
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
              adminErrorMessage(
                error,
                'Could not create the Character. Please try again.',
              ),
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
              adminErrorMessage(
                error,
                'Could not update the Character. Please try again.',
              ),
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
              ? 'Create an unassigned Character for the global registry.'
              : 'Character identity and simulation instructions are admin-only.'}
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

function CharacterRegistrySkeleton() {
  return (
    <div
      aria-label="Loading Character registry"
      aria-busy="true"
      className="flex flex-col gap-4"
    >
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </div>
  );
}
