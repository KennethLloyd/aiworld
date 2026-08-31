import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Activity,
  ChevronDown,
  ExternalLink,
  FileText,
  Gauge,
  Globe2,
  Settings2,
  ShieldCheck,
  Terminal,
  UsersRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  adminDashboardDefaults,
  type AdminDashboardSearch,
} from '@/features/admin/admin-search';
import { useWorld } from '@/features/worlds/query/use-world';
import { useWorlds } from '@/features/worlds/query/use-worlds';
import { buttonClasses } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Skeleton } from '@/shared/ui/skeleton';

import { CharacterRegistryTab } from './character-registry-tab';
import { SimulationLogsTab, type LogFilters } from './simulation-logs-tab';
import { SimulationStatusTab } from './simulation-status-tab';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { WorldConfigTab } from './world-config-tab';
import { WorldMembersTab } from './world-members-tab';
import { WorldOverviewTab } from './world-overview-tab';

/* The custom picker uses the ARIA combobox/listbox pattern so its menu stays
   anchored to the trigger on narrow screens instead of relying on a native
   select popup that the browser positions independently. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */

const adminWorldsQuery = { page: 1, limit: 20 } as const;

const legacyTabs = [
  { value: 'status', label: 'Simulation Status' },
  { value: 'world', label: 'World Config' },
  { value: 'characters', label: 'Characters' },
  { value: 'members', label: 'Members' },
  { value: 'logs', label: 'LLM Logs' },
] as const;

const worldSections = [
  { value: 'overview', label: 'Overview', icon: Activity },
  { value: 'residents', label: 'Residents', icon: UsersRound },
  { value: 'simulation', label: 'Simulation', icon: Gauge },
  { value: 'logs', label: 'Logs', icon: FileText },
  { value: 'settings', label: 'Settings', icon: Settings2 },
] as const;

type LegacyTab = (typeof legacyTabs)[number]['value'];

type AdminNavigationTarget = {
  tab: AdminDashboardSearch['tab'];
  world?: string;
};

