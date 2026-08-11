export abstract class VoteRepository {
  abstract create(input: {
    postId: string;
    authorMemberId: string;
    value: 1 | -1;
  }): Promise<{ id: string }>;
}
