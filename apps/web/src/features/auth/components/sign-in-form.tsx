import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

/**
 * Feature-local sign-in validation (valid email, nonempty password). The
 * Better Auth server remains the source of truth; this schema only shapes the
 * client form before authApi.signIn runs.
 */
export const signInSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
  password: z.string().min(1, { error: 'Password is required' }),
});

export type SignInFormValues = z.infer<typeof signInSchema>;

export interface SignInFormProps {
  isSubmitting: boolean;
  /** Form-level auth error rendered inline (AuthError.message from the route). */
  submitError: string | null;
  onSubmit: (values: SignInFormValues) => void;
}

/**
 * Presentational sign-in form: React Hook Form + zodResolver, accessible
 * labeled inputs, inline field errors, a busy/disabled submit button, and an
 * inline auth-error area. The route owns the mutation, toast, and navigation.
 */
export function SignInForm({
  isSubmitting,
  submitError,
  onSubmit,
}: SignInFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 flex flex-col gap-4"
    >
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="Your password"
        error={errors.password?.message}
        {...register('password')}
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
      <Button type="submit" loading={isSubmitting} className="mt-2">
        Sign in
      </Button>
    </form>
  );
}
