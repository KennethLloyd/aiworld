import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Edit3, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';

import {
  adminErrorMessage,
  isForbiddenError,
} from '@/features/admin/admin-errors';
import { useAdminCharacters } from '@/features/characters/query/use-admin-characters';
import { Avatar } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

import { CharacterEditor } from './character-editor';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

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
