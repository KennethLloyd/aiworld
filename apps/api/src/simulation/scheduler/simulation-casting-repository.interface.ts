/** One active AI member eligible to perform simulated work, with its most
 * recent action timestamp (null means the member has never acted). */
export type ActiveActorCandidate = {
  memberId: string;
  characterId: string;
  lastActivityAt: Date | null;
};

/** Feeds the scheduler's character and target selection. This is the seam
 * where Prisma stays an implementation detail: the picker works against these
 * records, and generated Prisma types never leave the adapter. */
export abstract class SimulationCastingRepository {
  /** Active AI members of a World, each with its last activity timestamp. */
  abstract findActiveActors(worldId: string): Promise<ActiveActorCandidate[]>;
  /** The most recent post ids of a World, newest first. */
  abstract findRecentPostIds(worldId: string, limit: number): Promise<string[]>;
}
