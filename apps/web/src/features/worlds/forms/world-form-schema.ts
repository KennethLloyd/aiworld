import {
  createWorldSchema,
  type CreateWorld,
  type UpdateWorld,
  updateWorldSchema,
} from '@aiworld/shared';
import { z } from 'zod';

/**
 * Editable rule row. Values are trimmed and blank rows are dropped when the
 * wire payload is assembled. Rows are small objects (not raw strings) because
 * react-hook-form's eager FieldArrayPath type omits primitive-element arrays;
 * the shared wire contract keeps `rules` as string[].
 */
export const ruleRowSchema = z.object({
  value: z.string(),
});

export type RuleRow = z.infer<typeof ruleRowSchema>;

/**
 * Editable description row. The key is required; blank rows are dropped when
 * the wire payload is assembled.
 */
export const descriptionEntrySchema = z.object({
  key: z.string().trim().min(1, { error: 'Key is required' }),
  value: z.string(),
});

export type DescriptionEntry = z.infer<typeof descriptionEntrySchema>;

/**
 * Feature-local world form schema: the shared create rules (name, slug,
 * topicScope, optional isActive) with the rules string[] and description
 * record replaced by editable row shapes. Wire payloads assembled by
 * toCreateWorld/toUpdateWorld are re-validated against the shared
 * create/update schemas before any mutation.
 */
export const worldFormSchema = createWorldSchema
  .omit({ description: true })
  .extend({
    rules: z.array(ruleRowSchema),
    descriptionEntries: z.array(descriptionEntrySchema),
  });

export type WorldFormValues = z.infer<typeof worldFormSchema>;

/**
 * Converts editable rows to a description record, dropping rows whose key or
 * value is blank. Returns null when nothing remains so the shared nullish
 * description contract is satisfied.
 */
export function descriptionEntriesToRecord(
  entries: readonly DescriptionEntry[],
): Record<string, string> | null {
  const record: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    const value = entry.value.trim();
    if (key !== '' && value !== '') {
      record[key] = value;
    }
  }
  return Object.keys(record).length > 0 ? record : null;
}

function toWireValues(values: WorldFormValues) {
  return {
    name: values.name,
    slug: values.slug,
    topicScope: values.topicScope,
    rules: values.rules
      .map((rule) => rule.value.trim())
      .filter((rule) => rule !== ''),
    isActive: values.isActive,
    description: descriptionEntriesToRecord(values.descriptionEntries),
  };
}

/** Assembles and validates the create payload with the shared schema. */
export function toCreateWorld(values: WorldFormValues): CreateWorld {
  return createWorldSchema.parse(toWireValues(values));
}

/** Assembles and validates the update payload with the shared schema. */
export function toUpdateWorld(values: WorldFormValues): UpdateWorld {
  return updateWorldSchema.parse(toWireValues(values));
}
