import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ChevronDown,
  Cpu,
  ExternalLink,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { AdminDashboardSearch } from '@/features/admin/admin-search';
import { useWorlds } from '@/features/worlds/query/use-worlds';
import { buttonClasses } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

import { CharacterRegistryTab } from './character-registry-tab';
import { SimulationLogsTab } from './simulation-logs-tab';
import { SimulationStatusTab } from './simulation-status-tab';
import { WorldConfigTab } from './world-config-tab';
import { WorldMembersTab } from './world-members-tab';

/* The custom picker uses the ARIA combobox/listbox pattern so its menu stays
   anchored to the trigger on narrow screens instead of relying on a native
   select popup that the browser positions independently. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */

const adminWorldsQuery = { page: 1, limit: 100 } as const;

const tabs = [
  { value: 'status', label: 'Simulation Status' },
  { value: 'world', label: 'World Config' },
  { value: 'characters', label: 'Characters' },
  { value: 'members', label: 'Members' },
  { value: 'logs', label: 'LLM Logs' },
] as const;

export function AdminControlRoom({ search }: { search: AdminDashboardSearch }) {
  const navigate = useNavigate({ from: '/admin/' });
  const tabRefs = useRef<
    Record<AdminDashboardSearch['tab'], HTMLButtonElement | null>
  >({
    status: null,
    world: null,
    characters: null,
    members: null,
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
  };

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel className="relative overflow-visible p-4 sm:p-6 lg:p-8">
        <AdminHeader />
        <div className="mt-6 flex min-w-0 flex-col gap-4 border-b border-glass-border pb-5 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">
              Selected World
            </p>
            <p className="mt-1 text-sm text-ink/70">
              All controls use this World.
            </p>
          </div>
          <div className="w-full sm:max-w-sm">
            {worldsQuery.isPending && worlds.length === 0 ? (
              <div aria-label="Loading worlds" aria-busy="true">
                <Skeleton variant="row" />
              </div>
            ) : (
              <WorldPicker
                value={selectedWorld?.slug ?? ''}
                worlds={worlds}
                placeholder={
                  worlds.length === 0 ? 'No worlds available' : undefined
                }
                disabled={worlds.length === 0}
                onChange={handleWorldChange}
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
                  onClick={() => selectTab(tab.value)}
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
              message="Worlds unavailable."
              onRetry={() => void worldsQuery.refetch()}
            />
          ) : worldsQuery.isPending && worlds.length === 0 ? (
            <AdminStatusSkeleton />
          ) : worlds.length === 0 ? (
            <EmptyState
              title="No worlds available"
              description="Create a World to get started."
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
              message="Choose another World."
            />
          ) : search.tab === 'status' ? (
            <SimulationStatusTab world={selectedWorld} />
          ) : search.tab === 'world' ? (
            <WorldConfigTab world={selectedWorld} />
          ) : search.tab === 'members' ? (
            <WorldMembersTab world={selectedWorld} />
          ) : search.tab === 'logs' ? (
            <SimulationLogsTab world={selectedWorld} />
          ) : (
            <EmptyState
              icon={Cpu}
              title={`${activeTabLabel(search.tab)} is coming next`}
              description="This tab is not available yet."
            />
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

function AdminHeader() {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
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
          Admin access.
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

function WorldPicker({
  worlds,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  worlds: readonly WorldResponse[];
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = Math.max(
    0,
    worlds.findIndex((world) => world.slug === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const listboxId = 'admin-selected-world-options';
  const selectedWorld = worlds.find((world) => world.slug === value);

  useEffect(() => {
    if (!open) {
      setActiveIndex(selectedIndex);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const chooseWorld = (slug: string) => {
    onChange(slug);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        return Math.min(worlds.length - 1, Math.max(0, current + direction));
      });
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      const activeWorld = worlds[activeIndex];
      if (activeWorld) {
        chooseWorld(activeWorld.slug);
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-ink/60">
        Selected World
      </span>
      <button
        ref={triggerRef}
        id="admin-selected-world"
        type="button"
        role="combobox"
        aria-label="Selected World"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={
          open && worlds[activeIndex]
            ? `${listboxId}-${worlds[activeIndex].slug}`
            : undefined
        }
        data-value={value}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-glass-border bg-surface-2 px-3.5 text-left text-sm text-ink transition-colors focus:border-brand-sentinel/50 focus:outline-none focus:ring-2 focus:ring-brand-sentinel/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate">
          {selectedWorld
            ? `${selectedWorld.name} (${selectedWorld.slug})`
            : (placeholder ?? 'Select a World')}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink/60 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && worlds.length > 0 ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="World options"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-72 overflow-y-auto rounded-lg border border-glass-border bg-surface-2 p-1 shadow-2xl"
        >
          {worlds.map((world, index) => {
            const selected = world.slug === value;
            const active = index === activeIndex;
            return (
              <button
                key={world.slug}
                id={`${listboxId}-${world.slug}`}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseWorld(world.slug);
                }}
                onClick={() => chooseWorld(world.slug)}
                className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-glass-20 text-ink' : 'text-ink/80 hover:bg-glass-20 hover:text-ink'} ${selected ? 'font-semibold text-brand-diplomat' : ''}`}
              >
                <span className="truncate">
                  {world.name} ({world.slug})
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
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
