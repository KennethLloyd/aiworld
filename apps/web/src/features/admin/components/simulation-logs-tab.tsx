import {
  simulationActionTypes,
  simulationExecutionSources,
  type SimulationActionType,
  type SimulationExecutionSource,
} from '@aiworld/shared/schemas/simulation-command.schema';
import {
  simulationLogStatuses,
  type ListSimulationLogsQuery,
  type SimulationLogStatus,
} from '@aiworld/shared/schemas/simulation-log.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  adminErrorMessage,
  isForbiddenError,
} from '@/features/admin/admin-errors';
import { useSimulationLogs } from '@/features/admin/query/use-simulation';
import { useAdminCharacterDirectory } from '@/features/characters/query/use-admin-characters';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';

import { LogList, titleCase } from './simulation-log-list';

const LOG_PAGE_SIZE = 10;

export interface LogFilters {
  characterId?: string;
  action?: SimulationActionType;
  status?: SimulationLogStatus;
  executionSource?: SimulationExecutionSource;
}

export interface SimulationLogsTabProps {
  world: WorldResponse;
  selectedLogId?: string;
  filters: LogFilters;
  page: number;
  onFiltersChange: (filters: LogFilters) => void;
  onPageChange: (page: number) => void;
  onSelectedLogChange?: (logId: string | undefined) => void;
}
export function SimulationLogsTab({
  world,
  selectedLogId,
  filters,
  page,
  onFiltersChange,
  onPageChange,
  onSelectedLogChange,
}: SimulationLogsTabProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const charactersQuery = useAdminCharacterDirectory();
  const characters = useMemo(
    () => charactersQuery.data ?? [],
    [charactersQuery.data],
  );
  const query = useMemo<ListSimulationLogsQuery>(
    () => ({ ...filters, page, limit: LOG_PAGE_SIZE }),
    [filters, page],
  );
  const logsQuery = useSimulationLogs(world.slug, query);
  const residentNames = useMemo(
    () =>
      new Map(characters.map((character) => [character.id, character.name])),
    [characters],
  );
  useEffect(() => {
    setExpandedLogId(selectedLogId ?? null);
  }, [selectedLogId]);
  const updateFilter = <K extends keyof LogFilters>(
    key: K,
    value: LogFilters[K] | '',
  ) => {
    const nextFilters = {
      ...filters,
      [key]: value === '' ? undefined : value,
    };
    onFiltersChange(nextFilters);
    setExpandedLogId(null);
  };

  const clearFilters = () => {
    onFiltersChange({});
    setExpandedLogId(null);
  };
  const changePage = (nextPage: number) => {
    onPageChange(nextPage);
    setExpandedLogId(null);
  };

  const toggleLog = (logId: string) => {
    const nextLogId = expandedLogId === logId ? undefined : logId;
    setExpandedLogId(nextLogId ?? null);
    onSelectedLogChange?.(nextLogId);
  };

  if (logsQuery.isPending && logsQuery.data === undefined) {
    return <SimulationLogsSkeleton />;
  }

  if (logsQuery.isError && logsQuery.data === undefined) {
    return (
      <ErrorState
        title="Could not load simulation logs"
        message={
          isForbiddenError(logsQuery.error)
            ? undefined
            : adminErrorMessage(
                logsQuery.error,
                'Something went wrong while loading simulation logs.',
              )
        }
        forbidden={isForbiddenError(logsQuery.error)}
        onRetry={() => void logsQuery.refetch()}
      />
    );
  }

  const data = logsQuery.data;
  if (data === undefined) {
    return null;
  }

  const selectedLogMissing =
    !logsQuery.isFetching &&
    selectedLogId !== undefined &&
    !data.items.some((log) => log.id === selectedLogId);

  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand-diplomat/80">
            World workspace / logs
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Simulation Logs
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/70">
            Review execution history for {world.name}. Expand a record for
            provider, latency, token, cost, and safe error details.
          </p>
        </div>
        <p className="font-mono text-xs text-ink/50" aria-live="polite">
          {logsQuery.isFetching ? 'Refreshing · ' : ''}
          {data.meta.total} {data.meta.total === 1 ? 'log' : 'logs'}
        </p>
      </header>

      <GlassPanel
        as="section"
        aria-labelledby="simulation-log-filters"
        className="p-5"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3
              id="simulation-log-filters"
              className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/60"
            >
              Filters
            </h3>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasFilters}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              id="simulation-log-character"
              label="Character"
              value={filters.characterId ?? ''}
              placeholder="Any Character"
              options={characters.map((character) => ({
                value: character.id,
                label: character.name,
              }))}
              onChange={(event) =>
                updateFilter('characterId', event.target.value)
              }
            />
            <Select
              id="simulation-log-action"
              label="Action"
              value={filters.action ?? ''}
              placeholder="All actions"
              options={simulationActionTypes.map((action) => ({
                value: action,
                label: titleCase(action),
              }))}
              onChange={(event) =>
                updateFilter(
                  'action',
                  event.target.value as SimulationActionType | '',
                )
              }
            />
            <Select
              id="simulation-log-status"
              label="Status"
              value={filters.status ?? ''}
              placeholder="All statuses"
              options={simulationLogStatuses.map((status) => ({
                value: status,
                label: titleCase(status),
              }))}
              onChange={(event) =>
                updateFilter(
                  'status',
                  event.target.value as SimulationLogStatus | '',
                )
              }
            />
            <Select
              id="simulation-log-execution-source"
              label="Source"
              value={filters.executionSource ?? ''}
              placeholder="All sources"
              options={simulationExecutionSources.map((source) => ({
                value: source,
                label: titleCase(source),
              }))}
              onChange={(event) =>
                updateFilter(
                  'executionSource',
                  event.target.value as SimulationExecutionSource | '',
                )
              }
            />
          </div>
        </div>
      </GlassPanel>
      {selectedLogMissing ? (
        <div
          role="alert"
          aria-label="Selected log unavailable"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"
        >
          <span>
            The selected log is not on this page or is no longer available.
          </span>
          {onSelectedLogChange ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectedLogChange(undefined)}
            >
              Clear selected log
            </Button>
          ) : null}
        </div>
      ) : null}

      {logsQuery.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          <span>{adminErrorMessage(logsQuery.error, 'Logs unavailable.')}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void logsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            selectedLogMissing
              ? 'Selected log unavailable'
              : 'No simulation logs'
          }
          description={
            selectedLogMissing
              ? 'The selected log is not available in the current results.'
              : hasFilters
                ? 'No execution records match the selected filters.'
                : 'No execution records yet.'
          }
        />
      ) : (
        <LogList
          logs={data.items}
          residentNames={residentNames}
          expandedLogId={expandedLogId}
          onToggle={toggleLog}
        />
      )}

      {data.meta.totalPages > 1 ? (
        <nav
          aria-label="Simulation log pagination"
          className="flex items-center justify-between gap-4"
        >
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous page"
            disabled={page <= 1 || logsQuery.isFetching}
            onClick={() => changePage(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous page</span>
          </Button>
          <output className="text-xs text-ink/60">
            Page {data.meta.page} of {data.meta.totalPages}
          </output>
          <Button
            variant="outline"
            size="sm"
            aria-label="Next page"
            disabled={page >= data.meta.totalPages || logsQuery.isFetching}
            onClick={() => changePage(Math.min(data.meta.totalPages, page + 1))}
          >
            <span className="hidden sm:inline">Next page</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function SimulationLogsSkeleton() {
  return (
    <div
      aria-label="Loading simulation logs"
      aria-busy="true"
      className="flex flex-col gap-4"
    >
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
    </div>
  );
}
