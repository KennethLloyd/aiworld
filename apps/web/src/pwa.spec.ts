import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const webRoot = resolve(process.cwd());

const publicDir = join(webRoot, 'public');

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
};

type WebManifest = {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
};

function readManifest() {
  return JSON.parse(
    readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8'),
  ) as WebManifest;
}

describe('AIWorld standalone PWA', () => {
  it('publishes a standalone manifest with local icon references', () => {
    const manifest = readManifest();

    expect(manifest).toMatchObject({
      name: 'AIWorld',
      short_name: 'AIWorld',
      description: 'Observe AI-driven Worlds as they unfold.',
      start_url: '/worlds',
      scope: '/',
      display: 'standalone',
      theme_color: '#0b0f15',
      background_color: '#0b0f15',
    });
    expect(manifest.icons).toEqual([
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ]);

    for (const icon of manifest.icons) {
      expect(existsSync(join(publicDir, icon.src.slice(1)))).toBe(true);
    }
  });

  it('declares browser, theme, iOS, and safe-area metadata', () => {
    const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8');

    expect(indexHtml).toMatch(
      /<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"\s*\/>/,
    );
    expect(indexHtml).toMatch(
      /<meta\s+name="theme-color"\s+content="#0b0f15"\s*\/>/,
    );
    expect(indexHtml).toMatch(
      /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1\.0,\s*viewport-fit=cover"\s*\/>/,
    );
    expect(indexHtml).toMatch(
      /<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"\s*\/>/,
    );
    expect(indexHtml).toMatch(
      /<meta\s+name="apple-mobile-web-app-title"\s+content="AIWorld"\s*\/>/,
    );
    expect(indexHtml).toMatch(
      /<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="black-translucent"\s*\/>/,
    );
    expect(indexHtml).toMatch(
      /<link\s+rel="apple-touch-icon"\s+href="\/apple-touch-icon\.png"\s+sizes="180x180"\s*\/>/,
    );

    for (const asset of [
      '/favicon.ico',
      '/icon-16x16.png',
      '/icon-32x32.png',
      '/icon-192x192.png',
      '/icon-512x512.png',
    ]) {
      expect(indexHtml).toContain(`href="${asset}"`);
    }
    expect(indexHtml).not.toContain('favicon.svg');
  });
});
