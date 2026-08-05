import { cn } from './cn';

export type SkeletonVariant = 'text' | 'card' | 'row' | 'detail';

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 w-24',
  card: 'h-40 w-full rounded-xl',
  row: 'h-10 w-full rounded-lg',
  detail: 'h-64 w-full rounded-xl',
};

export interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

/** Pulsing glass placeholder; per-layout variants for cards/rows/detail. */
export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-lg bg-glass-50',
        variantClasses[variant],
        className,
      )}
    />
  );
}
