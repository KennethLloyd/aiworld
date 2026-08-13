import { createOpenApiDocument } from '@/lib/openapi/openapi';

type SimulationDocumentPath = {
  get?: {
    security?: unknown;
    responses?: Record<string, unknown>;
  };
  patch?: {
    security?: unknown;
    responses?: Record<string, unknown>;
  };
  post?: {
    security?: unknown;
    responses?: Record<string, unknown>;
  };
};

type SimulationDocumentResponse = {
  description: string;
  content?: {
    'application/json'?: {
      schema?: unknown;
    };
  };
};

describe('simulationAdminOpenApiDocument', () => {
  const document = createOpenApiDocument();
  const paths = (document.paths ?? {}) as Record<
    string,
    SimulationDocumentPath
  >;

  const simulationPaths = [
    '/worlds/{slug}/simulation',
    '/worlds/{slug}/simulation/state',
    '/worlds/{slug}/simulation/speed',
    '/worlds/{slug}/simulation/run-one-action',
    '/worlds/{slug}/simulation/custom-action',
    '/worlds/{slug}/simulation/telemetry',
    '/worlds/{slug}/simulation/logs',
  ];

  it('registers all seven admin simulation operations', () => {
    for (const path of simulationPaths) {
      expect(paths[path]).toBeDefined();
    }
  });

  it('requires the ADMIN session cookie on every simulation operation', () => {
    for (const path of simulationPaths) {
      const operation =
        paths[path]?.get ?? paths[path]?.patch ?? paths[path]?.post;
      expect(operation?.security).toEqual([{ betterAuthSession: [] }]);
    }
  });

  it('documents 401/403/404 on every operation', () => {
    for (const path of simulationPaths) {
      const responses =
        paths[path]?.get?.responses ??
        paths[path]?.patch?.responses ??
        paths[path]?.post?.responses;
      expect(responses).toBeDefined();
      expect(responses?.['401']).toBeDefined();
      expect(responses?.['403']).toBeDefined();
      expect(responses?.['404']).toBeDefined();
    }
  });

  it('uses the shared config response for the state and speed mutations', () => {
    const stateResponse = paths['/worlds/{slug}/simulation/state']?.patch
      ?.responses?.['200'] as SimulationDocumentResponse | { $ref: string };
    const speedResponse = paths['/worlds/{slug}/simulation/speed']?.patch
      ?.responses?.['200'] as SimulationDocumentResponse | { $ref: string };

    expect(stateResponse).toEqual({
      description: 'The updated simulation configuration.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SimulationConfigResponse' },
        },
      },
    });
    expect(speedResponse).toEqual(stateResponse);
  });

  it('declares 409 for the state mutation and HALTED run rejections', () => {
    expect(
      paths['/worlds/{slug}/simulation/state']?.patch?.responses?.['409'],
    ).toBeDefined();
    expect(
      paths['/worlds/{slug}/simulation/run-one-action']?.post?.responses?.[
        '409'
      ],
    ).toBeDefined();
    expect(
      paths['/worlds/{slug}/simulation/custom-action']?.post?.responses?.[
        '409'
      ],
    ).toBeDefined();
  });
});
