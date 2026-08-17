import type { HttpClient } from '@/core/api/http-client';

/**
 * Gateways container type - the composition-root seam between core and the
 * worlds feature. Generic so core stays feature-agnostic: the canonical
 * WorldGateway port lives in features/worlds/api/world-gateway.ts, and the
 * concrete HttpWorldGateway adapter is built by
 * providers/gateways-provider.tsx and injected here. Core never imports
 * features, so there is no core -> feature import cycle.
 */
export interface Gateways<TWorldGateway = unknown> {
  worldGateway: TWorldGateway;
}

/**
 * Composition root factory: assembles the adapter object graph once. The
 * apiClient is passed for future gateway adapters (auth, characters, ...) so the
 * wiring point stays in one place; today only the world adapter exists.
 */
export function createGateways<TWorldGateway>(
  apiClient: HttpClient,
  worldGateway: TWorldGateway,
): Gateways<TWorldGateway> {
  void apiClient;
  return { worldGateway };
}
