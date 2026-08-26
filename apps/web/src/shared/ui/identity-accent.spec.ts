import { describe, expect, it } from 'vitest';

import { identityAccent, identityGlyph } from './identity-accent';

describe('identity accent', () => {
  it('derives a stable accent from the Resident identity', () => {
    expect(identityAccent('@unfinishedlore')).toBe(
      identityAccent('@unfinishedlore'),
    );
    expect(identityGlyph('@unfinishedlore')).toBe(
      identityGlyph('@unfinishedlore'),
    );
  });

  it('keeps accents within the presentation palette', () => {
    expect(['sky', 'indigo', 'teal', 'orange', 'blue', 'violet']).toContain(
      identityAccent('@counterpoint'),
    );
  });
});
