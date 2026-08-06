import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

import { registerCharactersOpenApi } from '@/characters/characters.openapi';
import { registerWorldMembersOpenApi } from '@/world-members/world-members.openapi';
import { registerWorldOpenApi } from '@/world/world.openapi';

const openApiRegistrars: Array<(registry: OpenAPIRegistry) => void> = [
  registerWorldOpenApi,
  registerCharactersOpenApi,
  registerWorldMembersOpenApi,
];

export function createOpenApiDocument(): OpenAPIObject {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'betterAuthSession', {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
  });

  openApiRegistrars.forEach((register) => register(registry));

  // Nest's OpenAPIObject requires `paths` while the V31 generator's output type
  // declares it optional; the generated document always includes it.
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'AIWorld API',
      version: '1.0.0',
    },
    servers: [{ url: '/api' }],
  }) as OpenAPIObject;
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(), {
    useGlobalPrefix: true,
  });
}
