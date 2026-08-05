import { createOpenApiDocument } from '@/lib/openapi/openapi';

const worldOpenApiDocument = createOpenApiDocument();

type WorldDocumentResponse = {
  description: string;
  content?: {
    'application/json'?: {
      schema?: unknown;
    };
  };
};

type WorldDocumentRequestBody = {
  description?: string;
  content: {
    'application/json'?: {
      schema?: unknown;
    };
  };
};

type WorldDocumentPath = {
  get?: {
    responses?: Record<string, unknown>;
  };
  post?: {
    requestBody?: unknown;
    responses?: Record<string, unknown>;
  };
  patch?: {
    responses?: Record<string, unknown>;
  };
  delete?: {
    responses?: Record<string, unknown>;
  };
};

describe('worldOpenApiDocument', () => {
  it('is an OpenAPI 3.1 document for the Worlds API served under /api', () => {
    expect(worldOpenApiDocument.openapi).toBe('3.1.0');
    expect(worldOpenApiDocument.info).toEqual({
      title: 'AIWorld Worlds API',
      version: '1.0.0',
    });
    expect(worldOpenApiDocument.servers).toEqual([{ url: '/api' }]);
  });

  it('exposes the five expected operations across the two world paths', () => {
    const paths = (worldOpenApiDocument.paths ?? {}) as Record<
      string,
      WorldDocumentPath
    >;

    expect(Object.keys(paths).sort()).toEqual(['/worlds', '/worlds/{slug}']);
    expect(paths['/worlds']?.get).toBeDefined();
    expect(paths['/worlds']?.post).toBeDefined();
    expect(paths['/worlds/{slug}']?.get).toBeDefined();
    expect(paths['/worlds/{slug}']?.patch).toBeDefined();
    expect(paths['/worlds/{slug}']?.delete).toBeDefined();
  });

  it('registers the betterAuthSession cookie security scheme', () => {
    expect(worldOpenApiDocument.components?.securitySchemes).toEqual({
      betterAuthSession: {
        type: 'apiKey',
        in: 'cookie',
        name: 'better-auth.session_token',
      },
    });
  });

  it('requires the session cookie only on the mutating operations', () => {
    const paths = (worldOpenApiDocument.paths ?? {}) as Record<
      string,
      WorldDocumentPath
    >;

    expect(paths['/worlds']?.get).not.toHaveProperty('security');
    expect(paths['/worlds']?.post).toMatchObject({
      security: [{ betterAuthSession: [] }],
    });
    expect(paths['/worlds/{slug}']?.get).not.toHaveProperty('security');
    expect(paths['/worlds/{slug}']?.patch).toMatchObject({
      security: [{ betterAuthSession: [] }],
    });
    expect(paths['/worlds/{slug}']?.delete).toMatchObject({
      security: [{ betterAuthSession: [] }],
    });
  });

  it('produces the list response from the shared ListWorldsResponse schema', () => {
    const listResponse = worldOpenApiDocument.paths?.['/worlds']?.get
      ?.responses?.['200'] as
      | WorldDocumentResponse
      | { $ref: string }
      | undefined;

    expect(listResponse).toBeDefined();
    if (!listResponse || '$ref' in listResponse) {
      throw new Error('GET /worlds must declare an inline 200 response');
    }

    expect(listResponse.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/ListWorldsResponse',
    });
  });

  it('uses the shared create schema as the POST request body', () => {
    const createRequest = worldOpenApiDocument.paths?.['/worlds']?.post
      ?.requestBody as WorldDocumentRequestBody | { $ref: string } | undefined;

    expect(createRequest).toBeDefined();
    if (!createRequest || '$ref' in createRequest) {
      throw new Error('POST /worlds must declare an inline request body');
    }

    expect(createRequest.content['application/json']?.schema).toMatchObject({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
      },
    });
  });
});