export function AdminControlRoom({ search }: { search: AdminDashboardSearch }) {
  const navigate = useNavigate({ from: '/admin/' });
  const worldConfigNavigationResetRef = useRef<() => void>(() => undefined);
  const registerWorldConfigNavigationReset = useCallback(
    (reset: () => void) => {
      worldConfigNavigationResetRef.current = reset;
    },
    [],
  );
  const tabRefs = useRef<Record<LegacyTab, HTMLButtonElement | null>>({
    status: null,
    world: null,
    characters: null,
    members: null,
    logs: null,
  });
  const [worldPickerSearch, setWorldPickerSearch] = useState('');
  const [worldPickerPage, setWorldPickerPage] = useState(1);
  const debouncedWorldPickerSearch = useDebouncedValue(worldPickerSearch, 250);
  useEffect(() => {
    setWorldPickerPage(1);
  }, [debouncedWorldPickerSearch]);
  const worldsQuery = useWorlds(adminWorldsQuery);
  const worldPickerQuery = useWorlds({
    ...adminWorldsQuery,
    page: worldPickerPage,
    search: debouncedWorldPickerSearch.trim() || undefined,
  });
  const worlds = worldsQuery.data?.items ?? [];
  const pickerResults = worldPickerQuery.data?.items ?? worlds;
  const pickerTotalPages = Math.max(
    1,
    worldPickerQuery.data?.meta.totalPages ?? 1,
  );
  useEffect(() => {
    setWorldPickerPage((current) => Math.min(current, pickerTotalPages));
  }, [pickerTotalPages]);
  const listedWorld = resolveSelectedWorld(worlds, search.world);
  const missingRequestedSlug =
    worldsQuery.data !== undefined &&
    search.world !== undefined &&
    !worlds.some((world) => world.slug === search.world)
      ? search.world
      : '';
  const requestedWorldQuery = useWorld(missingRequestedSlug);
  const selectedWorld = listedWorld ?? requestedWorldQuery.data;
  const globalScope = search.tab === 'characters';
  const pickerWorlds = selectedWorld
    ? [
        selectedWorld,
        ...pickerResults.filter((world) => world.slug !== selectedWorld.slug),
      ]
    : pickerResults;
  const [worldConfigDirty, setWorldConfigDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState<AdminNavigationTarget | null>(null);
  const isWorldConfigTab = search.tab === 'world' || search.tab === 'settings';
  const handleWorldConfigDirtyChange = useCallback((dirty: boolean) => {
    setWorldConfigDirty(dirty);
  }, []);

  const requestNavigation = (next: AdminNavigationTarget) => {
    if (isWorldConfigTab && worldConfigDirty) {
      setPendingNavigation(next);
      return;
    }
    void navigate({
      search: (previous) => ({
        ...previous,
        ...next,
      }),
    });
  };

  const handleWorldChange = (slug: string) => {
    setWorldPickerSearch('');
    requestNavigation({
      world: slug,
      tab: search.tab === 'characters' ? 'overview' : search.tab,
    });
  };

  const selectTab = (tab: AdminDashboardSearch['tab']) => {
    requestNavigation({ tab });
  };

  const selectWorldSection = (
    section: (typeof worldSections)[number]['value'],
  ) => {
    requestNavigation({ tab: section });
  };
  const handleCharacterSearchChange = (value: string) => {
    void navigate({
      to: '/admin/characters',
      search: (previous) => ({
        ...previous,
        characterSearch: value || undefined,
        characterPage: 1,
      }),
    });
  };

  const handleCharacterPageChange = (page: number) => {
    void navigate({
      to: '/admin/characters',
      search: (previous) => ({
        ...previous,
        characterPage: page,
      }),
    });
  };

  const handleCharacterActivityFilterChange = (
    isActive: boolean | undefined,
  ) => {
    void navigate({
      to: '/admin/characters',
      search: (previous) => ({
        ...previous,
        characterIsActive: isActive,
        characterPage: 1,
      }),
    });
  };

  const handleOpenLog = useCallback(
    (logId: string) => {
      void navigate({
        resetScroll: false,
        search: (previous) => ({
          ...previous,
          tab: 'logs',
          log: logId,
          logCharacterId: undefined,
          logAction: undefined,
          logStatus: undefined,
          logSource: undefined,
          logPage: undefined,
        }),
      });
    },
    [navigate],
  );
  const handleSelectedLogChange = useCallback(
    (logId: string | undefined) => {
      void navigate({
        resetScroll: false,
        search: (previous) => ({
          ...previous,
          log: logId,
        }),
      });
    },
    [navigate],
  );

  const discardPendingNavigation = () => {
    const next = pendingNavigation;
    worldConfigNavigationResetRef.current();
    setWorldConfigDirty(false);
    setPendingNavigation(null);
    if (next !== null) {
      void navigate({
        search: (previous) => ({
          ...previous,
          ...next,
        }),
      });
    }
  };

  useEffect(() => {
    const legacyTab = legacyTabs.some((tab) => tab.value === search.tab)
      ? (search.tab as LegacyTab)
      : null;
    if (legacyTab === null) {
      return;
    }
    const activeTab = tabRefs.current[legacyTab];
    if (activeTab !== null && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [search.tab]);

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
    const nextTab =
      legacyTabs[(index + direction + legacyTabs.length) % legacyTabs.length];
    selectTab(nextTab.value);
    tabRefs.current[nextTab.value]?.focus();
  };

  const worldDataError = worldsQuery.isError;
  const legacyTabId = legacyTabs.some((tab) => tab.value === search.tab)
    ? `admin-tab-${search.tab}`
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel className="relative overflow-visible p-4 sm:p-6 lg:p-8">
        <AdminHeader world={globalScope ? undefined : selectedWorld} />

        <div className="mt-6 grid min-w-0 gap-6 border-t border-glass-border pt-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="min-w-0" aria-label="Admin navigation">
            <nav aria-label="Global admin navigation">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-ink/45">
                AIWorld Admin
              </p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                <Link
                  to="/admin/worlds"
                  search={{ page: 1, limit: 20 }}
                  className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink/70 transition-colors hover:bg-glass-20 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
                >
                  <Globe2 className="h-4 w-4" aria-hidden="true" />
                  Worlds
                </Link>
                <Link
                  to="/admin/characters"
                  search={{ ...adminDashboardDefaults, tab: 'characters' }}
                  aria-current={globalScope ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60 ${globalScope ? 'bg-brand-diplomat/10 text-brand-diplomat' : 'text-ink/70 hover:bg-glass-20 hover:text-ink'}`}
                >
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  Characters
                </Link>
              </div>
            </nav>

            {!globalScope ? (
              <nav
                className="mt-6 border-t border-glass-border pt-5"
                aria-label="World navigation"
              >
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-ink/45">
                  World workspace
                </p>
                {worldsQuery.isPending && worlds.length === 0 ? (
                  <div
                    className="mt-3"
                    aria-label="Loading worlds"
                    aria-busy="true"
                  >
                    <Skeleton variant="row" />
                  </div>
                ) : (
                  <div className="mt-3">
                    <WorldPicker
                      value={selectedWorld?.slug ?? ''}
                      worlds={pickerWorlds}
                      searchValue={worldPickerSearch}
                      onSearchChange={setWorldPickerSearch}
                      page={worldPickerPage}
                      totalPages={pickerTotalPages}
                      onPageChange={setWorldPickerPage}
                      placeholder={
                        pickerWorlds.length === 0
                          ? 'No worlds available'
                          : undefined
                      }
                      disabled={pickerWorlds.length === 0}
                      onChange={handleWorldChange}
                    />
                    <Link
                      to="/admin/worlds"
                      search={{ page: 1, limit: 20 }}
                      className="mt-2 inline-flex px-1 text-xs text-brand-sentinel underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
                    >
                      Browse all Worlds
                    </Link>
                  </div>
                )}
                <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                  {worldSections.map((section) => {
                    const Icon = section.icon;
                    const active =
                      worldSectionForTab(search.tab) === section.value;
                    return (
                      <button
                        key={section.value}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => selectWorldSection(section.value)}
                        className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60 ${active ? 'bg-brand-diplomat/10 text-brand-diplomat' : 'text-ink/70 hover:bg-glass-20 hover:text-ink'}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </nav>
            ) : null}
          </aside>

          <section className="min-w-0">
            {/* Keep the old tab contract available to keyboard users and
                bookmarked tests while the visible shell uses scoped links. */}
            <nav
              className="sr-only"
              aria-label="Legacy admin sections"
              tabIndex={-1}
            >
              <div role="tablist">
                {legacyTabs.map((tab, index) => {
                  const active = search.tab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      id={`admin-tab-${tab.value}`}
                      role="tab"
                      aria-selected={active}
                      aria-controls="admin-tab-panel"
                      tabIndex={-1}
                      ref={(element) => {
                        tabRefs.current[tab.value] = element;
                      }}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      onClick={() => selectTab(tab.value)}
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
              aria-labelledby={legacyTabId}
              aria-label={activeTabLabel(search.tab)}
            >
              {globalScope ? (
                <CharacterRegistryTab
                  searchState={{
                    search: search.characterSearch,
                    page: search.characterPage,
                    isActive: search.characterIsActive,
                  }}
                  onSearchChange={handleCharacterSearchChange}
                  onPageChange={handleCharacterPageChange}
                  onActivityFilterChange={handleCharacterActivityFilterChange}
                />
              ) : worldDataError ? (
                <ErrorState
                  title="Could not load admin worlds"
                  message="Worlds unavailable."
                  onRetry={() => {
                    void worldsQuery.refetch();
                    if (missingRequestedSlug) {
                      void requestedWorldQuery.refetch();
                    }
                  }}
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
              ) : search.tab === 'overview' ? (
                <WorldOverviewTab
                  world={selectedWorld}
                  onOpenLog={handleOpenLog}
                />
              ) : search.tab === 'simulation' || search.tab === 'status' ? (
                <SimulationStatusTab
                  world={selectedWorld}
                  onOpenLog={handleOpenLog}
                />
              ) : search.tab === 'settings' || search.tab === 'world' ? (
                <WorldConfigTab
                  world={selectedWorld}
                  title={
                    search.tab === 'settings' ? 'World Details' : undefined
                  }
                  cancelTab={search.tab === 'settings' ? 'overview' : 'status'}
                  onDirtyChange={handleWorldConfigDirtyChange}
                  onNavigationReset={registerWorldConfigNavigationReset}
                />
              ) : search.tab === 'residents' || search.tab === 'members' ? (
                <WorldMembersTab world={selectedWorld} />
              ) : search.tab === 'logs' ? (
                <SimulationLogsTab
                  world={selectedWorld}
                  selectedLogId={search.log}
                  filters={{
                    characterId: search.logCharacterId,
                    action: search.logAction,
                    status: search.logStatus,
                    executionSource: search.logSource,
                  }}
                  page={search.logPage ?? 1}
                  onFiltersChange={(filters: LogFilters) =>
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        log: undefined,
                        logCharacterId: filters.characterId,
                        logAction: filters.action,
                        logStatus: filters.status,
                        logSource: filters.executionSource,
                        logPage: 1,
                      }),
                    })
                  }
                  onPageChange={(nextPage) =>
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        log: undefined,
                        logPage: nextPage,
                      }),
                    })
                  }
                  onSelectedLogChange={handleSelectedLogChange}
                />
              ) : (
                <EmptyState
                  icon={Terminal}
                  title={`${activeTabLabel(search.tab)} is unavailable`}
                  description="Choose a World workspace section."
                />
              )}
            </div>
          </section>
        </div>
      </GlassPanel>
      <UnsavedChangesDialog
        open={pendingNavigation !== null}
        onContinue={() => setPendingNavigation(null)}
        onDiscard={discardPendingNavigation}
      />
    </div>
  );
}

function AdminHeader({ world }: { world: WorldResponse | undefined }) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="flex flex-wrap items-center gap-3 font-mono text-xl font-bold tracking-tight text-ink sm:text-2xl">
          <Terminal
            className="h-6 w-6 text-brand-sentinel"
            aria-hidden="true"
          />
          AIWorld Admin <span className="text-ink/45">·</span> WORLD_ENGINE
          v2.4.1
        </h1>
        <p className="mt-2 flex items-center gap-2 font-mono text-xs text-ink/50">
          <ShieldCheck
            className="h-3.5 w-3.5 text-brand-diplomat"
            aria-hidden="true"
          />
          Global resources and World operations.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {world ? (
          <Link
            to="/worlds/$slug"
            params={{ slug: world.slug }}
            search={{ sort: 'hot' }}
            className={buttonClasses('primary', 'sm')}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View World ↗
          </Link>
        ) : null}
        <Link
          to="/admin/worlds"
          search={{ page: 1, limit: 20 }}
          className={buttonClasses('ghost', 'sm')}
        >
          World directory
        </Link>
      </div>
    </header>
  );
}

function WorldPicker({
  worlds,
  value,
  searchValue,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
  placeholder,
  disabled,
  onChange,
}: {
  worlds: readonly WorldResponse[];
  value: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  placeholder?: string;
  disabled?: boolean;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedIndex = Math.max(
    0,
    worlds.findIndex((world) => world.slug === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const listboxId = 'admin-selected-world-options';
  const searchId = 'admin-selected-world-search';
  const selectedWorld = worlds.find((world) => world.slug === value);
  const noOtherMatches =
    searchValue.trim().length > 0 &&
    worlds.every((world) => world.slug === value);

  useEffect(() => {
    if (!open) {
      setActiveIndex(selectedIndex);
      return;
    }
    setActiveIndex((current) => {
      if (searchValue.trim().length > 0) {
        const firstSearchResult = worlds.findIndex(
          (world) => world.slug !== value,
        );
        if (firstSearchResult >= 0) {
          return firstSearchResult;
        }
      }
      return worlds.length === 0
        ? 0
        : Math.min(worlds.length - 1, Math.max(0, current));
    });
    searchRef.current?.focus();
  }, [open, searchValue, selectedIndex, value, worlds]);

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
    onSearchChange('');
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
    if (event.key === ' ' && !open) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault();
        triggerRef.current?.focus();
      }
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        return Math.min(worlds.length - 1, Math.max(0, current + direction));
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const activeWorld = worlds[activeIndex];
      if (activeWorld) {
        chooseWorld(activeWorld.slug);
      }
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
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 rounded-lg border border-glass-border bg-surface-2 p-1 shadow-2xl">
          <div className="border-b border-glass-border p-2">
            <label htmlFor={searchId} className="sr-only">
              Search Worlds
            </label>
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={searchValue}
              placeholder="Search Worlds"
              aria-controls={listboxId}
              aria-activedescendant={
                worlds[activeIndex]
                  ? `${listboxId}-${worlds[activeIndex].slug}`
                  : undefined
              }
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="h-9 w-full rounded-md border border-glass-border bg-glass-20 px-3 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-brand-sentinel/50 focus:ring-2 focus:ring-brand-sentinel/30"
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label="World options"
            className="max-h-60 overflow-y-auto p-1"
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
                  onClick={() => chooseWorld(world.slug)}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-glass-20 text-ink' : 'text-ink/80 hover:bg-glass-20 hover:text-ink'} ${selected ? 'font-semibold text-brand-diplomat' : ''}`}
                >
                  <span className="truncate">
                    {world.name} ({world.slug})
                  </span>
                </button>
              );
            })}
            {worlds.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink/60" role="status">
                No matching Worlds
              </p>
            ) : noOtherMatches ? (
              <p className="px-3 py-2 text-xs text-ink/50" role="status">
                No other Worlds match this search.
              </p>
            ) : null}
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-glass-border p-2">
              <button
                type="button"
                className={buttonClasses('ghost', 'sm')}
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                Previous
              </button>
              <span
                className="font-mono text-[10px] text-ink/50"
                aria-live="polite"
              >
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={buttonClasses('ghost', 'sm')}
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
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

function worldSectionForTab(
  tab: AdminDashboardSearch['tab'],
): (typeof worldSections)[number]['value'] | null {
  if (tab === 'status') return 'simulation';
  if (tab === 'world') return 'settings';
  if (tab === 'members') return 'residents';
  if (
    tab === 'overview' ||
    tab === 'residents' ||
    tab === 'simulation' ||
    tab === 'logs' ||
    tab === 'settings'
  ) {
    return tab;
  }
  return null;
}

function activeTabLabel(tab: AdminDashboardSearch['tab']): string {
  const worldSection = worldSections.find((item) => item.value === tab);
  if (worldSection) return worldSection.label;
  return legacyTabs.find((item) => item.value === tab)?.label ?? 'Admin';
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

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedValue(value),
      delayMs,
    );
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
