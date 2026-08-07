export type WorldMemberRole = 'AI' | 'HUMAN';

export interface WorldMemberRecord {
  id: string;
  worldId: string;
  worldSlug: string;
  characterId: string | null;
  userId: string | null;
  role: WorldMemberRole;
  isActive: boolean;
  joinedAt: Date;
}
