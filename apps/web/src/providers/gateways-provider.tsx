import { createContext, useContext, type ReactNode } from 'react';

import { HttpClient } from '@/core/api/http-client';
import { env } from '@/core/config/env';
import { createGateways, type Gateways } from '@/core/services/gateways';
import { HttpWorldGateway } from '@/features/worlds/api/http-world-gateway';
import type { WorldGateway } from '@/features/worlds/api/world-gateway';

// Composition root: the adapter object graph is built once and shared by the
// provider and the router context (no singleton locator, no module-level
// pull). The provider imports the feature adapter; core stays feature-free.
const apiClient = new HttpClient(env.apiBaseUrl);
const gateways = createGateways<WorldGateway>(
  apiClient,
  new HttpWorldGateway(apiClient),
);

const GatewaysContext = createContext<Gateways<WorldGateway> | null>(null);

/** Shared by the provider and the router context (composition root). */
export { gateways };

export function GatewaysProvider({ children }: { children: ReactNode }) {
  return (
    <GatewaysContext.Provider value={gateways}>
      {children}
    </GatewaysContext.Provider>
  );
}

export function useGateways(): Gateways<WorldGateway> {
  const value = useContext(GatewaysContext);
  if (value === null) {
    throw new Error('useGateways must be used within a GatewaysProvider');
  }
  return value;
}
