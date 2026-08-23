import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  adminErrorMessage,
  isForbiddenError,
} from '@/features/admin/admin-errors';
import {
  useAssignWorldMember,
  useUpdateWorldMember,
} from '@/features/admin/query/use-world-member-mutations';
import { useWorldMembers } from '@/features/admin/query/use-world-members';
import {
  useAdminCharacterDirectory,
  useAdminCharacters,
} from '@/features/characters/query/use-admin-characters';
import { useToast } from '@/shared/feedback/toaster';
import { Avatar } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { buttonClasses, Button } from '@/shared/ui/button';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Input } from '@/shared/ui/input';
import { Modal } from '@/shared/ui/modal';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';

const MEMBER_PAGE_SIZE = 20;
const CANDIDATE_PAGE_SIZE = 20;

interface MemberRow {
  member: WorldMemberResponse;
  character: AdminCharacterResponse | undefined;
}
type MemberFilter = 'all' | 'active' | 'inactive';

export function WorldMembersTab({ world }: { world: WorldResponse }) {
  const membersQuery = useWorldMembers(world.slug);
  const directoryQuery = useAdminCharacterDirectory();
  const [memberPage, setMemberPage] = useState(1);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const debouncedCandidateSearch = useDebouncedValue(candidateSearch, 300);
  const candidateQuery = useAdminCharacters({
    page: candidatePage,
    limit: CANDIDATE_PAGE_SIZE,
    search: debouncedCandidateSearch || undefined,
  });
  const [deactivationTarget, setDeactivationTarget] =
    useState<MemberRow | null>(null);
  const assignMutation = useAssignWorldMember();
  const updateMutation = useUpdateWorldMember();
  const { toast } = useToast();

  useEffect(() => {
    setMemberPage(1);
    setCandidatePage(1);
  }, [world.slug]);

  useEffect(() => {
    setCandidatePage(1);
  }, [candidateSearch]);

  const characterById = useMemo(
    () =>
      new Map(
        (directoryQuery.data ?? []).map((character) => [
          character.id,
          character,
        ]),
      ),
    [directoryQuery.data],
  );
  const memberRows = useMemo(
    () =>
      (membersQuery.data ?? [])
        .filter((member) => member.role === 'AI' && member.characterId !== null)
        .map((member) => ({
          member,
          character: characterById.get(member.characterId!),
        })),
    [characterById, membersQuery.data],
  );
  const memberPageCount = Math.max(
    1,
    Math.ceil(
      memberRows.filter(({ member }) =>
        memberFilter === 'all'
          ? true
          : member.isActive === (memberFilter === 'active'),
      ).length / MEMBER_PAGE_SIZE,
    ),
  );
  const filteredMemberRows = memberRows.filter(({ member }) =>
    memberFilter === 'all'
      ? true
      : member.isActive === (memberFilter === 'active'),
  );
  const visibleMembers = filteredMemberRows.slice(
    (memberPage - 1) * MEMBER_PAGE_SIZE,
    memberPage * MEMBER_PAGE_SIZE,
  );
  const membershipCharacterIds = useMemo(
    () => new Set(memberRows.map(({ member }) => member.characterId)),
    [memberRows],
  );
  const membershipReady = membersQuery.isSuccess;
  const candidates = (candidateQuery.data?.items ?? []).filter(
    (character) => !membershipCharacterIds.has(character.id),
  );
  const candidatePageCount = Math.max(
    1,
    candidateQuery.data?.meta.totalPages ?? 1,
  );

  const assignCharacter = (character: AdminCharacterResponse) => {
    assignMutation.reset();
    assignMutation.mutate(
      { worldSlug: world.slug, characterId: character.id, isActive: true },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: 'Character assigned',
            description: `${character.name} is now an AI Resident of ${world.name}.`,
          });
        },
      },
    );
  };

  const updateMembership = (row: MemberRow, isActive: boolean) => {
    updateMutation.reset();
    updateMutation.mutate(
      { worldSlug: world.slug, memberId: row.member.id, input: { isActive } },
      {
        onSuccess: () => {
          setDeactivationTarget(null);
          toast({
            tone: 'success',
            title: isActive
              ? 'Membership reactivated'
              : 'Membership deactivated',
            description:
              row.character?.name ?? 'The AI Resident membership was updated.',
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            World Members
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/70">
            Assign and manage Characters in {world.name}.
          </p>
        </div>
        <Badge tone="info" dot={false}>
          {memberRows.length} AI{' '}
          {memberRows.length === 1 ? 'Resident' : 'Residents'}
        </Badge>
      </header>

      {membersQuery.isError && membersQuery.data !== undefined ? (
        <RefreshNotice
          message={adminErrorMessage(
            membersQuery.error,
            'Members unavailable.',
          )}
          onRetry={() => void membersQuery.refetch()}
        />
      ) : null}

      {directoryQuery.isError ? (
        <RefreshNotice
          message={adminErrorMessage(
            directoryQuery.error,
            'Character details unavailable.',
          )}
          onRetry={() => void directoryQuery.refetch()}
        />
      ) : null}

      <GlassPanel
        as="section"
        aria-labelledby="world-members-list"
        className="p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3
              id="world-members-list"
              className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/60"
            >
              Assigned AI Residents
            </h3>
            <p className="mt-1 text-sm text-ink/60">
              Character and membership status are separate.
            </p>
          </div>
          <Select
            id="world-member-status-filter"
            label="Membership status"
            value={memberFilter}
            options={[
              { value: 'all', label: 'All memberships' },
              { value: 'active', label: 'Active only' },
              { value: 'inactive', label: 'Inactive only' },
            ]}
            onChange={(event) => {
              setMemberFilter(event.target.value as MemberFilter);
              setMemberPage(1);
            }}
          />
          {membersQuery.isFetching ? (
            <span className="font-mono text-xs text-ink/50" aria-live="polite">
              Refreshing…
            </span>
          ) : null}
        </div>

        {membersQuery.isError && membersQuery.data === undefined ? (
          <ErrorState
            title="Could not load World members"
            message={
              isForbiddenError(membersQuery.error)
                ? undefined
                : adminErrorMessage(membersQuery.error, 'Members unavailable.')
            }
            forbidden={isForbiddenError(membersQuery.error)}
            onRetry={() => void membersQuery.refetch()}
          />
        ) : (
          <DataTable
            rows={visibleMembers}
            columns={memberColumns({
              updateMutation,
              onDeactivate: setDeactivationTarget,
              onReactivate: (row) => updateMembership(row, true),
            })}
            rowKey={({ member }) => member.id}
            caption="Assigned AI Residents"
            loading={
              (membersQuery.isPending && membersQuery.data === undefined) ||
              (directoryQuery.isPending && directoryQuery.data === undefined)
            }
            loadingSlot={<MemberRowsSkeleton />}
            emptySlot={
              <EmptyState
                icon={Users}
                title={
                  memberFilter === 'all'
                    ? 'No AI Residents assigned'
                    : `No ${memberFilter} memberships`
                }
                description={
                  memberFilter === 'all'
                    ? 'Assign an active Character to add the first resident.'
                    : 'Clear the membership filter to see every assigned resident.'
                }
              />
            }
          />
        )}

        {memberRows.length > MEMBER_PAGE_SIZE ? (
          <Pagination
            label="World member pages"
            page={memberPage}
            totalPages={memberPageCount}
            onPrevious={() => setMemberPage((page) => Math.max(1, page - 1))}
            onNext={() =>
              setMemberPage((page) => Math.min(memberPageCount, page + 1))
            }
            disabled={membersQuery.isFetching}
          />
        ) : null}
      </GlassPanel>

      <GlassPanel
        as="section"
        aria-labelledby="assign-world-character"
        className="p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-col gap-1">
          <h3
            id="assign-world-character"
            className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/60"
          >
            Assign a Character
          </h3>
          <p className="text-sm leading-relaxed text-ink/60">
            Assign Characters to this World.
          </p>
        </div>

        {candidateQuery.isError && candidateQuery.data === undefined ? (
          <ErrorState
            title="Could not load assignment candidates"
            message={
              isForbiddenError(candidateQuery.error)
                ? undefined
                : adminErrorMessage(
                    candidateQuery.error,
                    'Candidates unavailable.',
                  )
            }
            forbidden={isForbiddenError(candidateQuery.error)}
            onRetry={() => void candidateQuery.refetch()}
          />
        ) : (
          <>
            <div className="max-w-xl">
              <Input
                id="world-member-character-search"
                label="Search Characters"
                placeholder="Search by name or handle"
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
              />
            </div>
            {candidateQuery.isError ? (
              <RefreshNotice
                message={adminErrorMessage(
                  candidateQuery.error,
                  'Candidates unavailable.',
                )}
                onRetry={() => void candidateQuery.refetch()}
              />
            ) : null}
            <div className="mt-5">
              <DataTable
                rows={candidates}
                columns={candidateColumns({
                  assignMutation,
                  onAssign: assignCharacter,
                  assignmentDisabled: !membershipReady,
                })}
                rowKey={(character) => character.id}
                caption="Unassigned Characters"
                loading={
                  candidateQuery.isPending && candidateQuery.data === undefined
                }
                loadingSlot={<CandidateRowsSkeleton />}
                emptySlot={
                  <EmptyState
                    icon={UserPlus}
                    title="No World-unassigned Characters found"
                    description={
                      candidateSearch.trim().length > 0
                        ? 'Try another search.'
                        : candidateQuery.data?.items.length
                          ? candidatePageCount === 1
                            ? 'Every matching Character is already assigned to this World.'
                            : `No unassigned Characters on page ${candidatePage}. Use pagination or search to find another candidate.`
                          : 'Assign an active Character to add the first resident.'
                    }
                    action={
                      candidateSearch.trim().length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCandidateSearch('')}
                        >
                          Clear search
                        </Button>
                      ) : (
                        <Link
                          to="/admin"
                          search={{ tab: 'characters' }}
                          className={buttonClasses('outline', 'sm')}
                        >
                          Open Character registry
                        </Link>
                      )
                    }
                  />
                }
              />
            </div>
            {candidatePageCount > 1 ? (
              <Pagination
                label="Character candidate pages"
                page={candidatePage}
                totalPages={candidatePageCount}
                onPrevious={() =>
                  setCandidatePage((page) => Math.max(1, page - 1))
                }
                onNext={() =>
                  setCandidatePage((page) =>
                    Math.min(candidatePageCount, page + 1),
                  )
                }
                disabled={candidateQuery.isFetching}
              />
            ) : null}
          </>
        )}

        {assignMutation.isError ? (
          <MutationError
            message={adminErrorMessage(
              assignMutation.error,
              'Character assignment failed.',
            )}
          />
        ) : null}
      </GlassPanel>

      {updateMutation.isError ? (
        <MutationError
          message={adminErrorMessage(
            updateMutation.error,
            'Membership update failed.',
          )}
        />
      ) : null}

      <Modal
        open={deactivationTarget !== null}
        onClose={() => {
          if (!updateMutation.isPending) {
            setDeactivationTarget(null);
          }
        }}
        title="Deactivate World membership?"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={updateMutation.isPending}
              onClick={() => setDeactivationTarget(null)}
            >
              Keep active
            </Button>
            <Button
              variant="danger"
              loading={updateMutation.isPending}
              onClick={() => {
                if (deactivationTarget) {
                  updateMembership(deactivationTarget, false);
                }
              }}
            >
              Deactivate membership
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink/70">
          Removes this Character from the World. Global Character status is
          unchanged.
        </p>
        {deactivationTarget?.character ? (
          <p className="mt-3 font-medium">
            {deactivationTarget.character.name}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function memberColumns({
  updateMutation,
  onDeactivate,
  onReactivate,
}: {
  updateMutation: ReturnType<typeof useUpdateWorldMember>;
  onDeactivate: (row: MemberRow) => void;
  onReactivate: (row: MemberRow) => void;
}): readonly DataTableColumn<MemberRow>[] {
  return [
    {
      header: 'Character',
      cell: ({ member, character }) => (
        <div className="flex items-center gap-3">
          <Avatar
            src={character?.avatarUrl}
            alt={character?.name ?? 'Unknown Character'}
            name={character?.name ?? 'Unknown Character'}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {character?.name ?? 'Unknown Character'}
            </p>
            <p className="truncate font-mono text-xs text-ink/50">
              {character ? `@${character.handle}` : member.characterId}
            </p>
            {character?.classification ? (
              <p className="text-xs text-ink/60">
                {character.classification}
                {character.classificationGroup
                  ? ` · ${character.classificationGroup}`
                  : ''}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      header: 'Character status',
      cell: ({ character }) => (
        <Badge tone={character?.isActive ? 'success' : 'neutral'}>
          {character === undefined
            ? 'Unavailable'
            : character.isActive
              ? 'Active'
              : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Membership',
      cell: ({ member, character }) => (
        <div className="flex flex-col items-start gap-2">
          <Badge tone={member.isActive ? 'success' : 'neutral'}>
            {member.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {member.isActive && character?.isActive === false ? (
            <span className="max-w-[12rem] text-xs leading-relaxed text-brand-explorer">
              Character inactive; membership remains active.
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: 'Joined',
      cell: ({ member }) => (
        <span className="whitespace-nowrap text-ink/70">
          {formatDate(member.joinedAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => {
        const pending =
          updateMutation.isPending &&
          updateMutation.variables?.memberId === row.member.id;
        return row.member.isActive ? (
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => onDeactivate(row)}
            aria-label={`Deactivate membership for ${row.character?.name ?? 'Unknown Character'}`}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            loading={pending}
            onClick={() => onReactivate(row)}
            aria-label={`Reactivate membership for ${row.character?.name ?? 'Unknown Character'}`}
          >
            Reactivate
          </Button>
        );
      },
    },
  ];
}

function candidateColumns({
  assignMutation,
  onAssign,
  assignmentDisabled,
}: {
  assignMutation: ReturnType<typeof useAssignWorldMember>;
  onAssign: (character: AdminCharacterResponse) => void;
  assignmentDisabled: boolean;
}): readonly DataTableColumn<AdminCharacterResponse>[] {
  return [
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
          <div className="min-w-0">
            <p className="truncate font-medium">{character.name}</p>
            <p className="truncate font-mono text-xs text-ink/50">
              @{character.handle}
            </p>
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
      header: 'Character status',
      cell: (character) => (
        <Badge tone={character.isActive ? 'success' : 'neutral'}>
          {character.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (character) => {
        const pending =
          assignMutation.isPending &&
          assignMutation.variables?.characterId === character.id;
        return (
          <Button
            size="sm"
            loading={pending}
            disabled={!character.isActive || assignmentDisabled}
            onClick={() => onAssign(character)}
            aria-label={`Assign ${character.name}`}
            title={
              !character.isActive
                ? 'Inactive Characters cannot be assigned'
                : assignmentDisabled
                  ? 'Wait for the World membership list to finish loading'
                  : undefined
            }
          >
            Assign
          </Button>
        );
      },
    },
  ];
}

function Pagination({
  label,
  page,
  totalPages,
  onPrevious,
  onNext,
  disabled,
}: {
  label: string;
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className="mt-5 flex items-center justify-between gap-4"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || disabled}
        onClick={onPrevious}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </Button>
      <output className="text-xs text-ink/60">
        Page {page} of {totalPages}
      </output>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages || disabled}
        onClick={onNext}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}

function RefreshNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"
    >
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function MutationError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"
    >
      {message}
    </div>
  );
}

function MemberRowsSkeleton() {
  return (
    <div
      aria-label="Loading assigned AI Residents"
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </div>
  );
}

function CandidateRowsSkeleton() {
  return (
    <div
      aria-label="Loading Character candidates"
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
