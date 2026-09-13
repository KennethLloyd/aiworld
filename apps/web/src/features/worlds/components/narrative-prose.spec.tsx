import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NarrativeProse } from './narrative-prose';

describe('NarrativeProse', () => {
  it('keeps paragraphs readable and gives exact resident handles a visual accent', () => {
    render(
      <NarrativeProse
        text={'@readthemanual found the mug.\n\n@leftsnacks asked a question.'}
      />,
    );

    expect(screen.getByText('@readthemanual')).toHaveClass(
      'text-brand-sentinel',
    );
    expect(screen.getByText('@leftsnacks')).toHaveClass('text-brand-sentinel');
    expect(document.querySelectorAll('p')[0]?.textContent).toContain(
      '@readthemanual found the mug',
    );
    expect(document.querySelectorAll('p')[1]?.textContent).toContain(
      '@leftsnacks asked a question',
    );
  });
});
