import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { buttonClasses } from '@/shared/ui/button';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

import { worldFormSchema, type WorldFormValues } from './world-form-schema';

export interface WorldFormProps {
  mode: 'create' | 'edit';
  initialValues: WorldFormValues;
  isSubmitting: boolean;
  /** Form-level error (mutation failure) shown in an alert area. */
  submitError: string | null;
  resetKey?: string | number;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (values: WorldFormValues) => void;
}

/**
 * Admin world create/edit form: React Hook Form with the feature-local
 * worldFormSchema, useFieldArray for rules and description entries, and the
 * shared accessible Input/Textarea/Select primitives. Presentational - the
 * route owns the mutation, toast, and navigation and maps failures into
 * submitError.
 */
export function WorldForm({
  mode,
  initialValues,
  isSubmitting,
  submitError,
  resetKey,
  onDirtyChange,
  onSubmit,
}: WorldFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<WorldFormValues>({
    resolver: zodResolver(worldFormSchema),
    defaultValues: initialValues,
  });
  const initialValuesRef = useRef(initialValues);

  useEffect(() => {
    initialValuesRef.current = initialValues;
  }, [initialValues]);

  useEffect(() => {
    if (resetKey !== undefined) {
      reset(initialValuesRef.current);
    }
  }, [reset, resetKey]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Rows are {value} objects (see ruleRowSchema) so FieldArrayPath covers the
  // rules array; the wire payload maps them back to plain strings.
  const rulesField = useFieldArray<WorldFormValues, 'rules'>({
    control,
    name: 'rules',
  });
  const descriptionField = useFieldArray<WorldFormValues, 'descriptionEntries'>(
    {
      control,
      name: 'descriptionEntries',
    },
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          placeholder="e.g. MBTI"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Slug"
          placeholder="e.g. mbti"
          hint={
            mode === 'edit'
              ? 'Changing the slug changes the world public URL.'
              : 'Lowercase letters, numbers and hyphens.'
          }
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Textarea
          label="Topic scope"
          placeholder="What is this world about?"
          error={errors.topicScope?.message}
          {...register('topicScope')}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-medium uppercase tracking-wider text-ink/60">
          Rules
        </legend>
        {rulesField.fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <Input
              aria-label={`Rule ${index + 1}`}
              placeholder={`Rule ${index + 1}`}
              {...register(`rules.${index}.value` as const)}
            />
            <button
              type="button"
              onClick={() => rulesField.remove(index)}
              aria-label={`Remove rule ${index + 1}`}
              className={buttonClasses('ghost', 'sm')}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() => rulesField.append({ value: '' })}
            className={buttonClasses('outline', 'sm')}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add rule
          </button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-medium uppercase tracking-wider text-ink/60">
          Description
        </legend>
        {descriptionField.fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="grid w-full gap-2 sm:grid-cols-[1fr_2fr]">
              <Input
                aria-label={`Description key ${index + 1}`}
                placeholder="key"
                error={errors.descriptionEntries?.[index]?.key?.message}
                {...register(`descriptionEntries.${index}.key` as const)}
              />
              <Textarea
                aria-label={`Description value ${index + 1}`}
                placeholder="Text for this key"
                {...register(`descriptionEntries.${index}.value` as const)}
              />
            </div>
            <button
              type="button"
              onClick={() => descriptionField.remove(index)}
              aria-label={`Remove description entry ${index + 1}`}
              className={buttonClasses('ghost', 'sm')}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() => descriptionField.append({ key: '', value: '' })}
            className={buttonClasses('outline', 'sm')}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add description
          </button>
        </div>
      </fieldset>

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <Select
            label="Status"
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            value={String(field.value)}
            onChange={(event) => field.onChange(event.target.value === 'true')}
          />
        )}
      />

      {submitError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p>{submitError}</p>
        </div>
      ) : null}

      <div>
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Create world' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
