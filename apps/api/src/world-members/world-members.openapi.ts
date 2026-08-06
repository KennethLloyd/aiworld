import {
  listWorldMembersResponseSchema,
  worldMemberResponseSchema,
} from '@aiworld/shared/schemas/world-member-response.schema';
import {
  createWorldMemberSchema,
  listWorldMembersQuerySchema,
  updateWorldMemberSchema,
} from '@aiworld/shared/schemas/world-member.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export function registerWorldMembersOpenApi(registry: OpenAPIRegistry): void {
  const memberResponse = worldMemberResponseSchema.meta({
    id: 'WorldMemberResponse',
  });
  const listResponse = listWorldMembersResponseSchema.meta({
    id: 'ListWorldMembersResponse',
  });
  const protectedOperation = [{ betterAuthSession: [] }];
  const memberId = z.uuid();

  registry.registerPath({
    method: 'get',
    path: '/world-members',
    tags: ['world-members'],
    summary: 'List World memberships',
    security: protectedOperation,
    request: { query: listWorldMembersQuerySchema },
    responses: {
      200: {
        description: 'ADMIN World membership records.',
        content: { 'application/json': { schema: listResponse } },
      },
      400: { description: 'The query parameters failed validation.' },
      401: { description: 'Authentication is required.' },
      403: { description: 'The authenticated user is not an ADMIN.' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/world-members/{memberId}',
    tags: ['world-members'],
    summary: 'Get a World membership',
    security: protectedOperation,
    request: { params: z.object({ memberId }) },
    responses: {
      200: {
        description: 'The requested World membership.',
        content: { 'application/json': { schema: memberResponse } },
      },
      401: { description: 'Authentication is required.' },
      403: { description: 'The authenticated user is not an ADMIN.' },
      404: { description: 'No membership exists with the given ID.' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/world-members',
    tags: ['world-members'],
    summary: 'Add a principal to a World',
    security: protectedOperation,
    request: {
      body: {
        content: { 'application/json': { schema: createWorldMemberSchema } },
      },
    },
    responses: {
      201: {
        description: 'The created membership.',
        content: { 'application/json': { schema: memberResponse } },
      },
      400: { description: 'The request body failed validation.' },
      401: { description: 'Authentication is required.' },
      403: { description: 'The authenticated user is not an ADMIN.' },
      404: { description: 'The World or principal was not found.' },
      409: { description: 'The principal is already a member of this World.' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/world-members/{memberId}',
    tags: ['world-members'],
    summary: 'Activate or deactivate a World membership',
    security: protectedOperation,
    request: {
      params: z.object({ memberId }),
      body: {
        content: { 'application/json': { schema: updateWorldMemberSchema } },
      },
    },
    responses: {
      200: {
        description: 'The updated membership.',
        content: { 'application/json': { schema: memberResponse } },
      },
      400: { description: 'The request body failed validation.' },
      401: { description: 'Authentication is required.' },
      403: { description: 'The authenticated user is not an ADMIN.' },
      404: { description: 'No membership exists with the given ID.' },
    },
  });
}
