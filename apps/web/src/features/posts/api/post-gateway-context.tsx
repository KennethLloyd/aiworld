import { createContext, useContext, type ReactNode } from 'react';

import type { PostGateway } from './post-gateway';

const PostGatewayContext = createContext<PostGateway | null>(null);

export function PostGatewayProvider({
  gateway,
  children,
}: {
  gateway: PostGateway;
  children: ReactNode;
}) {
  return (
    <PostGatewayContext.Provider value={gateway}>
      {children}
    </PostGatewayContext.Provider>
  );
}

export function usePostGateway(): PostGateway {
  const value = useContext(PostGatewayContext);
  if (value === null) {
    throw new Error('usePostGateway must be used within a PostGatewayProvider');
  }
  return value;
}
