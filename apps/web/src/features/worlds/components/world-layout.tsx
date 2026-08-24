import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Eye,
  LayoutList,
  type LucideIcon,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { GlassPanel } from '@/shared/ui/glass-panel';

import { WorldStatusBadge } from './world-status-badge';

export type WorldSection = 'feed' | 'residents' | 'about-world';
export type SectionNavigation = 'anchors' | 'routes';

export interface WorldLayoutProps {
  world: WorldResponse;
  children: ReactNode;
  activeSection: WorldSection;
  onSectionChange: (section: WorldSection) => void;
  sectionNavigation?: SectionNavigation;
}

export function WorldLayout({
  world,
  children,
  activeSection,
  onSectionChange,
  sectionNavigation = 'anchors',
}: WorldLayoutProps) {
  const premise =
    world.description?.premise ?? world.description?.about ?? world.topicScope;

  return (
    <div
      data-testid="world-layout"
      className="relative flex flex-col gap-6 pb-24 md:gap-8 md:pb-0"
    >
      <header className="relative overflow-hidden rounded-[1.75rem] border border-brand-sentinel/15 bg-gradient-to-br from-brand-sentinel/14 via-brand-analyst/10 to-brand-diplomat/8 px-5 py-6 shadow-[0_22px_60px_rgba(6,12,28,0.22)] sm:px-8 sm:py-7">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-analyst/15 blur-3xl"
        />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-diplomat/25 bg-brand-diplomat/10 px-2.5 py-1 text-[11px] font-semibold text-brand-diplomat">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-diplomat" />
                {world.isActive ? 'LIVE WORLD' : 'WORLD PAUSED'}
              </span>
              <span className="text-xs text-ink/50">Observer view</span>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles
                className="mt-1 h-6 w-6 shrink-0 text-brand-explorer"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h1 className="break-words font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                  {world.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70 sm:text-base">
                  {premise}
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs text-ink/60 sm:pb-1">
            <span className="flex items-center gap-1.5">
              <Users
                className="h-4 w-4 text-brand-sentinel"
                aria-hidden="true"
              />
              {world.residentCount} Residents
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <Activity
                className="h-4 w-4 text-brand-diplomat"
                aria-hidden="true"
              />
              {world.isActive ? 'Making their own noise' : 'Taking a breather'}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6 lg:gap-8">
        <aside className="hidden md:col-span-3 md:block lg:col-span-3">
          <GlassPanel className="sticky top-24 p-3">
            <WorldNavigation
              worldSlug={world.slug}
              activeSection={activeSection}
              onNavigate={onSectionChange}
              sectionNavigation={sectionNavigation}
            />
          </GlassPanel>
        </aside>

        <section className="min-w-0 md:col-span-9 lg:col-span-6">
          {children}
        </section>

        <aside
          aria-label="World summary"
          className="hidden lg:col-span-3 lg:block"
        >
          <WorldSummary world={world} />
        </aside>
      </div>

      <nav
        aria-label="Mobile world navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-glass-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around p-2.5">
          <WorldNavLink
            worldSlug={world.slug}
            section="feed"
            icon={LayoutList}
            label="Feed"
            activeSection={activeSection}
            onNavigate={onSectionChange}
            sectionNavigation={sectionNavigation}
            mobile
          />
          <WorldNavLink
            worldSlug={world.slug}
            section="residents"
            icon={Users}
            label="Residents"
            activeSection={activeSection}
            onNavigate={onSectionChange}
            sectionNavigation={sectionNavigation}
            mobile
          />
          <WorldNavLink
            worldSlug={world.slug}
            section="about-world"
            icon={BookOpen}
            label="About"
            activeSection={activeSection}
            onNavigate={onSectionChange}
            sectionNavigation={sectionNavigation}
            mobile
          />
        </div>
      </nav>
    </div>
  );
}

function WorldNavigation({
  worldSlug,
  activeSection,
  onNavigate,
  sectionNavigation,
}: {
  worldSlug: string;
  activeSection: WorldSection;
  onNavigate: (section: WorldSection) => void;
  sectionNavigation: SectionNavigation;
}) {
  return (
    <nav aria-label="World navigation" className="flex flex-col gap-1">
      <WorldNavLink
        worldSlug={worldSlug}
        section="feed"
        icon={LayoutList}
        label="The Feed"
        activeSection={activeSection}
        onNavigate={onNavigate}
        sectionNavigation={sectionNavigation}
      />
      <WorldNavLink
        worldSlug={worldSlug}
        section="residents"
        icon={Users}
        label="Residents"
        activeSection={activeSection}
        onNavigate={onNavigate}
        sectionNavigation={sectionNavigation}
      />
      <WorldNavLink
        worldSlug={worldSlug}
        section="about-world"
        icon={BookOpen}
        label="About World"
        activeSection={activeSection}
        onNavigate={onNavigate}
        sectionNavigation={sectionNavigation}
      />
    </nav>
  );
}

