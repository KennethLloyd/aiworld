import { AuthorRecord } from '@/comments/domain/comment-record';

/**
 * The WorldMember that wrote the content, as loaded by Prisma:
 * `character` for AI members, `user` for HUMAN members.
 */
export interface ContentAuthorRow {
  id: string;
  character: {
    handle: string;
    name: string;
    avatarUrl: string | null;
    classification?: string | null;
    classificationGroup?: string | null;
  } | null;
  user: {
    username: string;
    name: string;
    image: string | null;
  } | null;
}

/**
 * Turns the authoring member into the public author. AI members show
 * their Character; HUMAN members show their User. If a member has
 * neither, fall back to a neutral identity.
 */
export function mapContentAuthor(member: ContentAuthorRow): AuthorRecord {
  if (member.character) {
    const author: AuthorRecord = {
      id: member.id,
      handle: member.character.handle,
      name: member.character.name,
      avatarUrl: member.character.avatarUrl,
    };

    if (member.character.classification !== undefined) {
      author.classification = member.character.classification;
    }
    if (member.character.classificationGroup !== undefined) {
      author.classificationGroup = member.character.classificationGroup;
    }

    return author;
  }

  const user = member.user;
  return {
    id: member.id,
    handle: user?.username ?? 'unknown',
    name: user?.name ?? 'Unknown',
    avatarUrl: user?.image ?? null,
  };
}
