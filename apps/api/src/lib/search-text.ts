/**
 * Escapes a free-text query for Prisma's `contains` (ILIKE) matching so the
 * wildcard characters `%` and `_` are matched literally. Without this, a
 * query like `%%` matches every row and searches for literal `%` are
 * impossible — "no-result" queries must be well-defined.
 */
export function escapeSearchText(query: string): string {
  return query.replace(/[\\%_]/g, (character) => `\\${character}`);
}
