import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorldForm } from './world-form';
import type { WorldFormValues } from './world-form-schema';

const blankValues: WorldFormValues = {
  name: '',
  slug: '',
  topicScope: '',
  rules: [{ value: '' }],
  isActive: true,
  descriptionEntries: [],
};

describe('WorldForm', () => {
  it('renders the field groups with accessible labels', () => {
    render(
      <WorldForm
        mode="create"
        initialValues={blankValues}
        isSubmitting={false}
        submitError={null}
        onSubmit={vi.fn<(values: WorldFormValues) => void>()}
      />,
    );

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug')).toBeInTheDocument();
    expect(screen.getByLabelText('Topic scope')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Rules' })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Description' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create world' }),
    ).toBeInTheDocument();
  });

  it('adds and removes rule rows', async () => {
    render(
      <WorldForm
        mode="create"
        initialValues={blankValues}
        isSubmitting={false}
        submitError={null}
        onSubmit={vi.fn<(values: WorldFormValues) => void>()}
      />,
    );

    expect(screen.getByLabelText('Rule 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(screen.getByLabelText('Rule 2')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove rule 1' }),
    );
    // One row remains and is re-labeled as the first row.
    expect(screen.getByLabelText('Rule 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rule 2')).not.toBeInTheDocument();
  });

  it('adds and removes description entries', async () => {
    render(
      <WorldForm
        mode="create"
        initialValues={blankValues}
        isSubmitting={false}
        submitError={null}
        onSubmit={vi.fn<(values: WorldFormValues) => void>()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Add description' }),
    );
    expect(screen.getByLabelText('Description key 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Description value 1')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove description entry 1' }),
    );
    expect(
      screen.queryByLabelText('Description key 1'),
    ).not.toBeInTheDocument();
  });

  it('submits the entered values', async () => {
    const onSubmit = vi.fn<(values: WorldFormValues) => void>();
    render(
      <WorldForm
        mode="create"
        initialValues={blankValues}
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByLabelText('Name'), 'MBTI');
    await userEvent.type(screen.getByLabelText('Slug'), 'mbti');
    await userEvent.type(
      screen.getByLabelText('Topic scope'),
      'Personality typology.',
    );
    await userEvent.type(screen.getByLabelText('Rule 1'), 'Stay in character');
    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // handleSubmit forwards the submit event as the second argument.
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: 'MBTI',
      slug: 'mbti',
      topicScope: 'Personality typology.',
      rules: [{ value: 'Stay in character' }],
      isActive: true,
      descriptionEntries: [],
    });
  });

  it('surfaces field validation errors without submitting', async () => {
    const onSubmit = vi.fn<(values: WorldFormValues) => void>();
    render(
      <WorldForm
        mode="create"
        initialValues={blankValues}
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));

    // name, slug and topicScope all fail the shared validation rules. Assert
    // on the accessible error contract rather than Zod's version-specific copy.
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders the form-level server error', () => {
    render(
      <WorldForm
        mode="create"
        initialValues={blankValues}
        isSubmitting={false}
        submitError="Slug is already taken"
        onSubmit={vi.fn<(values: WorldFormValues) => void>()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Slug is already taken',
    );
  });

  it('labels the submit button for edit mode and disables while busy', () => {
    render(
      <WorldForm
        mode="edit"
        initialValues={blankValues}
        isSubmitting
        submitError={null}
        onSubmit={vi.fn<(values: WorldFormValues) => void>()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
