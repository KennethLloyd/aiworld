import { describe, expect, it } from 'vitest';

import { identityAccent, identityGlyph } from './identity-accent';

describe('identity accent', () => {
  const identityId = '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11';

  it('derives a stable accent from the Resident identity ID', () => {
    expect(identityAccent(identityId)).toBe(identityAccent(identityId));
    expect(identityGlyph(identityId)).toBe(identityGlyph(identityId));
  });

  it('keeps accents within the presentation palette', () => {
    expect(['sky', 'indigo', 'teal', 'orange', 'blue', 'violet']).toContain(
      identityAccent('8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12'),
    );
  });
});
