/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Labelled vote groups use role=group without a fieldset legend. */

import { ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from './cn';

export type VoteDirection = 'up' | 'down';
export type VoteControlMode = 'observer' | 'member';

export interface VoteControlProps {
  score: number;
  mode?: VoteControlMode;
  onVote?: (direction: VoteDirection) => void;
  compact?: boolean;
  className?: string;
}

export function VoteControl({
  score,
  mode = 'observer',
  onVote,
  compact = false,
  className,
}: VoteControlProps) {
  const canVote = mode === 'member' && onVote !== undefined;
  const scoreClass = score >= 0 ? 'text-brand-sentinel' : 'text-brand-explorer';
  const sizeClass = compact ? 'min-h-8 px-1' : 'min-h-9 px-1.5';

  if (!canVote) {
    return (
      <div
        role="group"
        aria-label={`Vote score ${score}. Observer mode is read-only; voting is unavailable.`}
        title="Observers can see votes but cannot change them"
        className={cn(
          'inline-flex items-center gap-0.5 rounded-lg text-xs font-semibold',
          sizeClass,
          className,
        )}
      >
        <ChevronUp className="h-4 w-4 text-ink/45" aria-hidden="true" />
        <span className={scoreClass} aria-hidden="true">
          {score}
        </span>
        <ChevronDown className="h-4 w-4 text-ink/45" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      role="group"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg text-xs font-semibold',
        sizeClass,
        className,
      )}
      aria-label={`Vote score ${score}`}
    >
      <button
        type="button"
        aria-label={`Upvote. Current score ${score}`}
        onClick={() => onVote('up')}
        className="rounded-md p-1 text-ink/55 transition-colors hover:bg-glass-50 hover:text-brand-sentinel focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-sentinel/60"
      >
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className={scoreClass}>{score}</span>
      <button
        type="button"
        aria-label={`Downvote. Current score ${score}`}
        onClick={() => onVote('down')}
        className="rounded-md p-1 text-ink/55 transition-colors hover:bg-glass-50 hover:text-brand-explorer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-explorer/60"
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
