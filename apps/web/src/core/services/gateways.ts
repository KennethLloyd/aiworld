import type { HttpClient } from '@/core/api/http-client';

/**
 * Gateways container type - the composition-root seam between core and the
 * worlds feature. Generic so core stays feature-agnostic: the canonical
 * WorldGateway port lives in features/worlds/api/world-gateway.ts, and the
 * concrete HttpWorldGateway adapter is built by
 * providers/gateways-provider.tsx and injected here. Core never imports
 * features, so there is no core -> feature import cycle.
 */
export interface Gateways<TWorldGateway = unknown, TPostGateway = unknown> {
  worldGateway: TWorldGateway;
  postGateway: TPostGateway;
}

/**
 * Composition root factory: assembles the adapter object graph once. The
 * apiClient is passed for future gateway adapters (auth, characters, ...) so
 * the wiring point stays in one place; today only the world adapter exists.
 */
export function createGateways<TWorldGateway, TPostGateway>(
  apiClient: HttpClient,
  worldGateway: TWorldGateway,
  postGateway: TPostGateway,
): Gateways<TWorldGateway, TPostGateway> {
  void apiClient;
  return { worldGateway, postGateway };
}
