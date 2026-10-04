import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLuminanceStats,
  calculateAutoReadabilityDim,
  calculatePixelLuminance,
  processWallpaperImage,
  MAX_WALLPAPER_BYTES,
  MAX_WALLPAPER_DIMENSION,
  THUMBNAIL_MAX_DIMENSION
} from '../extension/js/features/wallpaper.js';
import { calculateDownscaleDimensions } from '../extension/js/features/theme.js';

test('5.2 Image processing: calculateDownscaleDimensions scales down longest edge to <= 2560', () => {
  // Landscape 4K
  const landscape = calculateDownscaleDimensions(3840, 2160, MAX_WALLPAPER_DIMENSION);
  assert.equal(landscape.width, 2560);
  assert.equal(landscape.height, 1440);

  // Portrait
  const portrait = calculateDownscaleDimensions(1200, 3600, MAX_WALLPAPER_DIMENSION);
  assert.equal(portrait.width, 853);
  assert.equal(portrait.height, 2560);

  // Already smaller than maxDimension
  const small = calculateDownscaleDimensions(1920, 1080, MAX_WALLPAPER_DIMENSION);
  assert.equal(small.width, 1920);
  assert.equal(small.height, 1080);
});

test('5.2 Image processing: computeLuminanceStats calculates mean, p10, and p90 percentiles', () => {
  // Pure black (all 0s)
  const blackPixels = new Array(1024).fill(0);
  const blackStats = computeLuminanceStats(blackPixels);
  assert.equal(blackStats.mean, 0);
  assert.equal(blackStats.p10, 0);
  assert.equal(blackStats.p90, 0);

  // Pure white (all 1s)
  const whitePixels = new Array(1024).fill(1);
  const whiteStats = computeLuminanceStats(whitePixels);
  assert.equal(whiteStats.mean, 1);
  assert.equal(whiteStats.p10, 1);
  assert.equal(whiteStats.p90, 1);

  // Even distribution from 0.0 to 1.0 (100 values: 0, 0.01, ..., 0.99)
  const linear = [];
  for (let i = 0; i < 100; i++) {
    linear.push(i / 100);
  }
  const linearStats = computeLuminanceStats(linear);
  assert.ok(Math.abs(linearStats.mean - 0.495) < 0.01);
  assert.ok(Math.abs(linearStats.p10 - 0.10) < 0.02);
  assert.ok(Math.abs(linearStats.p90 - 0.90) < 0.02);
});

test('5.2 Image processing: calculatePixelLuminance converts sRGB channels to WCAG relative luminance', () => {
  assert.equal(calculatePixelLuminance(0, 0, 0), 0);
  assert.equal(calculatePixelLuminance(255, 255, 255), 1);
  // Pure green has highest perceptual luminance
  const greenLum = calculatePixelLuminance(0, 255, 0);
  const blueLum = calculatePixelLuminance(0, 0, 255);
  assert.ok(greenLum > blueLum);
});

test('5.2 Image processing: calculateAutoReadabilityDim clamps within [0.15, 0.85] and responds to luminance', () => {
  // Very bright wallpaper in dark mode: needs high dim to preserve text contrast
  const brightDark = calculateAutoReadabilityDim({ p90: 0.95, p10: 0.8, mean: 0.88 }, true);
  assert.ok(brightDark >= 0.75 && brightDark <= 0.85);

  // Dark wallpaper in dark mode: needs minimum dim (0.15)
  const darkDark = calculateAutoReadabilityDim({ p90: 0.12, p10: 0.02, mean: 0.05 }, true);
  assert.equal(darkDark, 0.15);

  // Dark wallpaper in light mode: needs dim to avoid clashing with dark text
  const darkLight = calculateAutoReadabilityDim({ p90: 0.3, p10: 0.02, mean: 0.1 }, false);
  assert.ok(darkLight >= 0.15 && darkLight <= 0.85);

  // Fallback for null luminance data
  const fallbackDark = calculateAutoReadabilityDim(null, true);
  assert.equal(fallbackDark, 0.35);
  const fallbackLight = calculateAutoReadabilityDim(null, false);
  assert.equal(fallbackLight, 0.25);
});

test('5.2 Image processing: processWallpaperImage downscales, compresses, generates thumbnail and luminance stats', async () => {
  // Mock Image and Canvas in globalThis for testing processWallpaperImage
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  const originalURL = globalThis.URL;

  let canvasCreatedCount = 0;
  const mockContext = {
    drawImage: () => {},
    getImageData: () => {
      // 32x32 pixels, each RGBA = 4 bytes -> 1024 * 4 bytes
      const data = new Uint8ClampedArray(32 * 32 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;     // R
        data[i + 1] = 128; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      }
      return { data };
    }
  };

  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        canvasCreatedCount++;
        return {
          width: 0,
          height: 0,
          getContext: () => mockContext,
          toBlob: (cb, type, quality) => {
            // Return mock blob of 500KB
            const mockBlob = { size: 500 * 1024, type: type || 'image/webp' };
            cb(mockBlob);
          },
          toDataURL: (type, quality) => `data:${type || 'image/webp'};base64,mockthumbdata`
        };
      }
      return originalDocument?.createElement?.(tag);
    }
  };

  globalThis.Image = class MockImage {
    constructor() {
      this.width = 4000;
      this.height = 3000;
      setTimeout(() => { if (this.onload) this.onload(); }, 0);
    }
  };

  globalThis.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
  };

  try {
    const mockFile = { name: 'huge-photo.jpg', size: 10 * 1024 * 1024, type: 'image/jpeg' };
    const result = await processWallpaperImage(mockFile);

    assert.ok(result.blob);
    assert.ok(result.blob.size <= MAX_WALLPAPER_BYTES);
    assert.ok(result.thumbnailUrl.startsWith('data:image/webp'));
    assert.ok(result.luminanceData);
    assert.ok(typeof result.luminanceData.mean === 'number');
    assert.ok(typeof result.luminanceData.p10 === 'number');
    assert.ok(typeof result.luminanceData.p90 === 'number');
    assert.equal(result.width, 2560);
    assert.equal(result.height, 1920);
  } finally {
    globalThis.document = originalDocument;
    globalThis.Image = originalImage;
    globalThis.URL = originalURL;
  }
});
