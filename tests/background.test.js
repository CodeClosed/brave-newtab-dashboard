import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDownscaleDimensions } from '../extension/js/features/theme.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('Background - Dimensions within max limit are unchanged', () => {
  const result = calculateDownscaleDimensions(1920, 1080, 2560);
  assert.equal(result.width, 1920);
  assert.equal(result.height, 1080);
});

test('Background - Dimensions exceeding max limit are scaled proportionally', () => {
  // Ultra-wide 5120x2160
  const result = calculateDownscaleDimensions(5120, 2160, 2560);
  assert.equal(result.width, 2560);
  assert.equal(result.height, 1080);
});

test('Background - Square large images are scaled', () => {
  const result = calculateDownscaleDimensions(4000, 4000, 2000);
  assert.equal(result.width, 2000);
  assert.equal(result.height, 2000);
});

test('Background - Settings mutation handles solid, gradient, and image types', async () => {
  await store.replaceData(createDefaultDashboardData(), true);

  // Solid
  store.updateSettings({
    background: { type: 'solid', value: '#123456', dim: 0.2 }
  });
  assert.equal(store.get().settings.background.type, 'solid');
  assert.equal(store.get().settings.background.value, '#123456');

  // Gradient
  store.updateSettings({
    background: { type: 'gradient', value: 'linear-gradient(...)', dim: 0.4 }
  });
  assert.equal(store.get().settings.background.type, 'gradient');

  // Image
  store.updateSettings({
    background: { type: 'image', value: 'custom_wallpaper', dim: 0.5 }
  });
  assert.equal(store.get().settings.background.type, 'image');
  assert.equal(store.get().settings.background.dim, 0.5);
});
