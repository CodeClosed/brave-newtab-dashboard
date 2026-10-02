import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_PALETTE } from '../extension/js/ui/favicons.js';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastWithWhite(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = getRelativeLuminance(r, g, b);
  // White luminance is 1.0
  return (1.0 + 0.05) / (lum + 0.05);
}

function getSaturation(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

test('C1: tile palette uses muted tones that pass contrast with white letter', () => {
  assert.ok(Array.isArray(TILE_PALETTE), 'TILE_PALETTE must be an exported array');
  assert.ok(TILE_PALETTE.length >= 6, 'TILE_PALETTE must contain at least 6 distinct tones');

  // Must not contain previous loud saturated colors
  const forbiddenSaturated = ['#2563eb', '#dc2626', '#7c3aed', '#db2777'];
  for (const forbidden of forbiddenSaturated) {
    assert.ok(
      !TILE_PALETTE.includes(forbidden),
      `TILE_PALETTE must not contain saturated color ${forbidden}`
    );
  }

  // All colors must have low saturation (< 0.45) to match soft-browser design system
  for (const color of TILE_PALETTE) {
    const sat = getSaturation(color);
    assert.ok(
      sat <= 0.45,
      `Color ${color} saturation (${sat.toFixed(2)}) must be <= 0.45 for muted aesthetic`
    );
  }

  // All colors must pass WCAG AA contrast (>= 4.5:1) with white (#ffffff) letter
  for (const color of TILE_PALETTE) {
    const contrast = getContrastWithWhite(color);
    assert.ok(
      contrast >= 4.5,
      `Color ${color} contrast with white (${contrast.toFixed(2)}:1) must be >= 4.5:1`
    );
  }
});
