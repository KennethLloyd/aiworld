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
      <section
        aria-labelledby="world-identity-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h3
              id="world-identity-heading"
              className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
            >
              Identity &amp; scope
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/60">
              Give this World a clear identity and define the conversations it
              should contain.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">
            Required fields
          </span>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
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
        </div>
        <div className="mt-5">
          <Textarea
            label="Topic scope"
            placeholder="What is this world about?"
            rows={5}
            error={errors.topicScope?.message}
            {...register('topicScope')}
          />
        </div>
      </section>

      <fieldset
        aria-labelledby="world-rules-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <legend className="sr-only">Rules</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h3
              id="world-rules-heading"
              className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
            >
              Rules
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/60">
              Set the boundaries residents must follow. Use a full sentence for
              each rule so it remains clear in the simulation context.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">
            {rulesField.fields.length}{' '}
            {rulesField.fields.length === 1 ? 'rule' : 'rules'}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {rulesField.fields.map((field, index) => (
            <div
              key={field.id}
              className="flex items-start gap-3 rounded-xl border border-glass-border bg-surface-2/60 p-3 sm:p-4"
            >
              <span
                aria-hidden="true"
                className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-diplomat/30 bg-brand-diplomat/10 font-mono text-[10px] font-bold text-brand-diplomat"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <Textarea
                  aria-label={`Rule ${index + 1}`}
                  placeholder="Describe a rule for this World"
                  rows={4}
                  {...register(`rules.${index}.value` as const)}
                />
              </div>
              <button
                type="button"
                onClick={() => rulesField.remove(index)}
                aria-label={`Remove rule ${index + 1}`}
                className={`${buttonClasses('ghost', 'sm')} shrink-0`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => rulesField.append({ value: '' })}
          className={`${buttonClasses('outline', 'sm')} mt-4`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add rule
        </button>
      </fieldset>

      <fieldset
        aria-labelledby="world-description-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <legend className="sr-only">Description</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h3
              id="world-description-heading"
              className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
            >
              Description
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/60">
              Add structured context that helps people and future tools
              understand this World.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">
            Optional metadata
          </span>
        </div>

        {descriptionField.fields.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-glass-border px-4 py-5 text-sm text-ink/50">
            No description entries yet. Add a key and value when this World
            needs more context.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {descriptionField.fields.map((field, index) => (
              <div
                key={field.id}
                className="grid items-start gap-3 rounded-xl border border-glass-border bg-surface-2/60 p-3 md:grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)_auto] sm:p-4"
              >
                <Input
                  aria-label={`Description key ${index + 1}`}
                  label="Key"
                  placeholder="key"
                  error={errors.descriptionEntries?.[index]?.key?.message}
                  {...register(`descriptionEntries.${index}.key` as const)}
                />
                <Textarea
                  aria-label={`Description value ${index + 1}`}
                  label="Value"
                  placeholder="Text for this key"
                  rows={4}
                  {...register(`descriptionEntries.${index}.value` as const)}
                />
                <button
                  type="button"
                  onClick={() => descriptionField.remove(index)}
                  aria-label={`Remove description entry ${index + 1}`}
                  className={`${buttonClasses('ghost', 'sm')} shrink-0 md:mt-6`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => descriptionField.append({ key: '', value: '' })}
          className={`${buttonClasses('outline', 'sm')} mt-4`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add description
        </button>
      </fieldset>

      <section
        aria-labelledby="world-status-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <div className="grid gap-5 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-end">
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
                onChange={(event) =>
                  field.onChange(event.target.value === 'true')
                }
              />
            )}
          />
          <div>
            <h3
              id="world-status-heading"
              className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
            >
              Visibility
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">
              Inactive Worlds stay in the admin directory but are hidden from
              public browsing and simulation controls.
            </p>
          </div>
        </div>
      </section>

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

      <div className="flex flex-col gap-3 border-t border-glass-border pt-5 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="submit"
          loading={isSubmitting}
          className="w-full sm:w-auto"
        >
          {mode === 'create' ? 'Create world' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
