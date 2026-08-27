export type VoteValue = 1 | -1;

export type CurrentPostVote = {
  id: string;
  value: VoteValue;
};

export abstract class VoteRepository {
  abstract findByMemberAndPost(
    memberId: string,
    postId: string,
  ): Promise<CurrentPostVote | null>;
  /**
   * Sets a member's current vote on a Post and updates the denormalized score
   * atomically. A null value removes the current Vote row.
   */
  abstract setForPost(input: {
    postId: string;
    authorMemberId: string;
    value: VoteValue | null;
  }): Promise<{ id: string } | null>;
}
