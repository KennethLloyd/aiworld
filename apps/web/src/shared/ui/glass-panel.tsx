import type { HTMLAttributes } from 'react';

import { cn } from './cn';

export interface GlassPanelProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'as'
> {
  as?: 'div' | 'section';
  /** Adds the hover elevation treatment (glass-panel-hover). */
  hover?: boolean;
}

/**
 * The base glassmorphism surface from styles/globals.css (.glass-panel):
 * gradient fill, backdrop blur, inset highlight and drop shadow. Pure
 * presentational - no hooks, no data fetching.
 */
export function GlassPanel({
  as = 'div',
  hover = false,
  className,
  ...props
}: GlassPanelProps) {
  const classes = cn('glass-panel', hover && 'glass-panel-hover', className);
  if (as === 'section') {
    return <section className={classes} {...props} />;
  }
  return <div className={classes} {...props} />;
}
