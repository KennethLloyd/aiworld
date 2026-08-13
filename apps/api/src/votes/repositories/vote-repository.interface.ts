export abstract class VoteRepository {
  abstract create(input: {
    postId: string;
    authorMemberId: string;
    value: 1 | -1;
  }): Promise<{ id: string }>;
  /** Whether a member has already voted on a post. The vote action uses this
   * to treat a repeat vote as a skip instead of hitting the unique constraint. */
  abstract existsByMemberAndPost(
    memberId: string,
    postId: string,
  ): Promise<boolean>;
}
