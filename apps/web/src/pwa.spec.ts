import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

const webRoot = resolve(process.cwd());

const publicDir = join(webRoot, 'public');
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

type PngMetadata = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaceMethod: number;
  imageData: Buffer[];
};

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

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function readPngMetadata(filename: string): PngMetadata {
  const bytes = readFileSync(join(publicDir, filename));
  expect(bytes.subarray(0, 8)).toEqual(pngSignature);

  let offset = 8;
  let metadata: PngMetadata | undefined;
  let hasEndChunk = false;

  while (offset < bytes.length) {
    expect(offset + 12).toBeLessThanOrEqual(bytes.length);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    expect(dataEnd + 4).toBeLessThanOrEqual(bytes.length);

    const chunkData = bytes.subarray(dataStart, dataEnd);
    const expectedCrc = bytes.readUInt32BE(dataEnd);
    expect(expectedCrc).toBe(crc32(bytes.subarray(offset + 4, dataEnd)));

    if (type === 'IHDR') {
      if (length !== 13) {
        throw new Error(`Invalid IHDR chunk length in ${filename}`);
      }
      metadata = {
        width: chunkData.readUInt32BE(0),
        height: chunkData.readUInt32BE(4),
        bitDepth: chunkData[8],
        colorType: chunkData[9],
        interlaceMethod: chunkData[12],
        imageData: [],
      };
    } else if (type === 'IDAT') {
      metadata?.imageData.push(chunkData);
    } else if (type === 'IEND') {
      if (length !== 0) {
        throw new Error(`Invalid IEND chunk length in ${filename}`);
      }
      hasEndChunk = true;
    }

    offset = dataEnd + 4;
  }

  expect(hasEndChunk).toBe(true);
  if (!metadata) {
    throw new Error(`Missing IHDR chunk in ${filename}`);
  }

  return metadata;
}

function alphaStats(filename: string) {
  const { width, height, bitDepth, colorType, interlaceMethod, imageData } =
    readPngMetadata(filename);

  if (bitDepth !== 8 || colorType !== 6 || interlaceMethod !== 0) {
    throw new Error(`Unsupported RGBA PNG format in ${filename}`);
  }

  const channels = 4;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(imageData));
  const pixels = Buffer.alloc(height * stride);
  let rawOffset = 0;
  let transparentPixels = 0;
  let partialAlphaPixels = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const row = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;
    const previousRowOffset = (y - 1) * stride;

    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const above = y > 0 ? pixels[previousRowOffset + index] : 0;
      const aboveLeft =
        y > 0 && index >= channels
          ? pixels[previousRowOffset + index - channels]
          : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : (() => {
                    const estimate = left + above - aboveLeft;
                    const leftDistance = Math.abs(estimate - left);
                    const aboveDistance = Math.abs(estimate - above);
                    const aboveLeftDistance = Math.abs(estimate - aboveLeft);
                    return leftDistance <= aboveDistance &&
                      leftDistance <= aboveLeftDistance
                      ? left
                      : aboveDistance <= aboveLeftDistance
                        ? above
                        : aboveLeft;
                  })();

      row[index] = (row[index] + predictor) & 0xff;
      pixels[y * stride + index] = row[index];
    }

    for (let x = 0; x < width; x += 1) {
      const alpha = row[x * channels + 3];
      if (alpha === 0) {
        transparentPixels += 1;
      } else if (alpha < 255) {
        partialAlphaPixels += 1;
      }
    }
  }

  expect(rawOffset).toBe(raw.length);
  return { transparentPixels, partialAlphaPixels };
}

function icoEntries(filename: string) {
  const bytes = readFileSync(join(publicDir, filename));
  expect(bytes.readUInt16LE(0)).toBe(0);
  expect(bytes.readUInt16LE(2)).toBe(1);

  const count = bytes.readUInt16LE(4);
  return [...Array(count)].map((_, index) => {
    const offset = 6 + index * 16;
    const width = bytes[offset] || 256;
    const height = bytes[offset + 1] || 256;
    const bytesInResource = bytes.readUInt32LE(offset + 8);
    const imageOffset = bytes.readUInt32LE(offset + 12);

    expect(bytes.subarray(imageOffset, imageOffset + 8)).toEqual(pngSignature);
    expect(imageOffset + bytesInResource).toBeLessThanOrEqual(bytes.length);

    return { width, height };
  });
}

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

  it('ships valid transparent PNG derivatives from the supplied source', () => {
    const expectedSizes = {
      'aiworld-icon.png': 1254,
      'icon-16x16.png': 16,
      'icon-32x32.png': 32,
      'apple-touch-icon.png': 180,
      'icon-192x192.png': 192,
      'icon-512x512.png': 512,
      'icon-512-maskable.png': 512,
    } as const;

    for (const [filename, size] of Object.entries(expectedSizes)) {
      expect(existsSync(join(publicDir, filename))).toBe(true);
      expect(readPngMetadata(filename)).toMatchObject({
        width: size,
        height: size,
        bitDepth: 8,
        colorType: 6,
        interlaceMethod: 0,
      });

      const alpha = alphaStats(filename);
      expect(alpha.transparentPixels).toBeGreaterThan(0);
      expect(alpha.partialAlphaPixels).toBeGreaterThan(0);
    }
  });

  it('ships a valid multi-size favicon', () => {
    expect(icoEntries('favicon.ico')).toEqual([
      { width: 16, height: 16 },
      { width: 32, height: 32 },
    ]);
  });
});
