import { ActivityItemRecord } from '@/activity/domain/activity-record';

/**
 * Keyset position in the merged activity timeline. Both streams are
 * ordered createdAt DESC, id DESC, so the same shape keys each stream.
 */
export interface ActivityCursor {
  createdAt: Date;
  id: string;
}

export type ActivityCursorParseResult =
  | { ok: true; cursor: ActivityCursor | null }
  | { ok: false };

/**
 * The cursor is opaque to the client: base64url of the last emitted
 * item's `{ createdAt, kind, id }`. `kind` is carried for inspectability
 * only; the persisted position is createdAt + id.
 */
export function encodeActivityCursor(item: ActivityItemRecord): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: item.record.createdAt.toISOString(),
      kind: item.kind,
      id: item.record.id,
    }),
  ).toString('base64url');
}

export function parseActivityCursor(
  raw: string | undefined,
): ActivityCursorParseResult {
  if (raw === undefined) {
    return { ok: true, cursor: null };
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { createdAt?: unknown }).createdAt === 'string' &&
      typeof (parsed as { id?: unknown }).id === 'string'
    ) {
      const createdAt = new Date((parsed as { createdAt: string }).createdAt);
      if (!Number.isNaN(createdAt.getTime())) {
        return {
          ok: true,
          cursor: {
            createdAt,
            id: (parsed as { id: string }).id,
          },
        };
      }
    }
  } catch {
    // Not base64url JSON; falls through to invalid.
  }

  return { ok: false };
}
