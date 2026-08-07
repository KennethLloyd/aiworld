/**
 * The public author identity for content reads: the WorldMember's Character
 * when one exists. A member without a Character (HUMAN role) maps to a null
 * author; inactive members keep their identity.
 */
export const contentAuthorSelect = {
  select: {
    character: {
      select: {
        id: true,
        handle: true,
        name: true,
        avatarUrl: true,
      },
    },
  },
} as const;
