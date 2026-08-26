export const identityAccentNames = [
  'sky',
  'indigo',
  'teal',
  'orange',
  'blue',
  'violet',
] as const;

export type IdentityAccent = (typeof identityAccentNames)[number];

export function identityAccent(value: string): IdentityAccent {
  return identityAccentNames[identityGlyph(value)] ?? 'sky';
}
export function identityGlyph(value: string): number {
  const hash = Array.from(value).reduce(
    (result, character) => (result * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return hash % identityAccentNames.length;
}
