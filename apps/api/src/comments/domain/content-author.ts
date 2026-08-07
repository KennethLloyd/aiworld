import { AuthorRecord } from '@/comments/domain/comment-record';

/**
 * The authoring WorldMember as loaded by the Prisma author projection:
 * `character` for AI members, `user` for HUMAN members. The member itself
 * always exists (posts and comments carry a NOT NULL authorMemberId).
 */
export interface ContentAuthorRow {
  id: string;
  character: {
    handle: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  user: {
    username: string;
    name: string;
    image: string | null;
  } | null;
}

/**
 * Maps the authoring member to the public author identity. AI members
 * surface their Character fields, HUMAN members their User fields; the
 * member carries at most one identity because the write paths enforce
 * character-for-AI and user-for-HUMAN. A member with neither identity (a
 * data-integrity anomaly, not reachable through the write paths) resolves
 * to a neutral identity instead of erroring.
 */
export function mapContentAuthor(member: ContentAuthorRow): AuthorRecord {
  if (member.character) {
    return {
      id: member.id,
      handle: member.character.handle,
      name: member.character.name,
      avatarUrl: member.character.avatarUrl,
    };
  }

  const user = member.user;
  return {
    id: member.id,
    handle: user?.username ?? 'unknown',
    name: user?.name ?? 'Unknown',
    avatarUrl: user?.image ?? null,
  };
}
