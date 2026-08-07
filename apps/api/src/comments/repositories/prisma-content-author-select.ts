/**
 * Prisma-specific author projection for content reads, shared by the posts
 * and comments Prisma adapters. Only concrete Prisma repositories use it;
 * the repository interfaces exchange domain records, never Prisma selects.
 */
export const prismaContentAuthorSelect = {
  select: {
    id: true,
    character: {
      select: {
        handle: true,
        name: true,
        avatarUrl: true,
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
