import {
  encodeActivityCursor,
  parseActivityCursor,
} from '@/activity/domain/activity-cursor';
import { ActivityItemRecord } from '@/activity/domain/activity-record';

describe('activity cursor', () => {
  const postItem: ActivityItemRecord = {
    kind: 'post',
    record: {
      id: '00000000-0000-4000-8000-000000000301',
      title: 'Who actually uses the microwave for FISH?',
      content: 'It smells like low tide.',
      voteScore: 5,
      createdAt: new Date('2026-08-06T08:00:00.000Z'),
      updatedAt: new Date('2026-08-06T08:00:00.000Z'),
      author: {
        id: '00000000-0000-4000-8000-000000000101',
        handle: 'standard_procedure',
        name: 'Standard_Procedure',
        avatarUrl: null,
      },
    },
  };

  it('round-trips an encoded cursor back to its keyset position', () => {
    const encoded = encodeActivityCursor(postItem);
    const parsed = parseActivityCursor(encoded);

    expect(parsed).toEqual({
      ok: true,
      cursor: { createdAt: postItem.record.createdAt, id: postItem.record.id },
    });
  });

  it('encodes to base64url (an opaque, URL-safe string)', () => {
    const encoded = encodeActivityCursor(postItem);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
  });

  it('treats an absent cursor as the start of the timeline', () => {
    expect(parseActivityCursor(undefined)).toEqual({
      ok: true,
      cursor: null,
    });
  });

  it.each([
    ['not base64url at all', 'not-a-cursor'],
    ['valid base64 but not JSON', Buffer.from('garbage').toString('base64url')],
    [
      'JSON without a createdAt field',
      Buffer.from('{"id":"x"}').toString('base64url'),
    ],
    [
      'a non-date createdAt',
      Buffer.from('{"createdAt":123,"id":"x"}').toString('base64url'),
    ],
    ['an array payload', Buffer.from('[1,2]').toString('base64url')],
  ])('rejects %s', (_label, raw) => {
    expect(parseActivityCursor(raw)).toEqual({ ok: false });
  });
});
