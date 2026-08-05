import { describe, expect, it } from 'vitest';

import {
  descriptionEntriesToRecord,
  toCreateWorld,
  toUpdateWorld,
  type WorldFormValues,
} from './world-form-schema';

const completeValues: WorldFormValues = {
  name: 'MBTI',
  slug: 'mbti',
  topicScope: 'Personality types, cognition and communication styles.',
  rules: [
    { value: 'Stay in character' },
    { value: '  Explain before debating  ' },
    { value: '   ' },
  ],
  isActive: true,
  descriptionEntries: [
    { key: 'about', value: 'A world about personality typology.' },
    { key: '', value: 'Dropped blank key' },
    { key: 'empty', value: '   ' },
  ],
};

describe('descriptionEntriesToRecord', () => {
  it('converts rows to a record, dropping blank keys and values', () => {
    expect(
      descriptionEntriesToRecord([
        { key: 'about', value: 'Typology' },
        { key: '', value: 'no key' },
        { key: 'blank', value: '   ' },
      ]),
    ).toEqual({ about: 'Typology' });
  });

  it('returns null when no usable entries remain', () => {
    expect(descriptionEntriesToRecord([])).toBeNull();
    expect(descriptionEntriesToRecord([{ key: '', value: '' }])).toBeNull();
  });
});

describe('toCreateWorld', () => {
  it('assembles and validates the create payload against the shared schema', () => {
    expect(toCreateWorld(completeValues)).toEqual({
      name: 'MBTI',
      slug: 'mbti',
      topicScope: 'Personality types, cognition and communication styles.',
      rules: ['Stay in character', 'Explain before debating'],
      isActive: true,
      description: { about: 'A world about personality typology.' },
    });
  });

  it('omits the description when every entry is blank', () => {
    const input = toCreateWorld({
      ...completeValues,
      descriptionEntries: [{ key: '', value: '' }],
    });
    expect(input.description).toBeNull();
  });

  it('throws a ZodError for an invalid slug (shared schema is authoritative)', () => {
    expect(() =>
      toCreateWorld({ ...completeValues, slug: 'Not A Slug!' }),
    ).toThrow(/Invalid/);
  });
});

describe('toUpdateWorld', () => {
  it('assembles and validates the update payload against the shared schema', () => {
    const input = toUpdateWorld({
      ...completeValues,
      rules: [{ value: 'Stay in character' }],
      descriptionEntries: [],
    });
    expect(input).toEqual({
      name: 'MBTI',
      slug: 'mbti',
      topicScope: 'Personality types, cognition and communication styles.',
      rules: ['Stay in character'],
      isActive: true,
      description: null,
    });
  });
});
