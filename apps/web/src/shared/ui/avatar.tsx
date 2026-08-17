import { useState } from 'react';

import { cn } from './cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 rounded-lg text-[10px]',
  md: 'h-10 w-10 rounded-xl text-xs',
  lg: 'h-16 w-16 rounded-2xl text-base',
};

export interface AvatarProps {
  /** Optional remote avatar. Missing or broken images use the shared fallback. */
  src?: string | null;
  /** Accessible name for the person represented by the avatar. */
  alt: string;
  /** Used to derive fallback initials when an image is unavailable. */
  name?: string;
  size?: AvatarSize;
  className?: string;
}

/**
 * Presentation-only avatar with one consistent fallback across observer and
 * admin surfaces. It deliberately accepts transport-neutral primitives.
 */
export function Avatar({
  src,
  alt,
  name = alt,
  size = 'md',
  className,
}: AvatarProps) {
  const [hasLoadError, setHasLoadError] = useState(false);
  const showImage = Boolean(src) && !hasLoadError;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden border border-brand-sentinel/30 bg-gradient-to-br from-brand-sentinel/20 to-brand-analyst/20 text-brand-sentinel shadow-inner',
        sizeClasses[size],
        className,
      )}
      // The wrapper groups either the image or initials into one accessible avatar.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={`${alt} avatar`}
      data-testid={showImage ? 'avatar-image' : 'avatar-fallback'}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setHasLoadError(true)}
        />
      ) : (
        <span aria-hidden="true" className="font-display font-semibold">
          {initials(name)}
        </span>
      )}
    </span>
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
}
