import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { AuthProvider } from './providers/auth-provider';
import { GatewaysProvider } from './providers/gateways-provider';
import { queryClient } from './providers/query-client';

import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GatewaysProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GatewaysProvider>
    </QueryClientProvider>
  </StrictMode>,
);
