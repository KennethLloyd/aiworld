import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import {
  MAX_CHARACTER_TRAITS,
  characterTraitSchema,
  createCharacterSchema,
  type CreateCharacter,
  type UpdateCharacter,
  updateCharacterSchema,
} from '@aiworld/shared/schemas/character.schema';
import { z } from 'zod';

export const traitRowSchema = z.object({
  value: characterTraitSchema.or(z.literal('')),
});

export type TraitRow = z.infer<typeof traitRowSchema>;

/** Editable shape used by the admin Character form. */
export const characterFormSchema = z
  .object({
    handle: createCharacterSchema.shape.handle,
    name: createCharacterSchema.shape.name,
    classification: z.union([
      z.literal(''),
      createCharacterSchema.shape.classification.unwrap().unwrap(),
    ]),
    classificationGroup: z.union([
      z.literal(''),
      createCharacterSchema.shape.classificationGroup.unwrap().unwrap(),
    ]),
    avatarUrl: z.union([
      z.literal(''),
      createCharacterSchema.shape.avatarUrl.unwrap().unwrap(),
    ]),
    biography: createCharacterSchema.shape.biography,
    traits: z.array(traitRowSchema).max(MAX_CHARACTER_TRAITS),
    systemPrompt: createCharacterSchema.shape.systemPrompt,
    isActive: z.boolean(),
  })
  .superRefine((value, context) => {
    const hasClassification = value.classification !== '';
    const hasClassificationGroup = value.classificationGroup !== '';
    if (hasClassification !== hasClassificationGroup) {
      context.addIssue({
        code: 'custom',
        path: [hasClassification ? 'classificationGroup' : 'classification'],
        message: 'Classification and group must be provided together',
      });
    }
  });

export type CharacterFormValues = z.infer<typeof characterFormSchema>;

function toWireValues(values: CharacterFormValues) {
  const classification = values.classification.trim();
  const classificationGroup = values.classificationGroup.trim();
  return {
    handle: values.handle.trim(),
    name: values.name.trim(),
    classification: classification === '' ? null : classification,
    classificationGroup:
      classificationGroup === '' ? null : classificationGroup,
    avatarUrl: values.avatarUrl.trim() === '' ? null : values.avatarUrl.trim(),
    biography: values.biography,
    traits: values.traits
      .map((trait) => trait.value.trim())
      .filter((trait) => trait !== ''),
    systemPrompt: values.systemPrompt,
    isActive: values.isActive,
  };
}

/** Assembles and validates the complete admin create payload. */
export function toCreateCharacter(
  values: CharacterFormValues,
): CreateCharacter {
  return createCharacterSchema.parse(toWireValues(values));
}

/** Assembles and validates the complete admin update payload. */
export function toUpdateCharacter(
  values: CharacterFormValues,
): UpdateCharacter {
  return updateCharacterSchema.parse(toWireValues(values));
}

export function characterToFormValues(
  character: AdminCharacterResponse,
): CharacterFormValues {
  return {
    handle: character.handle,
    name: character.name,
    classification: character.classification ?? '',
    classificationGroup: character.classificationGroup ?? '',
    avatarUrl: character.avatarUrl ?? '',
    biography: character.biography,
    traits:
      character.traits.length > 0
        ? character.traits.map((value) => ({ value }))
        : [{ value: '' }],
    systemPrompt: character.systemPrompt,
    isActive: character.isActive,
  };
}
