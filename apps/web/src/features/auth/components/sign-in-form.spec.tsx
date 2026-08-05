import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SignInForm, type SignInFormValues } from './sign-in-form';

describe('SignInForm', () => {
  it('renders labeled email/password fields and a submit button', () => {
    render(
      <SignInForm
        isSubmitting={false}
        submitError={null}
        onSubmit={vi.fn<(values: SignInFormValues) => void>()}
      />,
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('submits the entered values', async () => {
    const onSubmit = vi.fn<(values: SignInFormValues) => void>();
    render(
      <SignInForm
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'admin@aiworld.test');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // handleSubmit forwards the submit event as the second argument.
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      email: 'admin@aiworld.test',
      password: 'secret',
    });
  });

  it('shows field errors for an invalid email and empty password', async () => {
    render(
      <SignInForm
        isSubmitting={false}
        submitError={null}
        onSubmit={vi.fn<(values: SignInFormValues) => void>()}
      />,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('renders the inline auth error and does not call onSubmit', async () => {
    const onSubmit = vi.fn<(values: SignInFormValues) => void>();
    render(
      <SignInForm
        isSubmitting={false}
        submitError="Invalid email or password"
        onSubmit={onSubmit}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid email or password');

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the submit button while the mutation is pending', () => {
    render(
      <SignInForm
        isSubmitting
        submitError={null}
        onSubmit={vi.fn<(values: SignInFormValues) => void>()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
