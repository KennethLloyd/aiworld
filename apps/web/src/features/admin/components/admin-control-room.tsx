import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link, useNavigate } from '@tanstack/react-router';
import { Cpu, ExternalLink, ShieldCheck, Terminal } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';

import type { AdminDashboardSearch } from '@/features/admin/admin-search';
import { useWorlds } from '@/features/worlds/query/use-worlds';
import { useToast } from '@/shared/feedback/toaster';
import { buttonClasses } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';

import { CharacterRegistryTab } from './character-registry-tab';
import { SimulationStatusTab } from './simulation-status-tab';
import { WorldConfigTab } from './world-config-tab';

const adminWorldsQuery = { page: 1, limit: 100 } as const;

const tabs = [
  { value: 'status', label: 'Simulation Status' },
  { value: 'world', label: 'World Config' },
  { value: 'characters', label: 'Agents' },
  { value: 'logs', label: 'LLM Logs' },
] as const;

export function AdminControlRoom({ search }: { search: AdminDashboardSearch }) {
  const navigate = useNavigate({ from: '/admin/' });
  const { toast } = useToast();
  const tabRefs = useRef<
    Record<AdminDashboardSearch['tab'], HTMLButtonElement | null>
  >({
    status: null,
    world: null,
    characters: null,
    logs: null,
  });
  const worldsQuery = useWorlds(adminWorldsQuery);
  const worlds = worldsQuery.data?.items ?? [];
  const selectedWorld = resolveSelectedWorld(worlds, search.world);

  const handleWorldChange = (slug: string) => {
    void navigate({
      search: (previous) => ({ ...previous, world: slug }),
    });
  };

  const selectTab = (tab: AdminDashboardSearch['tab']) => {
    void navigate({
      search: (previous) => ({ ...previous, tab }),
    });
  };

  const showComingSoon = (label: string) => {
    toast({
      tone: 'info',
      title: `${label} is coming next`,
      description: 'This control-room tab is owned by a follow-up ticket.',
    });
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (direction === 0) {
      return;
    }
    event.preventDefault();
    const nextTab = tabs[(index + direction + tabs.length) % tabs.length];
    selectTab(nextTab.value);
    tabRefs.current[nextTab.value]?.focus();
    if (nextTab.value === 'logs') {
      showComingSoon(nextTab.label);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel className="overflow-hidden p-4 sm:p-6 lg:p-8">
        <AdminHeader />
        <div className="mt-6 flex flex-col gap-4 border-y border-glass-border py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">
              Selected World Context
            </p>
            <p className="mt-1 text-sm text-ink/70">
              Commands are always scoped to the selected World.
            </p>
          </div>
          <div className="w-full sm:max-w-sm">
            {worldsQuery.isPending && worlds.length === 0 ? (
              <div aria-label="Loading worlds" aria-busy="true">
                <Skeleton variant="row" />
              </div>
            ) : (
              <Select
                id="admin-selected-world"
                label="Selected World"
                value={selectedWorld?.slug ?? ''}
                options={worlds.map((world) => ({
                  value: world.slug,
                  label: `${world.name} (${world.slug})`,
                }))}
                placeholder={
                  worlds.length === 0 ? 'No worlds available' : undefined
                }
                disabled={worlds.length === 0}
                onChange={(event) => handleWorldChange(event.target.value)}
              />
            )}
          </div>
        </div>

        <nav className="mt-6 overflow-x-auto" aria-label="Admin sections">
          <div
            className="flex min-w-max gap-6 border-b border-glass-border"
            role="tablist"
          >
            {tabs.map((tab, index) => {
              const active = search.tab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="admin-tab-panel"
                  tabIndex={active ? 0 : -1}
                  ref={(element) => {
                    tabRefs.current[tab.value] = element;
                  }}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  onClick={() => {
                    selectTab(tab.value);
                    if (tab.value === 'logs') {
                      showComingSoon(tab.label);
                    }
                  }}
                  className={
                    active
                      ? 'border-b-2 border-brand-diplomat px-1 pb-3 text-sm font-bold text-brand-diplomat outline-none'
                      : 'border-b-2 border-transparent px-1 pb-3 text-sm font-bold text-ink/50 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60'
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div
          id="admin-tab-panel"
          role="tabpanel"
          aria-label={activeTabLabel(search.tab)}
          className="mt-6"
        >
          {search.tab === 'characters' ? (
            <CharacterRegistryTab />
          ) : worldsQuery.isError ? (
            <ErrorState
              title="Could not load admin worlds"
              message="The control room cannot select a World until the directory is available."
              onRetry={() => void worldsQuery.refetch()}
            />
          ) : worldsQuery.isPending && worlds.length === 0 ? (
            <AdminStatusSkeleton />
          ) : worlds.length === 0 ? (
            <EmptyState
              title="No worlds available"
              description="Create a World before opening simulation controls."
              action={
                <Link
                  to="/admin/worlds/new"
                  search={{ page: 1, limit: 20 }}
                  className={buttonClasses('primary', 'md')}
                >
                  Create a World
                </Link>
              }
            />
          ) : selectedWorld === undefined ? (
            <ErrorState
              title="World not found"
              message="The requested World is not in the admin directory. Choose another World to continue."
            />
          ) : search.tab === 'status' ? (
            <SimulationStatusTab world={selectedWorld} />
          ) : search.tab === 'world' ? (
            <WorldConfigTab world={selectedWorld} />
          ) : (
            <EmptyState
              icon={Cpu}
              title={`${activeTabLabel(search.tab)} is coming next`}
              description="The control-room shell is ready for this tab. Its data and mutations will be added by the owning ticket."
            />
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

function AdminHeader() {
  return (
    <header className="flex flex-col gap-5 border-b border-glass-border pb-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="flex items-center gap-3 font-mono text-xl font-bold tracking-tight text-ink sm:text-2xl">
          <Terminal
            className="h-6 w-6 text-brand-diplomat"
            aria-hidden="true"
          />
          WORLD_ENGINE v2.4.1
        </h1>
        <p className="mt-2 flex items-center gap-2 font-mono text-xs text-ink/50">
          <ShieldCheck
            className="h-3.5 w-3.5 text-brand-diplomat"
            aria-hidden="true"
          />
          Authorized Human Override. Access Level: ADMIN.
        </p>
      </div>
      <Link
        to="/admin/worlds"
        search={{ page: 1, limit: 20 }}
        className={buttonClasses('ghost', 'sm')}
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        World directory
      </Link>
    </header>
  );
}

function resolveSelectedWorld(
  worlds: readonly WorldResponse[],
  requestedSlug: string | undefined,
): WorldResponse | undefined {
  if (requestedSlug !== undefined) {
    return worlds.find((world) => world.slug === requestedSlug);
  }
  return (
    worlds.find((world) => world.slug === 'mbti-house') ??
    worlds.find((world) => world.isActive) ??
    worlds[0]
  );
}

function activeTabLabel(tab: AdminDashboardSearch['tab']): string {
  return tabs.find((item) => item.value === tab)?.label ?? 'Simulation Status';
}

function AdminStatusSkeleton() {
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
      aria-label="Loading simulation"
      aria-busy="true"
    >
      <Skeleton variant="detail" />
      <Skeleton variant="detail" />
    </div>
  );
}