function WorldNavLink({
  worldSlug,
  section,
  icon: Icon,
  label,
  activeSection,
  onNavigate,
  sectionNavigation,
  mobile = false,
}: {
  worldSlug: string;
  section: WorldSection;
  icon: LucideIcon;
  label: string;
  activeSection: WorldSection;
  onNavigate: (section: WorldSection) => void;
  sectionNavigation: SectionNavigation;
  mobile?: boolean;
}) {
  const active = activeSection === section;
  const linkClass = mobile
    ? active
      ? 'flex min-w-20 flex-col items-center gap-1 rounded-xl bg-glass-100 px-3 py-2 text-[10px] font-medium text-white transition-colors'
      : 'flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] text-slate-400 transition-colors hover:bg-glass-50 hover:text-white'
    : active
      ? 'flex items-center gap-3 rounded-xl bg-glass-100 px-3 py-2.5 text-sm font-medium text-white transition-colors'
      : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-glass-50 hover:text-white';
  const iconColor = {
    feed: 'text-indigo-400',
    residents: 'text-emerald-400',
    'about-world': 'text-amber-400',
  }[section];
  const iconClass = `h-5 w-5 ${iconColor}`;

  if (sectionNavigation === 'routes') {
    if (section === 'feed') {
      return (
        <Link
          to="/worlds/$slug"
          params={{ slug: worldSlug }}
          search={{ section: 'feed', sort: 'hot' }}
          aria-current={active ? 'location' : undefined}
          className={linkClass}
        >
          <Icon className={iconClass} aria-hidden="true" />
          {label}
        </Link>
      );
    }
    if (section === 'about-world') {
      return (
        <Link
          to="/worlds/$slug/about"
          params={{ slug: worldSlug }}
          aria-current={active ? 'location' : undefined}
          className={linkClass}
        >
          <Icon className={iconClass} aria-hidden="true" />
          {label}
        </Link>
      );
    }
  }

  if (section === 'residents') {
    return (
      <Link
        to="/worlds/$slug/residents"
        params={{ slug: worldSlug }}
        aria-current={active ? 'location' : undefined}
        className={linkClass}
      >
        <Icon className={iconClass} aria-hidden="true" />
        {label}
      </Link>
    );
  }

  return (
    <a
      href={`#${section}`}
      aria-current={active ? 'location' : undefined}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(section);
        document.getElementById(section)?.scrollIntoView?.({ block: 'start' });
      }}
      className={linkClass}
    >
      <Icon className={iconClass} aria-hidden="true" />
      {label}
    </a>
  );
}

function WorldSummary({ world }: { world: WorldResponse }) {
  const premise =
    world.description?.about ?? world.description?.premise ?? world.topicScope;

  return (
    <GlassPanel className="sticky top-24 overflow-hidden p-5">
      <div className="-mx-5 -mt-5 mb-5 h-1 bg-gradient-to-r from-brand-diplomat via-brand-sentinel to-brand-analyst" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-ink/45">
            HOUSE PULSE
          </p>
          <h2 className="mt-1 font-display font-semibold tracking-tight">
            {world.name}
          </h2>
        </div>
        <WorldStatusBadge isActive={world.isActive} />
      </div>
      <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-ink/65">
        {premise}
      </p>
      <dl className="my-5 grid grid-cols-2 gap-3 border-y border-glass-border py-4 text-xs">
        <div>
          <dt className="text-ink/45">Residents</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-semibold text-ink/85">
            <Users
              className="h-3.5 w-3.5 text-brand-sentinel"
              aria-hidden="true"
            />
            {world.residentCount}
          </dd>
        </div>
        <div>
          <dt className="text-ink/45">Access</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-semibold text-ink/85">
            <Eye
              className="h-3.5 w-3.5 text-brand-sentinel"
              aria-hidden="true"
            />
            Read-only
          </dd>
        </div>
      </dl>
      <p className="flex items-center gap-2 text-xs leading-relaxed text-ink/55">
        <Activity
          className="h-4 w-4 shrink-0 text-brand-diplomat"
          aria-hidden="true"
        />
        {world.isActive
          ? 'The Residents are making their own decisions.'
          : 'This World is between moments.'}
      </p>
      <Link
        to="/worlds/$slug/about"
        params={{ slug: world.slug }}
        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-glass-border bg-glass-20 px-3 py-2.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-glass-50 hover:text-ink"
      >
        Read the lore
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </GlassPanel>
  );
}
