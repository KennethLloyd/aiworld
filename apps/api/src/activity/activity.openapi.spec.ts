import { createOpenApiDocument } from '@/lib/openapi/openapi';

const activityOpenApiDocument = createOpenApiDocument();

type ActivityOperation = {
  security?: unknown;
  parameters?: Array<{ name: string; in: string }>;
  responses?: Record<string, unknown>;
};

type ActivityDocumentPath = {
  get?: ActivityOperation;
};

describe('activityOpenApiDocument', () => {
  it('registers the public character activity path', () => {
    const paths = (activityOpenApiDocument.paths ?? {}) as Record<
      string,
      ActivityDocumentPath
    >;

    expect(paths['/characters/{characterId}/activity']?.get).toBeDefined();
  });

  it('does not require the session cookie', () => {
    const paths = (activityOpenApiDocument.paths ?? {}) as Record<
      string,
      ActivityDocumentPath
    >;

    expect(paths['/characters/{characterId}/activity']?.get).not.toHaveProperty(
      'security',
    );
  });

  it('documents the characterId path param and the worldSlug query param', () => {
    const paths = (activityOpenApiDocument.paths ?? {}) as Record<
      string,
      ActivityDocumentPath
    >;

    const parameters =
      paths['/characters/{characterId}/activity']?.get?.parameters;

    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'characterId', in: 'path' }),
        expect.objectContaining({ name: 'worldSlug', in: 'query' }),
      ]),
    );
  });

  it('documents 200, 400, and 404 responses', () => {
    const paths = (activityOpenApiDocument.paths ?? {}) as Record<
      string,
      ActivityDocumentPath
    >;

    const responses = paths['/characters/{characterId}/activity']?.get
      ?.responses as Record<string, { description?: string }> | undefined;

    expect(Object.keys(responses ?? {}).sort()).toEqual(['200', '400', '404']);
  });
});
