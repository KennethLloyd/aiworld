export type VoteValue = 1 | -1;

export type CurrentVote = {
  id: string;
  value: VoteValue;
};

export abstract class VoteRepository {
  abstract findByMemberAndPost(
    memberId: string,
    postId: string,
  ): Promise<CurrentVote | null>;
  abstract findByMemberAndComment(
    memberId: string,
    commentId: string,
  ): Promise<CurrentVote | null>;
  /**
   * Sets a member's current vote on a Post and updates the denormalized score
   * atomically. A null value removes the current Vote row.
   */
  abstract setForPost(input: {
    postId: string;
    authorMemberId: string;
    value: VoteValue | null;
  }): Promise<{ id: string } | null>;
  /**
   * Sets a member's current vote on a Comment and updates the denormalized
   * score atomically. A null value removes the current Vote row.
   */
  abstract setForComment(input: {
    commentId: string;
    authorMemberId: string;
    value: VoteValue | null;
  }): Promise<{ id: string } | null>;
}
