import { PostRecord } from '@/posts/domain/post-record';

export function compareByHot(a: PostRecord, b: PostRecord): number {
  return (
    b.voteScore - a.voteScore ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
