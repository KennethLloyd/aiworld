import { cn } from './cn';

export interface LiveIndicatorProps {
  label?: string;
  active?: boolean;
  className?: string;
}

/** A calm, text-backed activity signal for genuinely active Worlds. */
export function LiveIndicator({
  label = 'LIVE',
  active = true,
  className,
}: LiveIndicatorProps) {
  return (
    <span
      className={cn(
        'live-indicator',
        !active && 'live-indicator--inactive',
        className,
      )}
    >
      <span className="live-indicator__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
