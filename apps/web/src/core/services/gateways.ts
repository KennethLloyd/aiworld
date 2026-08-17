import type { HttpClient } from '@/core/api/http-client';

/**
 * Gateways container type - the composition-root seam between core and the
 * worlds and posts features. Generic so core stays feature-agnostic: the
 * canonical gateway ports live in feature api modules, and the concrete HTTP
 * adapters are built by
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
 * the wiring point stays in one place.
 */
export function createGateways<TWorldGateway, TPostGateway>(
  apiClient: HttpClient,
  worldGateway: TWorldGateway,
  postGateway: TPostGateway,
): Gateways<TWorldGateway, TPostGateway> {
  void apiClient;
  return { worldGateway, postGateway };
}
