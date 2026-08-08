import { createOpenApiDocument } from '@/lib/openapi/openapi';

const searchOpenApiDocument = createOpenApiDocument();

type SearchOperation = {
  security?: unknown;
  parameters?: Array<{ name: string; in: string }>;
  responses?: Record<string, unknown>;
};

type SearchDocumentPath = {
  get?: SearchOperation;
};

describe('searchOpenApiDocument', () => {
  it('registers the public World discussion search path', () => {
    const paths = (searchOpenApiDocument.paths ?? {}) as Record<
      string,
      SearchDocumentPath
    >;

    expect(paths['/worlds/{slug}/search']?.get).toBeDefined();
  });

  it('does not require the session cookie', () => {
    const paths = (searchOpenApiDocument.paths ?? {}) as Record<
      string,
      SearchDocumentPath
    >;

    expect(paths['/worlds/{slug}/search']?.get).not.toHaveProperty('security');
  });

  it('documents the slug param and the q, page, and limit query params', () => {
    const paths = (searchOpenApiDocument.paths ?? {}) as Record<
      string,
      SearchDocumentPath
    >;

    const parameters = paths['/worlds/{slug}/search']?.get?.parameters;

    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'slug', in: 'path' }),
        expect.objectContaining({ name: 'q', in: 'query' }),
        expect.objectContaining({ name: 'page', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
      ]),
    );
  });

  it('documents 200, 400, and 404 responses', () => {
    const paths = (searchOpenApiDocument.paths ?? {}) as Record<
      string,
      SearchDocumentPath
    >;

    const responses = paths['/worlds/{slug}/search']?.get?.responses as
      | Record<string, { description?: string }>
      | undefined;

    expect(Object.keys(responses ?? {}).sort()).toEqual(['200', '400', '404']);
  });
});
