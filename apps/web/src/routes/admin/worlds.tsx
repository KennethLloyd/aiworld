import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import {
  listWorldsQuerySchema,
  type ListWorldsQuery,
} from '@aiworld/shared/schemas/world.schema';
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import { ApiError } from '@/core/api/api-error';
import { adminDashboardDefaults } from '@/features/admin/admin-search';
import { WorldStatusBadge } from '@/features/worlds/components/world-status-badge';
import {
  useDeleteWorld,
  useUpdateWorld,
} from '@/features/worlds/query/use-world-mutations';
import { useWorlds } from '@/features/worlds/query/use-worlds';
import { useToast } from '@/shared/feedback/toaster';
import { buttonClasses } from '@/shared/ui/button';
import { Button } from '@/shared/ui/button';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { Input } from '@/shared/ui/input';
import { Modal } from '@/shared/ui/modal';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';

export type AdminWorldsSearch = z.infer<typeof listWorldsQuerySchema>;

/**
 * The stable, URL-shareable admin list defaults (page=1, limit=20, no
 * search/isActive). Typed navigation and links to /admin/worlds and its
 * children reuse this so the required search params live in one place.
 */
export const adminWorldsDefaults: AdminWorldsSearch =
  listWorldsQuerySchema.parse({});

export const Route = createFileRoute('/admin/worlds')({
  validateSearch: validateAdminWorldsSearch,
  component: AdminWorldsRoute,
});

/**
 * The file-layout convention nests /admin/worlds/new and /admin/worlds/$slug
 * under this route, so it acts as a two-mode layout: the list renders for the
 * list path itself, and the child routes (create/edit) render through the
 * Outlet as their own standalone pages.
 */
function AdminWorldsRoute() {
  const hasChildMatch = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId.startsWith('/admin/worlds/') &&
          match.routeId !== '/admin/worlds',
      ),
  });
  if (hasChildMatch) {
    return <Outlet />;
  }
  return <AdminWorldsList />;
}

/**
 * Admin list search validation reuses the shared wire contract
 * (page/limit/search/isActive). Invalid values fall back to the schema
 * defaults instead of throwing at the route level.
 */
function validateAdminWorldsSearch(
  input: Record<string, unknown>,
): AdminWorldsSearch {
  const parsed = listWorldsQuerySchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  return listWorldsQuerySchema.parse({});
}

