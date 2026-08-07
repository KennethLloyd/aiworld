import {
  adminCharacterResponseSchema,
  adminListCharactersResponseSchema,
  characterResponseSchema,
  listCharactersResponseSchema,
} from '@aiworld/shared/schemas/character-response.schema';
import {
  createCharacterSchema,
  listCharactersQuerySchema,
  updateCharacterSchema,
} from '@aiworld/shared/schemas/character.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export function registerCharactersOpenApi(registry: OpenAPIRegistry): void {
  const publicCharacter = characterResponseSchema.meta({
    id: 'CharacterResponse',
  });
  const adminCharacter = adminCharacterResponseSchema.meta({
    id: 'AdminCharacterResponse',
  });
  const publicList = listCharactersResponseSchema.meta({
    id: 'ListCharactersResponse',
  });
  const adminList = adminListCharactersResponseSchema.meta({
    id: 'AdminListCharactersResponse',
  });
  const characterId = z.uuid();
  const protectedOperation = [{ betterAuthSession: [] }];

  registry.registerPath({
    method: 'get',
    path: '/characters',
    tags: ['characters'],
    summary: 'List characters',
    request: { query: listCharactersQuerySchema },
    responses: {
      200: {
        description:
          'Public or ADMIN character list based on the session role.',
        content: {
          'application/json': {
            schema: z.union([publicList, adminList]),
          },
        },
      },
      400: { description: 'The query parameters failed validation.' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/characters/{characterId}',
    tags: ['characters'],
    summary: 'Get a character',
    request: { params: z.object({ characterId }) },
    responses: {
      200: {
        description:
          'Public or ADMIN character details based on the session role.',
        content: {
          'application/json': {
            schema: z.union([publicCharacter, adminCharacter]),
          },
        },
      },
      404: { description: 'No visible character exists with the given ID.' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/characters',
    tags: ['characters'],
    summary: 'Create a character',
    security: protectedOperation,
    request: {
      body: {
        content: { 'application/json': { schema: createCharacterSchema } },
      },
    },
    responses: {
      201: {
        description:
          'The created character, including its private prompt for ADMIN.',
        content: { 'application/json': { schema: adminCharacter } },
      },
      400: { description: 'The request body failed validation.' },
      401: { description: 'Authentication is required.' },
      403: { description: 'The authenticated user is not an ADMIN.' },
      404: { description: 'The optional starting World was not found.' },
      409: { description: 'The character handle is already in use.' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/characters/{characterId}',
    tags: ['characters'],
    summary: 'Update or deactivate a character',
    security: protectedOperation,
    request: {
      params: z.object({ characterId }),
      body: {
        content: { 'application/json': { schema: updateCharacterSchema } },
      },
    },
    responses: {
      200: {
        description:
          'The updated character, including its private prompt for ADMIN.',
        content: { 'application/json': { schema: adminCharacter } },
      },
      400: { description: 'The request body failed validation.' },
      401: { description: 'Authentication is required.' },
      403: { description: 'The authenticated user is not an ADMIN.' },
      404: { description: 'No character exists with the given ID.' },
      409: { description: 'The character handle is already in use.' },
    },
  });
}
