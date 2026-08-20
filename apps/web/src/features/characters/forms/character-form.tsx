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
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Handle"
          hint="Letters, numbers, and underscores."
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
          hint="Optional; provide the group with it."
          error={errors.classification?.message}
          {...register('classification')}
        />
        <Input
          label="Classification group"
          error={errors.classificationGroup?.message}
          {...register('classificationGroup')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Input
          label="Avatar URL"
          hint="Leave empty to use the shared fallback."
          error={errors.avatarUrl?.message}
          {...register('avatarUrl')}
        />
        <Avatar
          src={avatarUrl}
          alt={name || 'Character'}
          name={name || 'Character'}
          size="lg"
        />
      </div>

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

      <Textarea
        label="System prompt"
        hint="Admin-only simulation instructions; never shown in public projections."
        error={errors.systemPrompt?.message}
        {...register('systemPrompt')}
      />

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
          {mode === 'create' ? 'Create character' : 'Save character'}
        </Button>
      </div>
    </form>
  );
}
