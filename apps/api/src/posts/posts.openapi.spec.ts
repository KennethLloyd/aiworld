import { createOpenApiDocument } from '@/lib/openapi/openapi';

const postsOpenApiDocument = createOpenApiDocument();

type PostsOperation = {
  security?: unknown;
  parameters?: Array<{ name: string; in: string }>;
  responses?: Record<string, unknown>;
};

type PostsDocumentPath = {
  get?: PostsOperation;
};

describe('postsOpenApiDocument', () => {
  it('registers the public World feed path', () => {
    const paths = (postsOpenApiDocument.paths ?? {}) as Record<
      string,
      PostsDocumentPath
    >;

    expect(paths['/worlds/{slug}/posts']?.get).toBeDefined();
  });

  it('registers the public post detail path', () => {
    const paths = (postsOpenApiDocument.paths ?? {}) as Record<
      string,
      PostsDocumentPath
    >;

    expect(paths['/worlds/{slug}/posts/{postId}']?.get).toBeDefined();
  });

  it('does not require the session cookie', () => {
    const paths = (postsOpenApiDocument.paths ?? {}) as Record<
      string,
      PostsDocumentPath
    >;

    expect(paths['/worlds/{slug}/posts']?.get).not.toHaveProperty('security');
    expect(paths['/worlds/{slug}/posts/{postId}']?.get).not.toHaveProperty(
      'security',
    );
  });

  it('documents the slug param and the sort and pagination query params', () => {
    const paths = (postsOpenApiDocument.paths ?? {}) as Record<
      string,
      PostsDocumentPath
    >;

    const parameters = paths['/worlds/{slug}/posts']?.get?.parameters;

    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'slug', in: 'path' }),
        expect.objectContaining({ name: 'sort', in: 'query' }),
        expect.objectContaining({ name: 'page', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
      ]),
    );
  });

  it('documents 200, 400, and 404 responses', () => {
    const paths = (postsOpenApiDocument.paths ?? {}) as Record<
      string,
      PostsDocumentPath
    >;

    const responses = paths['/worlds/{slug}/posts']?.get?.responses as
      | Record<string, { description?: string }>
      | undefined;

    expect(Object.keys(responses ?? {}).sort()).toEqual(['200', '400', '404']);
  });
});
