import {
  type SimulationLogResponse,
  type SimulationLogStatus,
} from '@aiworld/shared/schemas/simulation-log.schema';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Fragment } from 'react';

import { Badge, type BadgeTone } from '@/shared/ui/badge';

export function LogList({
  logs,
  residentNames,
  expandedLogId,
  onToggle,
}: {
  logs: readonly SimulationLogResponse[];
  residentNames: ReadonlyMap<string, string>;
  expandedLogId: string | null;
  onToggle: (logId: string) => void;
}) {
  return (
    <>
      <section
        className="hidden overflow-x-auto rounded-xl border border-glass-border sm:block"
        aria-label="Simulation log records table"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Simulation log records</caption>
          <thead className="border-b border-glass-border bg-glass-20 text-xs uppercase tracking-wider text-ink/60">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Character
              </th>
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
                Executed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {logs.map((log) => {
              const residentName = residentNames.get(log.characterId);
              const label = residentName ?? log.characterId;
              const expanded = expandedLogId === log.id;
              const detailsId = `simulation-log-details-${log.id}`;
              return (
                <Fragment key={log.id}>
                  <tr className="align-top transition-colors hover:bg-glass-20">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="group inline-flex items-center gap-2 text-left font-medium text-brand-sentinel hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
                        aria-expanded={expanded}
                        aria-controls={detailsId}
                        aria-label={`${expanded ? 'Hide' : 'Show'} desktop details for ${label}`}
                        onClick={() => onToggle(log.id)}
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{residentName ?? 'Unknown Character'}</span>
                      </button>
                      {residentName === undefined ? (
                        <code className="mt-1 block max-w-[15rem] truncate font-mono text-[10px] text-ink/50">
                          {log.characterId}
                        </code>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {titleCase(log.action)}
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {titleCase(log.executionSource)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(log.status)}>
                        {titleCase(log.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {formatDate(log.executedAt)}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr id={detailsId}>
                      <td
                        colSpan={5}
                        className="border-t border-glass-border bg-glass-20 px-4 py-4"
                      >
                        <LogDetails log={log} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <section
        className="flex flex-col gap-2 sm:hidden"
        aria-label="Simulation log records"
      >
        {logs.map((log) => {
          const residentName = residentNames.get(log.characterId);
          const label = residentName ?? 'Unknown Character';
          const expanded = expandedLogId === log.id;
          const detailsId = `simulation-log-details-mobile-${log.id}`;
          return (
            <article
              key={log.id}
              className="rounded-xl border border-glass-border bg-glass-20"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-sentinel/60"
                aria-expanded={expanded}
                aria-controls={detailsId}
                aria-label={`${expanded ? 'Hide' : 'Show'} details for ${label}`}
                onClick={() => onToggle(log.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-brand-sentinel">
                    {label}
                  </span>
                  <span className="mt-1 block font-mono text-xs text-ink/60">
                    {titleCase(log.action)} · {titleCase(log.executionSource)}
                  </span>
                  <span className="mt-1 block text-xs text-ink/55">
                    {formatDate(log.executedAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={statusTone(log.status)}>
                    {titleCase(log.status)}
                  </Badge>
                  {expanded ? (
                    <ChevronUp
                      className="h-4 w-4 text-ink/60"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      className="h-4 w-4 text-ink/60"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </button>
              {expanded ? (
                <div
                  id={detailsId}
                  className="border-t border-glass-border bg-glass-20 px-4 py-4"
                >
                  <LogDetails log={log} />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </>
  );
}

function LogDetails({ log }: { log: SimulationLogResponse }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <DetailItem label="Provider" value={log.provider} />
      <DetailItem label="Model" value={log.model} />
      <DetailItem
        label="Latency"
        value={log.latencyMs === null ? '—' : `${log.latencyMs} ms`}
      />
      <DetailItem label="Job ID" value={log.jobId ?? '—'} mono />
      <DetailItem label="Tokens" value={formatNumber(log.tokensUsed)} />
      <DetailItem label="Cost" value={formatCost(log.costEstimate)} />
      <DetailItem label="Status" value={titleCase(log.status)} />
      <DetailItem label="Source" value={titleCase(log.executionSource)} />
      <DetailItem label="Execution time" value={formatDate(log.executedAt)} />
      <DetailItem
        label="Reasoning"
        value={log.reasoning ?? '—'}
        className="sm:col-span-2 lg:col-span-3"
      />
      {log.errorMessage !== null ? (
        <DetailItem
          label="Error details"
          value={log.errorMessage}
          className="sm:col-span-2 lg:col-span-4"
        />
      ) : null}
    </dl>
  );
}

function DetailItem({
  label,
  value,
  className,
  mono = false,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wider text-ink/50">{label}</dt>
      <dd className={mono ? 'mt-1 break-all font-mono text-xs' : 'mt-1'}>
        {value}
      </dd>
    </div>
  );
}

function statusTone(status: SimulationLogStatus): BadgeTone {
  if (status === 'SUCCESS') return 'success';
  if (status === 'REJECTED') return 'warning';
  if (status === 'SKIPPED') return 'neutral';
  return 'danger';
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatNumber(value: number | null): string {
  return value === null ? '—' : value.toLocaleString();
}

function formatCost(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '$0.00';
  return `$${Math.abs(value) < 0.01 ? value.toFixed(6) : value.toFixed(2)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
