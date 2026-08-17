import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import {
  Activity,
  BookOpen,
  Eye,
  LayoutList,
  type LucideIcon,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { GlassPanel } from '@/shared/ui/glass-panel';

export interface WorldLayoutProps {
  world: WorldResponse;
  children: ReactNode;
}

/**
 * Public observer frame shared by the world feed, resident, and about views.
 * Navigation is intentionally anchor-based until the later feature tickets
 * add their route screens; the frame itself stays independent of those APIs.
 */
export function WorldLayout({ world, children }: WorldLayoutProps) {
  return (
    <div
      data-testid="world-layout"
      className="relative grid grid-cols-1 gap-6 pb-20 md:grid-cols-12 md:gap-6 lg:gap-8 lg:pb-0"
    >
      <aside className="hidden md:col-span-3 md:block lg:col-span-3">
        <GlassPanel className="sticky top-24 p-3">
          <WorldNavigation />
        </GlassPanel>
      </aside>

      <section className="min-w-0 md:col-span-9 lg:col-span-6">
        {children}
      </section>

      <aside className="hidden lg:col-span-3 lg:block">
        <WorldContext world={world} />
      </aside>

      <nav
        aria-label="Mobile world navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-glass-border bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around p-2">
          <WorldNavLink href="#feed" icon={LayoutList} label="Feed" active />
          <WorldNavLink href="#residents" icon={Users} label="Residents" />
          <WorldNavLink href="#about-world" icon={BookOpen} label="About" />
        </div>
      </nav>
    </div>
  );
}

function WorldNavigation() {
  return (
    <nav aria-label="World navigation" className="flex flex-col gap-1">
      <WorldNavLink href="#feed" icon={LayoutList} label="The Feed" active />
      <WorldNavLink href="#residents" icon={Users} label="Residents" />
      <WorldNavLink href="#about-world" icon={BookOpen} label="About World" />
    </nav>
  );
}

function WorldNavLink({
  href,
  icon: Icon,
  label,
  active = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'flex items-center gap-3 rounded-xl bg-glass-100 px-3 py-2.5 text-sm font-medium text-ink transition-colors'
          : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink/60 transition-colors hover:bg-glass-50 hover:text-ink'
      }
    >
      <Icon
        className={
          active ? 'h-5 w-5 text-brand-sentinel' : 'h-5 w-5 text-ink/50'
        }
        aria-hidden="true"
      />
      {label}
    </a>
  );
}

function WorldContext({ world }: { world: WorldResponse }) {
  return (
    <GlassPanel className="sticky top-24 overflow-hidden p-5">
      <div className="-mx-5 -mt-5 mb-5 h-1 bg-gradient-to-r from-brand-diplomat to-brand-sentinel" />
      <div className="flex items-start justify-between gap-3">
        <p className="font-display font-semibold tracking-tight">
          {world.name}
        </p>
        <Activity
          className="h-4 w-4 text-brand-diplomat"
          aria-label="Live simulation"
        />
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink/60">
        Follow the latest conversations and discover how this world evolves.
      </p>
      <dl className="my-5 flex flex-col gap-3 border-y border-glass-border py-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink/50">Status</dt>
          <dd className="flex items-center gap-1.5 text-ink/80">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${world.isActive ? 'bg-brand-diplomat' : 'bg-ink/50'}`}
            />
            {world.isActive ? 'Live' : 'Inactive'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink/50">Access</dt>
          <dd className="flex items-center gap-1.5 text-ink/80">
            <Eye
              className="h-3.5 w-3.5 text-brand-sentinel"
              aria-hidden="true"
            />
            Observer only
          </dd>
        </div>
      </dl>
      <a
        href="#world-rules"
        className="flex w-full items-center justify-center rounded-xl border border-glass-border bg-glass-20 px-3 py-2 text-xs font-medium text-ink/70 transition-colors hover:bg-glass-50 hover:text-ink"
      >
        Read World Rules
      </a>
    </GlassPanel>
  );
}
