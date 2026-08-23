import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from './cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-glass-border bg-glass-20 px-6 py-12 text-center',
        className,
      )}
    >
      <Icon className="h-10 w-10 text-ink/40" aria-hidden="true" />
      <Heading className="font-display text-lg font-semibold">{title}</Heading>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-ink/60">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
