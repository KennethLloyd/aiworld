import {
  simulationActionTypes,
  type SimulationActionType,
} from '@aiworld/shared/schemas/simulation-command.schema';
import type { SimulationLogResponse } from '@aiworld/shared/schemas/simulation-log.schema';
import type { SimulationRunResultResponse } from '@aiworld/shared/schemas/simulation-run.schema';
import type {
  SimulationConfigResponse,
  SimulationState,
} from '@aiworld/shared/schemas/simulation-state.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/core/api/api-error';
import { useAdminResidents } from '@/features/admin/query/use-admin-residents';
import {
  useRunCustomAction,
  useRunOneAction,
  useSimulation,
  useSimulationLogs,
  useSimulationTelemetry,
  useUpdateSimulationSpeed,
  useUpdateSimulationState,
} from '@/features/admin/query/use-simulation';
import { useToast } from '@/shared/feedback/toaster';
import { Badge, type BadgeTone } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';

const speedPresets = [0.5, 1, 2, 5, 10] as const;
const automaticAction = 'AUTOMATIC' as const;

type ManualAction = SimulationActionType | typeof automaticAction;
type FeedbackTone = 'success' | 'error' | 'info';

interface Feedback {
  tone: FeedbackTone;
  title: string;
  message: string;
}

export function SimulationStatusTab({ world }: { world: WorldResponse }) {
  const simulationQuery = useSimulation(world.slug);
  const telemetryQuery = useSimulationTelemetry(world.slug);
  const logsQuery = useSimulationLogs(world.slug);
  const residentsQuery = useAdminResidents(world.slug);
  const { toast } = useToast();
  const updateState = useUpdateSimulationState();
  const updateSpeed = useUpdateSimulationSpeed();
  const runOneAction = useRunOneAction();
  const runCustomAction = useRunCustomAction();
  const [targetCharacterId, setTargetCharacterId] = useState('');
  const [selectedAction, setSelectedAction] =
    useState<ManualAction>(automaticAction);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (simulationQuery.isPending && simulationQuery.data === undefined) {
    return <StatusSkeleton />;
  }

  if (simulationQuery.isError) {
    return (
      <ErrorState
        title="Could not load simulation"
        message={errorMessage(
          simulationQuery.error,
          'The selected World simulation could not be loaded.',
        )}
        onRetry={() => void simulationQuery.refetch()}
      />
    );
  }

  const config = simulationQuery.data;
  if (config === undefined) {
    return null;
  }

  const residents = residentsQuery.data?.items ?? [];
  const hasActiveResidents = residents.length > 0;
  const residentsUnavailable = residentsQuery.isError;
  const manualControlsBlocked =
    !hasActiveResidents || residentsQuery.isPending || residentsUnavailable;
  const manualActionPending =
    runOneAction.isPending || runCustomAction.isPending;

  const handleStateChange = (state: SimulationState) => {
    setFeedback(null);
    updateState.mutate(
      { slug: world.slug, input: { state } },
      {
        onSuccess: () => {
          setFeedback({
            tone: 'success',
            title: 'Simulation state saved',
            message: `Main loop is now ${state}.`,
          });
          toast({
            tone: 'success',
            title: `Simulation ${state.toLowerCase()}`,
          });
        },
        onError: (error) => {
          const message = errorMessage(error, 'State change failed.');
          setFeedback({ tone: 'error', title: 'State change failed', message });
          toast({
            tone: 'error',
            title: 'State change failed',
            description: message,
          });
        },
      },
    );
  };

  const handleSpeedChange = (value: string) => {
    const speedMultiplier = Number(value);
    if (!Number.isFinite(speedMultiplier)) {
      return;
    }
    setFeedback(null);
    updateSpeed.mutate(
      { slug: world.slug, input: { speedMultiplier } },
      {
        onSuccess: () => {
          setFeedback({
            tone: 'success',
            title: 'Speed saved',
            message: `Simulation speed is ${speedMultiplier}x.`,
          });
          toast({ tone: 'success', title: 'Simulation speed saved' });
        },
        onError: (error) => {
          const message = errorMessage(error, 'Speed change failed.');
          setFeedback({ tone: 'error', title: 'Speed change failed', message });
          toast({
            tone: 'error',
            title: 'Speed change failed',
            description: message,
          });
        },
      },
    );
  };

  const handleRunOneAction = () => {
    setFeedback(null);
    runOneAction.mutate(world.slug, {
      onSuccess: (result) => {
        setFeedback(resultFeedback('Run One Action', result));
      },
      onError: (error) => {
        setFeedback(manualErrorFeedback(config, error));
      },
    });
  };

  const handleCustomAction = () => {
    setFeedback(null);
    const input = {
      ...(targetCharacterId.length > 0
        ? { characterId: targetCharacterId }
        : {}),
      ...(selectedAction !== automaticAction
        ? { actionType: selectedAction }
        : {}),
    };
    runCustomAction.mutate(
      { slug: world.slug, input },
      {
        onSuccess: (result) => {
          setFeedback(resultFeedback('Custom action', result));
        },
        onError: (error) => {
          setFeedback(manualErrorFeedback(config, error));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-glass-border pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">
            Simulation Status
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-bold">{world.name}</h2>
            <Badge tone={stateTone(config.state)} dot>
              {config.state}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Simulation lifecycle">
          <StateButton
            state="RUNNING"
            currentState={config.state}
            pending={updateState.isPending}
            onClick={handleStateChange}
          />
          <StateButton
            state="PAUSED"
            currentState={config.state}
            pending={updateState.isPending}
            onClick={handleStateChange}
          />
          <StateButton
            state="HALTED"
            currentState={config.state}
            pending={updateState.isPending}
            onClick={handleStateChange}
          />
        </div>
      </div>

      {feedback ? <FeedbackMessage feedback={feedback} /> : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <TelemetryPanel
          config={config}
          world={world}
          telemetry={telemetryQuery.data}
          residentsCount={
            residentsQuery.data?.meta.total ?? world.residentCount
          }
          isPending={
            telemetryQuery.isPending && telemetryQuery.data === undefined
          }
          isError={telemetryQuery.isError}
          onRetry={() => void telemetryQuery.refetch()}
        />
        <GlassPanel
          as="section"
          aria-labelledby="demo-controls-heading"
          className="min-w-0 p-5 lg:col-span-2"
        >
          <PanelHeading
            id="demo-controls-heading"
            icon={Terminal}
            title="Demo Controls"
          />
          <div className="mt-5 flex flex-col gap-5">
            <Select
              id="simulation-speed"
              label="Simulation speed"
              value={String(config.speedMultiplier)}
              options={speedPresets.map((speed) => ({
                value: String(speed),
                label: `${speed}x`,
              }))}
              disabled={updateSpeed.isPending}
              onChange={(event) => handleSpeedChange(event.target.value)}
            />
            <p className="-mt-3 text-xs leading-relaxed text-ink/50">
              Presets submit the shared 0.1–100 multiplier. The scheduler owns
              pacing and action selection.
            </p>

            <Button
              variant="primary"
              loading={runOneAction.isPending}
              disabled={manualControlsBlocked}
              onClick={handleRunOneAction}
              className="w-full uppercase tracking-wider"
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
              Run One Action
            </Button>
            {residentsUnavailable ? (
              <ErrorState
                title="Could not load active AI Residents"
                message="Manual controls are unavailable until the resident directory is reachable."
                onRetry={() => void residentsQuery.refetch()}
                className="-mt-3 p-4"
              />
            ) : !hasActiveResidents && !residentsQuery.isPending ? (
              <p className="-mt-3 text-xs text-brand-explorer">
                No active AI Residents are available for manual work.
              </p>
            ) : null}

            <div className="flex flex-col gap-4 border-t border-glass-border pt-5">
              <Select
                id="target-ai-resident"
                label="Target AI Resident"
                value={targetCharacterId}
                options={[
                  { value: '', label: 'Any Character' },
                  ...residents.map((resident) => ({
                    value: resident.id,
                    label: `${resident.name} (${resident.classification ?? 'Resident'})`,
                  })),
                ]}
                disabled={manualControlsBlocked}
                onChange={(event) => setTargetCharacterId(event.target.value)}
              />
              <Select
                id="manual-action"
                label="Action"
                value={selectedAction}
                options={[
                  { value: automaticAction, label: 'Automatic' },
                  ...simulationActionTypes.map((action) => ({
                    value: action,
                    label: titleCaseAction(action),
                  })),
                ]}
                disabled={manualControlsBlocked}
                onChange={(event) =>
                  setSelectedAction(event.target.value as ManualAction)
                }
              />
              <Button
                variant="outline"
                loading={runCustomAction.isPending}
                disabled={manualControlsBlocked || manualActionPending}
                onClick={handleCustomAction}
                className="w-full uppercase tracking-wider"
              >
                <Terminal className="h-4 w-4" aria-hidden="true" />
                Custom Action
              </Button>
            </div>
          </div>
        </GlassPanel>
        <RecentActivityPanel
          logs={logsQuery.data?.items ?? []}
          isPending={logsQuery.isPending && logsQuery.data === undefined}
          isError={logsQuery.isError}
          onRetry={() => void logsQuery.refetch()}
        />
      </div>
    </div>
  );
}

function StateButton({
  state,
  currentState,
  pending,
  onClick,
}: {
  state: SimulationState;
  currentState: SimulationState;
  pending: boolean;
  onClick: (state: SimulationState) => void;
}) {
  const icon =
    state === 'RUNNING' ? Play : state === 'PAUSED' ? RotateCcw : Square;
  const Icon = icon;
  return (
    <Button
      variant={currentState === state ? 'primary' : 'ghost'}
      size="sm"
      loading={pending && currentState !== state}
      disabled={pending}
      aria-pressed={currentState === state}
      onClick={() => onClick(state)}
      className="font-mono uppercase tracking-wider"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {state === 'RUNNING' ? 'Run' : state === 'PAUSED' ? 'Pause' : 'Halt'}
    </Button>
  );
}

function TelemetryPanel({
  config,
  world,
  telemetry,
  residentsCount,
  isPending,
  isError,
  onRetry,
}: {
  config: SimulationConfigResponse;
  world: WorldResponse;
  telemetry: ReturnType<typeof useSimulationTelemetry>['data'];
  residentsCount: number;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <GlassPanel
      as="section"
      aria-labelledby="telemetry-heading"
      className="min-w-0 p-5 lg:col-span-1"
    >
      <PanelHeading id="telemetry-heading" icon={Activity} title="Telemetry" />
      {isPending ? (
        <div
          className="mt-5 flex flex-col gap-3"
          aria-label="Loading telemetry"
          aria-busy="true"
        >
          <Skeleton variant="row" />
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load telemetry"
          message="Telemetry will retry on the next polling interval."
          onRetry={onRetry}
          className="mt-4 p-4"
        />
      ) : (
        <dl className="mt-5 flex flex-col gap-4 text-sm">
          <TelemetryRow label="Main Loop">
            <Badge tone={stateTone(config.state)}>{config.state}</Badge>
          </TelemetryRow>
          <TelemetryRow label="Clock Speed">
            <span>
              {formatInterval(config.intervalMs, config.speedMultiplier)}
            </span>
          </TelemetryRow>
          <TelemetryRow label="Active Residents">
            <span>{residentsCount}</span>
          </TelemetryRow>
          <TelemetryRow label="Total Runs">
            <span>{telemetry?.totalRuns ?? 0}</span>
          </TelemetryRow>
          <TelemetryRow label="Token Burn">
            <span>{formatNumber(telemetry?.totalTokensUsed)}</span>
          </TelemetryRow>
          <TelemetryRow label="Estimated API Cost">
            <span>{formatCost(telemetry?.totalCostEstimateUsd)}</span>
          </TelemetryRow>
          <TelemetryRow label="Last Run">
            <span>{formatDate(telemetry?.lastRunAt)}</span>
          </TelemetryRow>
          <TelemetryRow label="World ID">
            <code
              className="block max-w-full truncate font-mono text-xs text-ink/50"
              title={world.id}
            >
              {world.id}
            </code>
          </TelemetryRow>
        </dl>
      )}
    </GlassPanel>
  );
}

function RecentActivityPanel({
  logs,
  isPending,
  isError,
  onRetry,
}: {
  logs: readonly SimulationLogResponse[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <GlassPanel
      as="section"
      aria-labelledby="recent-activity-heading"
      className="min-w-0 p-5 lg:col-span-3"
    >
      <PanelHeading
        id="recent-activity-heading"
        icon={Clock3}
        title="Recent Execution"
      />
      {isPending ? (
        <div
          className="mt-5 flex flex-col gap-3"
          aria-label="Loading recent execution"
          aria-busy="true"
        >
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load recent execution"
          message="Recent logs will retry on the next polling interval."
          onRetry={onRetry}
          className="mt-4 p-4"
        />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No simulation activity yet"
          description="Run one action or a custom action to create the first execution record."
          className="mt-4"
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-glass-border">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <caption className="sr-only">Recent simulation execution</caption>
            <thead className="border-b border-glass-border bg-glass-20 text-xs uppercase tracking-wider text-ink/60">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Source
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Latency
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Executed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {log.executionSource}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={logStatusTone(log.status)}>{log.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {log.latencyMs === null ? '—' : `${log.latencyMs} ms`}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {formatDate(log.executedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassPanel>
  );
}

function PanelHeading({
  id,
  icon: Icon,
  title,
}: {
  id: string;
  icon: typeof Activity;
  title: string;
}) {
  return (
    <h3
      id={id}
      className="flex items-center gap-2 border-b border-glass-border pb-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/60"
    >
      <Icon className="h-4 w-4 text-brand-diplomat" aria-hidden="true" />
      {title}
    </h3>
  );
}

function TelemetryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-3 border-b border-glass-border pb-2 last:border-b-0">
      <dt className="min-w-0 text-ink/70">{label}</dt>
      <dd className="min-w-0 max-w-[65%] text-right font-medium text-ink">
        {children}
      </dd>
    </div>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  const Icon = feedback.tone === 'success' ? CheckCircle2 : CircleAlert;
  return (
    <div
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      aria-label={feedback.title}
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${feedback.tone === 'error' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-brand-diplomat/40 bg-brand-diplomat/10 text-brand-diplomat'}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{feedback.title}</p>
        <p className="mt-1 text-xs opacity-80">{feedback.message}</p>
      </div>
    </div>
  );
}

function StatusSkeleton() {
  return (
    <div
      className="grid min-w-0 gap-6 lg:grid-cols-3"
      aria-label="Loading simulation"
      aria-busy="true"
    >
      <Skeleton variant="detail" className="lg:col-span-1" />
      <Skeleton variant="detail" className="lg:col-span-2" />
      <Skeleton variant="detail" className="lg:col-span-1" />
    </div>
  );
}

function resultFeedback(
  label: string,
  result: SimulationRunResultResponse,
): Feedback {
  if (result.status === 'success') {
    return {
      tone: 'success',
      title: `${label} completed`,
      message: `${result.log.action} completed for the selected World.`,
    };
  }
  return {
    tone: 'error',
    title: `${label} failed`,
    message: result.failure.message,
  };
}

function manualErrorFeedback(
  config: SimulationConfigResponse,
  error: unknown,
): Feedback {
  const message = errorMessage(
    error,
    'The manual action could not be completed.',
  );
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    (config.state === 'HALTED' || message.toUpperCase().includes('HALTED'))
  ) {
    return {
      tone: 'error',
      title: 'Simulation action refused',
      message: `HALTED: ${message}`,
    };
  }
  return { tone: 'error', title: 'Simulation action failed', message };
}

function stateTone(state: SimulationState): BadgeTone {
  if (state === 'RUNNING') return 'success';
  if (state === 'PAUSED') return 'warning';
  return 'danger';
}

function logStatusTone(status: SimulationLogResponse['status']): BadgeTone {
  if (status === 'SUCCESS') return 'success';
  if (status === 'REJECTED') return 'warning';
  if (status === 'SKIPPED') return 'neutral';
  return 'danger';
}

function titleCaseAction(action: SimulationActionType): string {
  return action[0] + action.slice(1).toLowerCase();
}

function formatInterval(intervalMs: number, speedMultiplier: number): string {
  const minutes = Math.max(1, Math.round(intervalMs / 60_000));
  return `${minutes}m @ ${speedMultiplier}x`;
}

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString();
}

function formatCost(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `$${value.toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.toUserMessage();
  if (error instanceof Error) return error.message;
  return fallback;
}
