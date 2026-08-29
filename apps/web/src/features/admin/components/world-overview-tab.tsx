import type { SimulationHealthResponse } from '@aiworld/shared/schemas/simulation-health.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Activity, AlertTriangle, Clock3, HeartPulse } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import {
  adminErrorMessage,
  isForbiddenError,
} from '@/features/admin/admin-errors';
import { useAdminResidents } from '@/features/admin/query/use-admin-residents';
import {
  useSimulation,
  useSimulationHealth,
  useSimulationLogs,
} from '@/features/admin/query/use-simulation';
import { useAdminCharacterDirectory } from '@/features/characters/query/use-admin-characters';
import { Badge, type BadgeTone } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

import { LogList } from './simulation-log-list';

export function WorldOverviewTab({
  world,
  onOpenLog,
}: {
  world: WorldResponse;
  onOpenLog?: (logId: string) => void;
}) {
  const simulationQuery = useSimulation(world.slug);
  const healthQuery = useSimulationHealth(world.slug);
  const logsQuery = useSimulationLogs(world.slug);
  const residentsQuery = useAdminResidents(world.slug);
  const characterDirectoryQuery = useAdminCharacterDirectory();
  const residents = residentsQuery.data?.items;
  const residentNames = useMemo(
    () =>
      new Map<string, string>([
        ...(characterDirectoryQuery.data ?? []).map(
          (character): [string, string] => [character.id, character.name],
        ),
        ...(residents ?? []).map((resident): [string, string] => [
          resident.id,
          resident.name,
        ]),
      ]),
    [characterDirectoryQuery.data, residents],
  );

  if (simulationQuery.isPending && simulationQuery.data === undefined) {
    return <OverviewSkeleton />;
  }
  if (simulationQuery.isError && simulationQuery.data === undefined) {
    return (
      <ErrorState
        title="Could not load World overview"
        message={adminErrorMessage(
          simulationQuery.error,
          'Simulation state unavailable.',
        )}
        onRetry={() => void simulationQuery.refetch()}
      />
    );
  }
  const config = simulationQuery.data;
  if (config === undefined) return null;

  const health = healthQuery.data;
  const telemetry = health?.telemetry;
  const runtimeStatus = health?.health.status ?? 'UNKNOWN';
  const healthWarning =
    health !== undefined &&
    (runtimeStatus === 'DEGRADED' || runtimeStatus === 'UNHEALTHY');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-glass-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand-diplomat/80">
            World workspace / overview
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {world.name}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/70">
            Operational health at a glance. Use Simulation to change runtime
            behavior and Residents to manage World membership.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="World state">
          <Badge tone={stateTone(config.state)} dot>
            Lifecycle: {config.state}
          </Badge>
          <Badge tone={healthTone(runtimeStatus)} dot>
            Health: {runtimeStatus}
          </Badge>
        </div>
      </header>

      {healthWarning && health?.health.reason ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Runtime needs attention</p>
            <p className="mt-1 text-rose-100/80">{health.health.reason}</p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="world-pulse-heading">
        <div className="mb-3 flex items-center gap-2">
          <Activity
            className="h-4 w-4 text-brand-diplomat"
            aria-hidden="true"
          />
          <h3
            id="world-pulse-heading"
            className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/60"
          >
            Operational pulse
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PulseItem
            label="Active Residents"
            value={residentsQuery.data?.meta.total ?? world.residentCount}
          />
          <PulseItem
            label="Iterations"
            value={formatNumber(telemetry?.totalRuns)}
          />
          <PulseItem
            label="Successful"
            value={formatNumber(telemetry?.successCount)}
            tone="success"
          />
          <PulseItem
            label="Failed"
            value={formatNumber(telemetry?.failedCount)}
            tone="danger"
          />
        </div>
      </section>

      <GlassPanel
        as="section"
        aria-labelledby="health-heading"
        className="p-5 sm:p-6"
      >
        <div className="flex items-center gap-2">
          <HeartPulse
            className="h-4 w-4 text-brand-diplomat"
            aria-hidden="true"
          />
          <h3
            id="health-heading"
            className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/60"
          >
            Simulation health
          </h3>
        </div>
        {healthQuery.isPending && health === undefined ? (
          <div
            className="mt-5 flex flex-col gap-3"
            aria-label="Loading World health"
            aria-busy="true"
          >
            <Skeleton variant="row" />
            <Skeleton variant="row" />
            <Skeleton variant="row" />
          </div>
        ) : healthQuery.isError && health === undefined ? (
          <ErrorState
            title="Could not load runtime health"
            message={
              isForbiddenError(healthQuery.error)
                ? undefined
                : adminErrorMessage(
                    healthQuery.error,
                    'Runtime health unavailable.',
                  )
            }
            forbidden={isForbiddenError(healthQuery.error)}
            onRetry={() => void healthQuery.refetch()}
            className="mt-4 p-4"
          />
        ) : health ? (
          <dl className="mt-5 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <HealthItem label="Lifecycle">
              <Badge tone={stateTone(health.lifecycle.state)}>
                {health.lifecycle.state}
              </Badge>
            </HealthItem>
            <HealthItem label="Runtime health">
              <Badge tone={healthTone(health.health.status)} dot>
                {health.health.status}
              </Badge>
            </HealthItem>
            <HealthItem label="Scheduler">
              <span>{schedulerLabel(health)}</span>
            </HealthItem>
            <HealthItem label="Last successful action">
              <span>{formatDate(health.execution.lastSuccessAt)}</span>
            </HealthItem>
            <HealthItem label="Next scheduled tick">
              <span>{formatDate(health.scheduler.nextTickAt)}</span>
            </HealthItem>
            <HealthItem label="Provider">
              <Badge tone={healthTone(health.provider.status)} dot>
                {health.provider.status}
              </Badge>
            </HealthItem>
            <HealthItem label="Average latency">
              <span>{formatLatency(telemetry?.averageLatencyMs)}</span>
            </HealthItem>
            <HealthItem label="Token usage">
              <span>{formatNumber(telemetry?.totalTokensUsed)}</span>
            </HealthItem>
            <HealthItem label="Estimated cost">
              <span>{formatCost(telemetry?.totalCostEstimateUsd)}</span>
            </HealthItem>
          </dl>
        ) : null}
      </GlassPanel>

      <GlassPanel
        as="section"
        aria-labelledby="overview-activity-heading"
        className="p-5 sm:p-6"
      >
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-brand-diplomat" aria-hidden="true" />
          <h3
            id="overview-activity-heading"
            className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/60"
          >
            Recent activity
          </h3>
        </div>
        {logsQuery.isPending && logsQuery.data === undefined ? (
          <div
            className="mt-5 flex flex-col gap-3"
            aria-label="Loading recent activity"
            aria-busy="true"
          >
            <Skeleton variant="row" />
            <Skeleton variant="row" />
          </div>
        ) : logsQuery.isError && logsQuery.data === undefined ? (
          <ErrorState
            title="Could not load recent activity"
            message={adminErrorMessage(
              logsQuery.error,
              'Recent activity unavailable.',
            )}
            onRetry={() => void logsQuery.refetch()}
            className="mt-4 p-4"
          />
        ) : logsQuery.data?.items.length ? (
          <div className="mt-4">
            <LogList
              logs={logsQuery.data.items}
              residentNames={residentNames}
              expandedLogId={null}
              onToggle={(logId) => onOpenLog?.(logId)}
            />
          </div>
        ) : (
          <EmptyState icon={Clock3} title="No activity yet" className="mt-4" />
        )}
      </GlassPanel>
    </div>
  );
}

function PulseItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: BadgeTone;
}) {
  return (
    <div className="rounded-xl border border-glass-border bg-glass-20 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${tone === 'danger' ? 'text-rose-200' : tone === 'success' ? 'text-emerald-200' : 'text-ink'}`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function HealthItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-glass-border/70 pb-3 last:border-b-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
      <dt className="text-xs uppercase tracking-wider text-ink/50">{label}</dt>
      <dd className="text-sm text-ink/90">{children}</dd>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-label="Loading World overview"
      aria-busy="true"
    >
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
    </div>
  );
}

function schedulerLabel(health: SimulationHealthResponse): string {
  if (!health.scheduler.available) return 'Unavailable';
  if (health.scheduler.pending) return 'Available · pending';
  if (health.scheduler.workExpected) return 'Available · waiting';
  return 'Available · idle';
}

function stateTone(
  state: SimulationHealthResponse['lifecycle']['state'],
): BadgeTone {
  if (state === 'RUNNING') return 'success';
  if (state === 'HALTED') return 'danger';
  return 'warning';
}

function healthTone(
  status:
    | SimulationHealthResponse['health']['status']
    | SimulationHealthResponse['provider']['status'],
): BadgeTone {
  if (status === 'HEALTHY') return 'success';
  if (status === 'DEGRADED') return 'warning';
  if (status === 'UNHEALTHY') return 'danger';
  return 'neutral';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatLatency(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value} ms`;
}

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString();
}

function formatCost(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `$${value.toFixed(4)}`;
}
