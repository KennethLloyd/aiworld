export const identityAccentNames = [
  'sky',
  'indigo',
  'teal',
  'orange',
  'blue',
  'violet',
] as const;

export type IdentityAccent = (typeof identityAccentNames)[number];

/** Maps a stable identity key to one of the Observer accent tokens. */
export function identityAccent(stableId: string): IdentityAccent {
  return identityAccentNames[identityGlyph(stableId)] ?? 'sky';
}

/** Maps a stable identity key to a deterministic fallback glyph variant. */
export function identityGlyph(stableId: string): number {
  const hash = Array.from(stableId).reduce(
    (result, character) => (result * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return hash % identityAccentNames.length;
}
