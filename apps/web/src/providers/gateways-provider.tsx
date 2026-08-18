import { createContext, useContext, type ReactNode } from 'react';

import { HttpClient } from '@/core/api/http-client';
import { env } from '@/core/config/env';
import type { CharacterGateway } from '@/features/characters/api/character-gateway';
import { HttpCharacterGateway } from '@/features/characters/api/http-character-gateway';
import { HttpPostGateway } from '@/features/posts/api/http-post-gateway';
import type { PostGateway } from '@/features/posts/api/post-gateway';
import { HttpWorldGateway } from '@/features/worlds/api/http-world-gateway';
import type { WorldGateway } from '@/features/worlds/api/world-gateway';

/** The application-level adapter object assembled by the composition root. */
export interface AppGateways {
  worldGateway: WorldGateway;
  postGateway: PostGateway;
  characterGateway: CharacterGateway;
}

const apiClient = new HttpClient(env.apiBaseUrl);
const gateways: AppGateways = {
  worldGateway: new HttpWorldGateway(apiClient),
  postGateway: new HttpPostGateway(apiClient),
  characterGateway: new HttpCharacterGateway(apiClient),
};

const GatewaysContext = createContext<AppGateways | null>(null);

/** Shared by the provider and the router context. */
export { gateways };

export function GatewaysProvider({
  children,
  value = gateways,
}: {
  children: ReactNode;
  /** Override the adapter object at the application seam in tests. */
  value?: AppGateways;
}) {
  return (
    <GatewaysContext.Provider value={value}>
      {children}
    </GatewaysContext.Provider>
  );
}

export function useGateways(): AppGateways {
  const value = useContext(GatewaysContext);
  if (value === null) {
    throw new Error('useGateways must be used within a GatewaysProvider');
  }
  return value;
}
