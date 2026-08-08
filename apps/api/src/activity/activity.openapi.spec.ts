import { createOpenApiDocument } from '@/lib/openapi/openapi';

const activityOpenApiDocument = createOpenApiDocument();

type ActivityOperation = {
  security?: unknown;
  parameters?: Array<{ name: string; in: string; required?: boolean }>;
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

  it('documents the path param and the worldSlug, cursor, and limit query params', () => {
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
        expect.objectContaining({ name: 'cursor', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
      ]),
    );
  });

  it('documents the paginated response shape with discriminated items and nextCursor', () => {
    const components = activityOpenApiDocument.components as {
      schemas?: Record<string, unknown>;
    };

    const schema = components.schemas?.['CharacterActivityResponse'] as {
      properties?: { items?: unknown; nextCursor?: unknown };
    };
    expect(schema.properties).toHaveProperty('items');
    expect(schema.properties).toHaveProperty('nextCursor');

    const itemsSchema = schema.properties?.items as {
      items?: { anyOf?: Array<{ $ref?: string }> };
    };
    expect(itemsSchema.items?.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $ref: '#/components/schemas/PostActivityItem',
        }),
        expect.objectContaining({
          $ref: '#/components/schemas/CommentActivityItem',
        }),
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
