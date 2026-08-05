import type { HTMLAttributes } from 'react';

import { cn } from './cn';

export type BadgeTone = 'success' | 'neutral' | 'info' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Shows a status dot before the label (dot + color + text, never color alone). */
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  success: 'border-brand-diplomat/40 bg-brand-diplomat/10 text-brand-diplomat',
  neutral: 'border-glass-border bg-glass-20 text-ink/70',
  info: 'border-brand-sentinel/40 bg-brand-sentinel/10 text-brand-sentinel',
  warning: 'border-brand-explorer/40 bg-brand-explorer/10 text-brand-explorer',
  danger: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

const dotClasses: Record<BadgeTone, string> = {
  success: 'bg-brand-diplomat',
  neutral: 'bg-ink/50',
  info: 'bg-brand-sentinel',
  warning: 'bg-brand-explorer',
  danger: 'bg-rose-400',
};

export function Badge({
  tone = 'neutral',
  dot = true,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 rounded-full', dotClasses[tone])}
        />
      )}
      {children}
    </span>
  );
}
