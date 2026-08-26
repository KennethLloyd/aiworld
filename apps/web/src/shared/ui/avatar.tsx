import { useEffect, useState } from 'react';

import { cn } from './cn';
import { identityAccent, identityGlyph } from './identity-accent';

export type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 rounded-xl text-[10px]',
  md: 'h-11 w-11 rounded-2xl text-xs',
  lg: 'h-20 w-20 rounded-[1.5rem] text-lg',
};

export interface AvatarProps {
  /** Optional remote avatar. Missing or broken images use the shared fallback. */
  src?: string | null;
  /** Accessible name for the digital identity represented by the avatar. */
  alt: string;
  /** Used to derive a deterministic identity glyph when an image is unavailable. */
  name?: string;
  size?: AvatarSize;
  className?: string;
}

/** Presentation-only avatar with a distinct, deterministic glyph for every identity. */
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
  const glyph = identityGlyph(name);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden border border-brand-sentinel/20 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_8px_18px_rgba(42,111,166,0.12)]',
        sizeClasses[size],
        className,
      )}
      // The wrapper groups either the image or glyph into one accessible avatar.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={`${alt} avatar`}
      data-testid={showImage ? 'avatar-image' : 'avatar-fallback'}
      data-identity-accent={identityAccent(name)}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setHasLoadError(true)}
        />
      ) : (
        <span aria-hidden="true" className="identity-fallback">
          <span className="identity-initials">{initials(name)}</span>
          <span className="identity-glyph" data-glyph={glyph}>
            <span className="identity-glyph-core" />
            <span className="identity-glyph-orbit" />
          </span>
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
