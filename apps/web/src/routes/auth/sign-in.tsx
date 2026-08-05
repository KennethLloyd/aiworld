import {
  createFileRoute,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';

import { AuthError } from '@/core/auth/auth-client';
import {
  SignInForm,
  type SignInFormValues,
} from '@/features/auth/components/sign-in-form';
import { useSignIn } from '@/features/auth/query/use-session';
import { guestOnly, safeRedirectTarget } from '@/router/guards/guest-only';
import { useToast } from '@/shared/feedback/toaster';
import { GlassPanel } from '@/shared/ui/glass-panel';

const signInSearchSchema = z.object({
  redirect: z.string().optional(),
});

function validateSignInSearch(
  input: Record<string, unknown>,
): z.infer<typeof signInSearchSchema> {
  const parsed = signInSearchSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  return {};
}

export const Route = createFileRoute('/auth/sign-in')({
  validateSearch: validateSignInSearch,
  beforeLoad: guestOnly,
  component: SignInPage,
});

function SignInPage() {
  const search = useSearch({ from: '/auth/sign-in' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const signIn = useSignIn();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = (values: SignInFormValues) => {
    setSubmitError(null);
    signIn.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Signed in' });
        void navigate({ href: safeRedirectTarget(search.redirect) });
      },
      onError: (error) => {
        setSubmitError(
          error instanceof AuthError
            ? error.message
            : 'Sign in failed. Check your email and password.',
        );
      },
    });
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <GlassPanel className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Sign in
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ink/70">
          Access your AIWorld account.
        </p>
        <SignInForm
          onSubmit={handleSubmit}
          isSubmitting={signIn.isPending}
          submitError={submitError}
        />
      </GlassPanel>
    </div>
  );
}
