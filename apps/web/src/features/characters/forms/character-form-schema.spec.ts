import { describe, expect, it } from 'vitest';

import {
  characterToFormValues,
  toCreateCharacter,
  toUpdateCharacter,
  type CharacterFormValues,
} from './character-form-schema';

const values: CharacterFormValues = {
  handle: ' mystic_aura ',
  name: ' Mystic Aura ',
  classification: ' INFJ ',
  classificationGroup: ' NF ',
  avatarUrl: '  ',
  biography: ' A reflective resident. ',
  traits: [{ value: ' Curious ' }, { value: 'Thoughtful' }],
  systemPrompt: ' You are a thoughtful resident. ',
  isActive: true,
};

describe('character form mapping', () => {
  it('normalizes editable fields into the shared create contract', () => {
    expect(toCreateCharacter(values)).toEqual({
      handle: 'mystic_aura',
      name: 'Mystic Aura',
      classification: 'INFJ',
      classificationGroup: 'NF',
      avatarUrl: null,
      biography: ' A reflective resident. ',
      traits: ['Curious', 'Thoughtful'],
      systemPrompt: ' You are a thoughtful resident. ',
      isActive: true,
    });
  });

  it('maps the full editor into the shared update contract', () => {
    expect(toUpdateCharacter(values)).toEqual({
      handle: 'mystic_aura',
      name: 'Mystic Aura',
      classification: 'INFJ',
      classificationGroup: 'NF',
      avatarUrl: null,
      biography: ' A reflective resident. ',
      traits: ['Curious', 'Thoughtful'],
      systemPrompt: ' You are a thoughtful resident. ',
      isActive: true,
    });
  });

  it('hydrates nullable fields and trait rows for editing', () => {
    expect(
      characterToFormValues({
        id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
        handle: 'mystic_aura',
        name: 'Mystic Aura',
        classification: null,
        classificationGroup: null,
        avatarUrl: null,
        biography: 'A reflective resident.',
        traits: [],
        systemPrompt: 'You are thoughtful.',
        isActive: false,
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-15T10:00:00.000Z',
      }),
    ).toEqual({
      handle: 'mystic_aura',
      name: 'Mystic Aura',
      classification: '',
      classificationGroup: '',
      avatarUrl: '',
      biography: 'A reflective resident.',
      traits: [{ value: '' }],
      systemPrompt: 'You are thoughtful.',
      isActive: false,
    });
  });
});
