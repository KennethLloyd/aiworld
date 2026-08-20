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
import { useMemo, useState } from 'react';

import {
  adminErrorMessage,
  isForbiddenError,
} from '@/features/admin/admin-errors';
import { useAdminResidents } from '@/features/admin/query/use-admin-residents';
import { useSimulationLogs } from '@/features/admin/query/use-simulation';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';

import { LogList, titleCase } from './simulation-log-list';

const LOG_PAGE_SIZE = 10;

interface LogFilters {
  characterId?: string;
  action?: SimulationActionType;
  status?: SimulationLogStatus;
  executionSource?: SimulationExecutionSource;
}

export function SimulationLogsTab({ world }: { world: WorldResponse }) {
  const [filters, setFilters] = useState<LogFilters>({});
  const [page, setPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const residentsQuery = useAdminResidents(world.slug);
  const residents = useMemo(
    () => residentsQuery.data?.items ?? [],
    [residentsQuery.data],
  );
  const query = useMemo<ListSimulationLogsQuery>(
    () => ({ ...filters, page, limit: LOG_PAGE_SIZE }),
    [filters, page],
  );
  const logsQuery = useSimulationLogs(world.slug, query);
  const residentNames = useMemo(
    () => new Map(residents.map((resident) => [resident.id, resident.name])),
    [residents],
  );

  const updateFilter = <K extends keyof LogFilters>(
    key: K,
    value: LogFilters[K] | '',
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value === '' ? undefined : value,
    }));
    setPage(1);
    setExpandedLogId(null);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
    setExpandedLogId(null);
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

  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Simulation Logs
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/70">
            Inspect persisted execution outcomes without exposing prompts or raw
            provider responses.
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
              label="Character / AI Resident"
              value={filters.characterId ?? ''}
              placeholder="Any Character"
              options={residents.map((resident) => ({
                value: resident.id,
                label: resident.name,
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
              label="Execution source"
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

      {logsQuery.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          <span>
            {adminErrorMessage(
              logsQuery.error,
              'The log list could not be refreshed. Showing the last successful snapshot.',
            )}
          </span>
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
          title="No simulation logs"
          description={
            hasFilters
              ? 'No execution records match the selected filters.'
              : 'Run one action or a custom action to create the first execution record.'
          }
        />
      ) : (
        <LogList
          logs={data.items}
          residentNames={residentNames}
          expandedLogId={expandedLogId}
          onToggle={(logId) =>
            setExpandedLogId((current) => (current === logId ? null : logId))
          }
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
            disabled={page <= 1 || logsQuery.isFetching}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
              setExpandedLogId(null);
            }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous page
          </Button>
          <output className="text-xs text-ink/60">
            Page {data.meta.page} of {data.meta.totalPages}
          </output>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.totalPages || logsQuery.isFetching}
            onClick={() => {
              setPage((current) => Math.min(data.meta.totalPages, current + 1));
              setExpandedLogId(null);
            }}
          >
            Next page
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