function AdminWorldsList() {
  const search = useSearch({ from: '/admin/worlds' });
  const navigate = useNavigate({ from: '/admin/worlds' });
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<WorldResponse | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState(search.search ?? '');
  const didMount = useRef(false);

  const query = useMemo<ListWorldsQuery>(
    () => ({
      search: search.search,
      page: search.page,
      limit: search.limit,
      isActive: search.isActive,
    }),
    [search],
  );
  const worldsQuery = useWorlds(query);

  const deleteWorld = useDeleteWorld();
  const updateWorld = useUpdateWorld();
  const deleteConfirmationMatches =
    deleting !== null &&
    (deleteConfirmation === deleting.name ||
      deleteConfirmation === deleting.slug);

  const data = worldsQuery.data;

  // Keep the input in sync when the URL search changes (back/forward, links).
  useEffect(() => {
    setDraft(search.search ?? '');
  }, [search.search]);

  const debouncedDraft = useDebouncedValue(draft, 300);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const urlSearch = search.search ?? '';
    if (debouncedDraft !== urlSearch) {
      handleSearchChange(debouncedDraft);
    }
    // The URL-backed `search` is intentionally excluded: this effect fires
    // only when the debounced draft settles, and the guard above makes the
    // round-trip idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft]);

  const handleSearchChange = (nextSearch: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        search: nextSearch === '' ? undefined : nextSearch,
        page: 1,
      }),
    });
  };

  const handlePageChange = (page: number) => {
    void navigate({
      search: (previous) => ({ ...previous, page }),
    });
  };

  const handleToggle = (world: WorldResponse) => {
    setTogglingSlug(world.slug);
    updateWorld.mutate(
      { slug: world.slug, input: { isActive: !world.isActive } },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: world.isActive ? 'World deactivated' : 'World activated',
          });
        },
        onError: (error) => {
          toast({
            tone: 'error',
            title: 'Could not update status',
            description: errorMessage(error),
          });
        },

        onSettled: () => {
          setTogglingSlug(null);
        },
      },
    );
  };
  const handleActivityFilterChange = (value: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        isActive: value === 'all' ? undefined : value === 'active',
        page: 1,
      }),
    });
  };

  const closeDeleteDialog = useCallback(() => {
    setDeleting(null);
    setDeleteConfirmation('');
  }, []);

  const requestDelete = (world: WorldResponse) => {
    setDeleting(world);
    setDeleteConfirmation('');
  };

  const confirmDelete = () => {
    if (deleting === null || !deleteConfirmationMatches) {
      return;
    }
    const world = deleting;

    deleteWorld.mutate(world.slug, {
      onSuccess: () => {
        closeDeleteDialog();
        toast({ tone: 'success', title: 'World deleted' });
      },
      onError: (error) => {
        closeDeleteDialog();
        toast({
          tone: 'error',
          title: 'Could not delete world',
          description: errorMessage(error),
        });
      },
    });
  };

  const columns: readonly DataTableColumn<WorldResponse>[] = [
    {
      header: 'World',
      cell: (world) => (
        <Link
          to="/admin"
          search={{ world: world.slug, tab: 'overview' }}
          className="font-medium text-brand-sentinel transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        >
          {world.name}
        </Link>
      ),
    },
    {
      header: 'Slug',
      cell: (world) => (
        <code className="font-mono text-xs text-ink/70">{world.slug}</code>
      ),
    },
    {
      header: 'Status',
      cell: (world) => (
        <div className="flex flex-wrap items-center gap-2">
          <WorldStatusBadge isActive={world.isActive} />
          <button
            type="button"
            disabled={togglingSlug === world.slug}
            aria-busy={togglingSlug === world.slug}
            onClick={() => handleToggle(world)}
            className={buttonClasses('ghost', 'sm')}
          >
            {world.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
    {
      header: 'Residents',
      cell: (world) => (
        <span className="text-ink/70">
          {world.residentCount.toLocaleString()} active
        </span>
      ),
    },
    {
      header: 'Last activity',
      cell: (world) => (
        <span className="text-ink/70">{formatDate(world.updatedAt)}</span>
      ),
    },
    {
      header: 'Actions',
      cell: (world) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin"
            search={{ world: world.slug, tab: 'overview' }}
            aria-label={`Open ${world.name}`}
            className={buttonClasses('primary', 'sm')}
          >
            Open
          </Link>
          <Link
            to="/admin/worlds/$slug"
            params={{ slug: world.slug }}
            search={adminWorldsDefaults}
            aria-label={`Edit ${world.name}`}
            className={buttonClasses('ghost', 'sm')}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => requestDelete(world)}
            aria-label={`Delete ${world.name}`}
            className={buttonClasses('ghost', 'sm')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Global admin navigation"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <Link
          to="/admin/worlds"
          search={adminWorldsDefaults}
          aria-current="page"
          className="rounded-md bg-brand-diplomat/10 px-3 py-2 font-semibold text-brand-diplomat focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        >
          Worlds
        </Link>
        <Link
          to="/admin"
          search={{ ...adminDashboardDefaults, tab: 'characters' }}
          className="rounded-md px-3 py-2 text-ink/70 hover:bg-glass-20 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        >
          Characters
        </Link>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand-diplomat/80">
            Global resources
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Worlds
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
            Scan lifecycle coverage, resident capacity, and recent directory
            activity before entering a World workspace.
          </p>
        </div>
        <Link
          to="/admin/worlds/new"
          search={adminWorldsDefaults}
          aria-label="New World"
          title="Create World"
          className={buttonClasses('primary', 'md')}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create World
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative">
          <Input
            label="Search worlds"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search by name or topic..."
            className="pr-11"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-ink/40"
          />
        </div>
        <Select
          id="world-directory-status"
          label="Status"
          value={
            search.isActive === undefined
              ? 'all'
              : search.isActive
                ? 'active'
                : 'inactive'
          }
          options={[
            { value: 'all', label: 'All Worlds' },
            { value: 'active', label: 'Active only' },
            { value: 'inactive', label: 'Inactive only' },
          ]}
          onChange={(event) => handleActivityFilterChange(event.target.value)}
        />
      </div>

      <DataTable<WorldResponse>
        caption="Worlds in the directory"
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(world) => world.id}
        loading={worldsQuery.isPending && data === undefined}
        loadingSlot={<WorldTableSkeleton />}
        emptySlot={
          <EmptyState
            title={
              search.search ? 'No worlds match your search' : 'No worlds yet'
            }
            description={
              search.search
                ? `Nothing matches "${search.search}". Try a different search.`
                : 'Create the first world to get started.'
            }
            action={
              <Link
                to="/admin/worlds/new"
                search={adminWorldsDefaults}
                className={buttonClasses('primary', 'md')}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New World
              </Link>
            }
          />
        }
        errorSlot={
          worldsQuery.isError ? (
            <WorldTableError
              error={worldsQuery.error}
              onRetry={() => void worldsQuery.refetch()}
            />
          ) : undefined
        }
        footer={
          data && data.items.length > 0 ? (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={handlePageChange}
            />
          ) : undefined
        }
      />

      <Modal
        open={deleting !== null}
        onClose={closeDeleteDialog}
        title={
          deleting
            ? `Delete “${deleting.name}” permanently?`
            : 'Delete world permanently'
        }
        footer={
          <>
            <Button variant="outline" onClick={closeDeleteDialog}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              disabled={!deleteConfirmationMatches}
              loading={deleteWorld.isPending}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        {deleting ? (
          <>
            <p className="text-sm leading-relaxed text-ink/80">
              This permanently deletes this World and its related data,
              including memberships, posts, comments, votes, simulation history,
              and simulation configuration.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink/80">
              This cannot be undone.
            </p>
            <div className="mt-4">
              <Input
                label="Confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={deleting.name}
                hint={`Type “${deleting.name}” or “${deleting.slug}” exactly.`}
                autoComplete="off"
              />
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  return (
    <nav
      aria-label="Admin worlds pagination"
      className="flex items-center justify-between gap-4"
    >
      <button
        type="button"
        className={buttonClasses('outline', 'sm')}
        disabled={!canGoPrevious}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </button>
      <output className="text-xs text-ink/60">
        Page {page} of {totalPages}
      </output>
      <button
        type="button"
        className={buttonClasses('outline', 'sm')}
        disabled={!canGoNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

function WorldTableSkeleton() {
  return (
    <div
      aria-label="Loading worlds"
      aria-busy="true"
      className="flex flex-col gap-2"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} variant="row" />
      ))}
    </div>
  );
}

function WorldTableError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.status === 403) {
    return (
      <ErrorState forbidden message="Your account cannot list admin worlds." />
    );
  }
  return (
    <ErrorState
      title="Could not load worlds"
      message={errorMessage(error)}
      onRetry={onRetry}
    />
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while loading this content.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
