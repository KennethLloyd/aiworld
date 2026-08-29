import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { Avatar } from '@/shared/ui/avatar';
import { buttonClasses } from '@/shared/ui/button';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

import {
  characterFormSchema,
  type CharacterFormValues,
} from './character-form-schema';

export interface CharacterFormProps {
  mode: 'create' | 'edit';
  initialValues: CharacterFormValues;
  isSubmitting: boolean;
  submitError: string | null;
  resetKey?: string | number;
  identityId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (values: CharacterFormValues) => void;
}

/** Admin-only Character editor. All fields map back through shared contracts. */
export function CharacterForm({
  mode,
  initialValues,
  isSubmitting,
  submitError,
  resetKey,
  identityId,
  onDirtyChange,
  onSubmit,
}: CharacterFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: initialValues,
  });
  const initialValuesRef = useRef(initialValues);
  const traitsField = useFieldArray<CharacterFormValues, 'traits'>({
    control,
    name: 'traits',
  });
  const avatarUrl = watch('avatarUrl');
  const name = watch('name');

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

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <fieldset
        aria-labelledby="character-identity-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <legend className="sr-only">Identity</legend>
        <h3
          id="character-identity-heading"
          className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
        >
          Identity
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input
            label="Handle"
            hint="Letters, numbers, underscores."
            error={errors.handle?.message}
            {...register('handle')}
          />
          <Input
            label="Name"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Classification"
            hint="Optional."
            error={errors.classification?.message}
            {...register('classification')}
          />
          <Input
            label="Classification group"
            error={errors.classificationGroup?.message}
            {...register('classificationGroup')}
          />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Input
            label="Avatar URL"
            hint="Optional."
            error={errors.avatarUrl?.message}
            {...register('avatarUrl')}
          />
          <Avatar
            src={avatarUrl}
            alt={name || 'Character'}
            name={name || 'Character'}
            identityId={identityId}
            size="lg"
          />
        </div>
      </fieldset>

      <fieldset
        aria-labelledby="character-persona-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <legend className="sr-only">Persona</legend>
        <h3
          id="character-persona-heading"
          className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
        >
          Persona
        </h3>
        <div className="mt-5 flex flex-col gap-5">
          <Textarea
            label="Biography"
            error={errors.biography?.message}
            {...register('biography')}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-ink/60">
              Traits
            </legend>
            {traitsField.fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <Input
                  aria-label={`Trait ${index + 1}`}
                  placeholder={`Trait ${index + 1}`}
                  error={errors.traits?.[index]?.value?.message}
                  {...register(`traits.${index}.value` as const)}
                />
                <button
                  type="button"
                  onClick={() => traitsField.remove(index)}
                  aria-label={`Remove trait ${index + 1}`}
                  className={buttonClasses('ghost', 'sm')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={() => traitsField.append({ value: '' })}
                className={buttonClasses('outline', 'sm')}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add trait
              </button>
            </div>
          </fieldset>
        </div>
      </fieldset>

      <fieldset
        aria-labelledby="character-instructions-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <legend className="sr-only">Simulation instructions</legend>
        <h3
          id="character-instructions-heading"
          className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
        >
          Simulation instructions
        </h3>
        <div className="mt-5">
          <Textarea
            label="System prompt"
            hint="Private simulation instructions. Visible to administrators only."
            error={errors.systemPrompt?.message}
            {...register('systemPrompt')}
          />
        </div>
      </fieldset>

      <fieldset
        aria-labelledby="character-lifecycle-heading"
        className="rounded-2xl border border-glass-border bg-glass-20 p-4 sm:p-6"
      >
        <legend className="sr-only">Lifecycle</legend>
        <h3
          id="character-lifecycle-heading"
          className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink/70"
        >
          Lifecycle
        </h3>
        <div className="mt-5 max-w-xs">
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
        </div>
      </fieldset>

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
          {mode === 'create' ? 'Create character' : 'Save character'}
        </Button>
      </div>
    </form>
  );
}
