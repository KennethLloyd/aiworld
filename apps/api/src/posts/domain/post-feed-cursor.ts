import type { PostSort } from '@aiworld/shared/schemas/post.schema';

import type { PostFeedRecord } from '@/posts/domain/post-record';

export interface PostFeedCursor {
  sort: PostSort;
  voteScore: number;
  createdAt: Date;
  id: string;
}

export type PostFeedCursorParseResult =
  | { ok: true; cursor: PostFeedCursor | null }
  | { ok: false };

/** Opaque keyset position for the World feed's deterministic sort order. */
export function encodePostFeedCursor(
  post: PostFeedRecord,
  sort: PostSort,
): string {
  return Buffer.from(
    JSON.stringify({
      sort,
      voteScore: post.voteScore,
      createdAt: post.createdAt.toISOString(),
      id: post.id,
    }),
  ).toString('base64url');
}

export function parsePostFeedCursor(
  raw: string | undefined,
  expectedSort: PostSort,
): PostFeedCursorParseResult {
  if (raw === undefined) {
    return { ok: true, cursor: null };
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );
    if (
      !isRecord(parsed) ||
      parsed.sort !== expectedSort ||
      typeof parsed.id !== 'string' ||
      typeof parsed.voteScore !== 'number' ||
      !Number.isFinite(parsed.voteScore) ||
      typeof parsed.createdAt !== 'string'
    ) {
      return { ok: false };
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return { ok: false };
    }

    return {
      ok: true,
      cursor: {
        sort: expectedSort,
        voteScore: parsed.voteScore,
        createdAt,
        id: parsed.id,
      },
    };
  } catch {
    return { ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
