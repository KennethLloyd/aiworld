import type {
  ListWorldsResponse,
  WorldResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import type {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { listWorldsQuerySchema } from '@aiworld/shared/schemas/world.schema';
import { z } from 'zod';

/**
 * The public /worlds search-param contract: the full wire query minus
 * `isActive`, so public URL parameters can never request inactive worlds (the
 * backend list endpoint defaults to active-only). Defaults are baked into the
 * schema so an empty URL yields stable, shareable page/limit values.
 */
export const publicListWorldsQuerySchema = listWorldsQuerySchema.omit({
  isActive: true,
});

export type PublicListWorldsQuery = z.infer<typeof publicListWorldsQuerySchema>;

/**
 * The stable, URL-shareable defaults the schema applies to an empty URL
 * (?page=1&limit=20). Typed navigation targets (/ -> /worlds redirect and the
 * not-found link back to the list) reuse this so defaults live in one place.
 */
export const publicListWorldsDefaults: PublicListWorldsQuery =
  publicListWorldsQuerySchema.parse({});

/**
 * WorldGateway port - the wire boundary the worlds feature consumes. The
 * canonical home of this interface; HttpWorldGateway implements it and tests
 * substitute fakes at this seam. Consumers (hooks, forms, routes) depend on
 * the port, never on fetch or HttpClient.
 */
export interface WorldGateway {
  list(query: ListWorldsQuery): Promise<ListWorldsResponse>;
  getBySlug(slug: string): Promise<WorldResponse>;
  create(input: CreateWorld): Promise<WorldResponse>;
  update(slug: string, input: UpdateWorld): Promise<WorldResponse>;
  delete(slug: string): Promise<void>;
}
