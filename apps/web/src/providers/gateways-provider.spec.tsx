import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GatewaysProvider, useGateways } from './gateways-provider';

function Probe() {
  const { worldGateway, postGateway } = useGateways();
  return (
    <ul>
      <li data-testid="list">{typeof worldGateway.list}</li>
      <li data-testid="get-by-slug">{typeof worldGateway.getBySlug}</li>
      <li data-testid="create">{typeof worldGateway.create}</li>
      <li data-testid="update">{typeof worldGateway.update}</li>
      <li data-testid="delete">{typeof worldGateway.delete}</li>
      <li data-testid="posts">{typeof postGateway.list}</li>
    </ul>
  );
}

describe('GatewaysProvider', () => {
  it('exposes the composition-root gateways seam through useGateways()', () => {
    render(
      <GatewaysProvider>
        <Probe />
      </GatewaysProvider>,
    );

    expect(screen.getByTestId('list').textContent).toBe('function');
    expect(screen.getByTestId('get-by-slug').textContent).toBe('function');
    expect(screen.getByTestId('create').textContent).toBe('function');
    expect(screen.getByTestId('update').textContent).toBe('function');
    expect(screen.getByTestId('delete').textContent).toBe('function');
    expect(screen.getByTestId('posts').textContent).toBe('function');
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(
      'useGateways must be used within a GatewaysProvider',
    );
  });
});
