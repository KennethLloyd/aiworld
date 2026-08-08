// Escapes % _ and \ so Prisma's contains (ILIKE) matches them literally.
// Without this, a query like %% would match every row.
export function escapeSearchText(query: string): string {
  return query.replace(/[\\%_]/g, (character) => `\\${character}`);
}
