import { useEffect, useState } from 'react';

import { cn } from './cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 rounded-xl text-[10px]',
  md: 'h-11 w-11 rounded-2xl text-xs',
  lg: 'h-20 w-20 rounded-[1.5rem] text-lg',
};

const avatarGradients = [
  'from-indigo-300/35 via-indigo-500/20 to-cyan-400/25 text-indigo-100',
  'from-violet-300/35 via-purple-500/20 to-fuchsia-400/25 text-violet-100',
  'from-teal-300/35 via-emerald-500/20 to-sky-400/25 text-teal-100',
  'from-amber-300/35 via-orange-500/20 to-rose-400/25 text-amber-100',
  'from-sky-300/35 via-blue-500/20 to-violet-400/25 text-sky-100',
];

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

/** Presentation-only avatar with a distinct, deterministic fallback for every resident. */
export function Avatar({
  src,
  alt,
  name = alt,
  size = 'md',
  className,
}: AvatarProps) {
  const [hasLoadError, setHasLoadError] = useState(false);
  useEffect(() => {
    setHasLoadError(false);
  }, [src]);
  const showImage = Boolean(src) && !hasLoadError;
  const gradient = avatarGradients[hashCode(name) % avatarGradients.length];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-gradient-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
        gradient,
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

function hashCode(value: string): number {
  return Array.from(value).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
}
