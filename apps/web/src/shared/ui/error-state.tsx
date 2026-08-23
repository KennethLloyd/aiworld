import { RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';

import { Button } from './button';
import { cn } from './cn';

export interface ErrorStateProps {
  title?: string;
  /** Pre-rendered message (callers map ApiError.toUserMessage() here). */
  message?: string;
  onRetry?: () => void;
  /** Renders the forbidden (403) variant. */
  forbidden?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  forbidden = false,
  headingLevel = 3,
  className,
}: ErrorStateProps) {
  const Icon = forbidden ? ShieldAlert : TriangleAlert;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div
      className={cn(
        'glass-panel flex flex-col items-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <Icon
        className={cn(
          'h-10 w-10',
          forbidden ? 'text-brand-explorer' : 'text-rose-400',
        )}
        aria-hidden="true"
      />
      <div role="alert">
        <Heading className="font-display text-lg font-semibold">
          {forbidden ? 'Access denied' : title}
        </Heading>
        <p className="max-w-sm text-sm leading-relaxed text-ink/60">
          {message ??
            (forbidden
              ? 'You need the ADMIN role to view this content.'
              : 'Something went wrong while loading this content.')}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
