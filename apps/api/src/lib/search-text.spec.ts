import { escapeSearchText } from '@/lib/search-text';

describe('escapeSearchText', () => {
  it('leaves plain text untouched', () => {
    expect(escapeSearchText('toaster situation')).toBe('toaster situation');
  });

  it('escapes the ILIKE wildcards so they match literally', () => {
    expect(escapeSearchText('100%')).toBe('100\\%');
    expect(escapeSearchText('a_b')).toBe('a\\_b');
    expect(escapeSearchText('\\')).toBe('\\\\');
  });

  it('escapes every occurrence', () => {
    expect(escapeSearchText('%a%b_c%')).toBe('\\%a\\%b\\_c\\%');
  });

  it('handles an empty query', () => {
    expect(escapeSearchText('')).toBe('');
  });
});
