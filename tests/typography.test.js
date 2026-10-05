import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyTypography } from '../extension/js/features/theme.js';
import { repairSettings } from '../extension/js/core/migrate.js';
import { createDefaultSettings } from '../extension/js/core/schema.js';

test('6.2 Typography: applyTypography applies family and clamps scale between 0.9 and 1.3', () => {
  const rootAttrs = {};
  const rootStyles = {};

  const mockRoot = {
    setAttribute(k, v) { rootAttrs[k] = String(v); },
    getAttribute(k) { return rootAttrs[k] ?? null; },
    style: {
      setProperty(k, v) { rootStyles[k] = String(v); },
      getPropertyValue(k) { return rootStyles[k] ?? ''; }
    }
  };

  // Test default system font and scale 1
  applyTypography({ font: { family: 'system', scale: 1.0 } }, mockRoot);
  assert.equal(rootAttrs['data-font'], 'system');
  assert.equal(rootStyles['--font-scale'], '1');

  // Test serif font
  applyTypography({ font: { family: 'serif', scale: 1.15 } }, mockRoot);
  assert.equal(rootAttrs['data-font'], 'serif');
  assert.equal(rootStyles['--font-scale'], '1.15');

  // Test mono font
  applyTypography({ font: { family: 'mono', scale: 1.3 } }, mockRoot);
  assert.equal(rootAttrs['data-font'], 'mono');
  assert.equal(rootStyles['--font-scale'], '1.3');

  // Test alias 'sans' maps to 'system'
  applyTypography({ font: { family: 'sans', scale: 0.95 } }, mockRoot);
  assert.equal(rootAttrs['data-font'], 'system');
  assert.equal(rootStyles['--font-scale'], '0.95');

  // Test invalid family falls back to 'system'
  applyTypography({ font: { family: 'comic-sans', scale: 1 } }, mockRoot);
  assert.equal(rootAttrs['data-font'], 'system');

  // Test scale clamping below 0.9
  applyTypography({ font: { family: 'system', scale: 0.6 } }, mockRoot);
  assert.equal(rootStyles['--font-scale'], '0.9');

  // Test scale clamping above 1.3
  applyTypography({ font: { family: 'system', scale: 1.8 } }, mockRoot);
  assert.equal(rootStyles['--font-scale'], '1.3');
});

test('6.2 Typography Tokens: tokens.css defines sans, serif, and mono stacks with font-scale support', () => {
  const tokensCssPath = path.resolve('extension/css/tokens.css');
  const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8');

  assert.ok(tokensCss.includes('--font-sans'), 'tokens.css must define --font-sans');
  assert.ok(tokensCss.includes('--font-serif'), 'tokens.css must define --font-serif');
  assert.ok(tokensCss.includes('--font-mono'), 'tokens.css must define --font-mono');
  assert.ok(tokensCss.includes('data-font="serif"'), 'tokens.css must handle data-font="serif"');
  assert.ok(tokensCss.includes('data-font="mono"'), 'tokens.css must handle data-font="mono"');
  assert.ok(tokensCss.includes('--font-scale'), 'tokens.css must define --font-scale');
});

test('6.2 Typography Migration: repairs and validates font family and scale', () => {
  const defaults = createDefaultSettings();

  // Valid settings preserved
  const valid = repairSettings({
    font: { family: 'serif', scale: 1.2 }
  });
  assert.equal(valid.font.family, 'serif');
  assert.equal(valid.font.scale, 1.2);

  // Invalid family normalized, out of bounds scale clamped
  const repaired = repairSettings({
    font: { family: 'comic-sans', scale: 2.5 }
  });
  assert.equal(repaired.font.family, defaults.font.family);
  assert.equal(repaired.font.scale, 1.3);

  const lowScale = repairSettings({
    font: { family: 'sans', scale: 0.5 }
  });
  assert.equal(lowScale.font.family, 'system');
  assert.equal(lowScale.font.scale, 0.9);
});
