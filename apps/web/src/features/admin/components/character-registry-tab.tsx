import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { Edit3, Plus, Search, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
import { Input } from '@/shared/ui/input';
import { Modal } from '@/shared/ui/modal';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';

import { CharacterEditor } from './character-editor';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

type EditorSelection = 'new' | string | null;
type ActivityFilter = 'all' | 'active' | 'inactive';

export interface CharacterRegistrySearchState {
  search?: string;
  page?: number;
  isActive?: boolean;
}

export interface CharacterRegistryTabProps {
  searchState?: CharacterRegistrySearchState;
  onSearchChange?: (search: string) => void;
  onPageChange?: (page: number) => void;
  onActivityFilterChange?: (isActive: boolean | undefined) => void;
}

export function CharacterRegistryTab({
  searchState,
  onSearchChange,
  onPageChange,
  onActivityFilterChange,
}: CharacterRegistryTabProps = {}) {
  const isUrlBacked = searchState !== undefined;
  const [localPage, setLocalPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState(searchState?.search ?? '');
  const [localActivityFilter, setLocalActivityFilter] =
    useState<ActivityFilter>('all');
  const search = isUrlBacked ? (searchState.search ?? '') : draftSearch;
  const page = isUrlBacked ? (searchState.page ?? 1) : localPage;
  const activityFilter = isUrlBacked
    ? searchState.isActive === undefined
      ? 'all'
      : searchState.isActive
        ? 'active'
        : 'inactive'
    : localActivityFilter;
  const debouncedSearch = useDebouncedValue(draftSearch, 300);
  const charactersQuery = useAdminCharacters({
    page,
    limit: 20,
    search: search || undefined,
    isActive:
      activityFilter === 'all' ? undefined : activityFilter === 'active',
  });
  const characters = charactersQuery.data?.items ?? [];
  const [editor, setEditor] = useState<EditorSelection>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEditor, setPendingEditor] = useState<EditorSelection>(null);
  const [hasPendingEditor, setHasPendingEditor] = useState(false);
  const editorRef = useRef<EditorSelection>(editor);
  const editorDirtyRef = useRef(editorDirty);
  editorRef.current = editor;
  editorDirtyRef.current = editorDirty;

  const requestEditor = useCallback((next: EditorSelection) => {
    const currentEditor = editorRef.current;
    if (next === currentEditor) {
      return;
    }
    if (currentEditor !== null && editorDirtyRef.current) {
      setPendingEditor(next);
      setHasPendingEditor(true);
      return;
    }
    setEditor(next);
  }, []);
  const closeEditor = useCallback(() => {
    requestEditor(null);
  }, [requestEditor]);
  const handleEditorDirtyChange = useCallback((dirty: boolean) => {
    setEditorDirty(dirty);
  }, []);

  const discardAndSwitch = () => {
    setEditorDirty(false);
    setEditor(pendingEditor);
    setPendingEditor(null);
    setHasPendingEditor(false);
  };

  const handleActivityFilterChange = (nextFilter: ActivityFilter) => {
    if (onActivityFilterChange !== undefined) {
      onActivityFilterChange(
        nextFilter === 'all' ? undefined : nextFilter === 'active',
      );
      return;
    }
    setLocalActivityFilter(nextFilter);
  };

  const handlePageChange = (nextPage: number) => {
    if (onPageChange !== undefined) {
      onPageChange(nextPage);
      return;
    }
    setLocalPage(nextPage);
  };

  useEffect(() => {
    if (isUrlBacked) {
      setDraftSearch(searchState.search ?? '');
    }
  }, [isUrlBacked, searchState?.search]);

  useEffect(() => {
    if (!isUrlBacked || onSearchChange === undefined) {
      return;
    }
    const nextSearch = debouncedSearch.trim();
    if (nextSearch !== search) {
      onSearchChange(nextSearch);
    }
  }, [debouncedSearch, isUrlBacked, onSearchChange, search]);

  useEffect(() => {
    if (!isUrlBacked) {
      setLocalPage(1);
    }
  }, [activityFilter, debouncedSearch, isUrlBacked]);

  const totalPages = Math.max(1, charactersQuery.data?.meta.totalPages ?? 1);
  useEffect(() => {
    if (
      charactersQuery.data === undefined ||
      charactersQuery.isFetching ||
      page <= totalPages
    ) {
      return;
    }
    handlePageChange(totalPages);
    // The URL-backed page is corrected through the parent callback; the local
    // page follows the same invariant when this component is used standalone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charactersQuery.data, charactersQuery.isFetching, page, totalPages]);

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
            identityId={character.id}
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
            Characters are reusable identities. Assign them to Worlds as
            Residents; editing a Character never changes World membership.
          </p>
        </div>
        <Button onClick={() => requestEditor('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Character
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative">
          <Input
            id="character-registry-search"
            label="Search Characters"
            placeholder="Search by name or handle"
            value={draftSearch}
            disabled={editorDirty}
            onChange={(event) => setDraftSearch(event.target.value)}
            className="pr-10"
          />
          <Search
            className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-ink/50"
            aria-hidden="true"
          />
        </div>
        <Select
          id="character-registry-status"
          label="Status"
          value={activityFilter}
          disabled={editorDirty}
          options={[
            { value: 'all', label: 'All Characters' },
            { value: 'active', label: 'Active only' },
            { value: 'inactive', label: 'Inactive only' },
          ]}
          onChange={(event) =>
            handleActivityFilterChange(event.target.value as ActivityFilter)
          }
        />
      </div>

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
            description={
              search.trim() || activityFilter !== 'all'
                ? 'No Characters match these filters. Try clearing the search or status filter.'
                : 'No Characters yet.'
            }
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
            onClick={() => handlePageChange(Math.max(1, page - 1))}
          >
            Previous
          </Button>
          <span className="font-mono text-xs text-ink/60">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={
              page >= totalPages || charactersQuery.isFetching || editorDirty
            }
            onClick={() => handlePageChange(Math.min(page + 1, totalPages))}
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
          <Modal
            open
            onClose={closeEditor}
            title={
              editor === 'new'
                ? 'New Character'
                : `Edit ${selectedCharacter?.name ?? 'Character'}`
            }
            size="wide"
            className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-h-[calc(100vh-3rem)]"
          >
            <CharacterEditor
              key={editor}
              mode={editor === 'new' ? 'create' : 'edit'}
              character={selectedCharacter}
              onClose={closeEditor}
              onDirtyChange={handleEditorDirtyChange}
            />
          </Modal>
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

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debounced;
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
