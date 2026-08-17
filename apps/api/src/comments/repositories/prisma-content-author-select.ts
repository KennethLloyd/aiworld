/**
 * Prisma-only: how to load the author of a post or comment.
 * Used by the posts and comments Prisma repositories.
 */
export const prismaContentAuthorSelect = {
  select: {
    id: true,
    character: {
      select: {
        handle: true,
        name: true,
        avatarUrl: true,
        classification: true,
        classificationGroup: true,
      },
    },
    user: {
      select: {
        username: true,
        name: true,
        image: true,
      },
    },
  },
} as const;
