import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VALID_CARD_STYLES, applyCardSettings } from '../extension/js/features/cards.js';
import { applyBackground, _resetBackgroundStateForTests } from '../extension/js/features/theme.js';

test('8.2 Glass tokens: tokens.css defines complete Glass v2 token set', () => {
  const css = fs.readFileSync('extension/css/tokens.css', 'utf-8');

  assert.ok(css.includes('--glass-bg:'), 'Must define --glass-bg');
  assert.ok(css.includes('--glass-border:'), 'Must define --glass-border');
  assert.ok(css.includes('--glass-blur:'), 'Must define --glass-blur');
  assert.ok(css.includes('--glass-radius: 16px'), 'Must define --glass-radius: 16px');
  assert.ok(css.includes('--glass-shadow:'), 'Must define --glass-shadow');
  assert.ok(css.includes('--glass-highlight:'), 'Must define --glass-highlight');
  assert.ok(css.includes('--hero-clock-size:'), 'Must define --hero-clock-size');

  // Dark mode overrides
  assert.ok(css.includes(':root[data-theme="dark"]') || css.includes(':root.dark'), 'Must define dark mode glass tokens');
  assert.ok(css.includes('rgba(18, 21, 26,'), 'Must use dark glass background token');

  // Fallback when no image/gradient is present
  assert.ok(css.includes(':root:not([data-bg="image"]):not([data-bg="gradient"])'), 'Must define fallback when no wallpaper');
  assert.ok(css.includes('prefers-reduced-transparency: reduce'), 'Must handle prefers-reduced-transparency');
});

test('8.2 Glass Card Styles: cards.css defines glass card styling and reduced transparency fallback', () => {
  const css = fs.readFileSync('extension/css/components/cards.css', 'utf-8');

  assert.ok(css.includes(':root[data-card-style="glass"] .category-card'), 'Must style glass cards');
  assert.ok(css.includes('backdrop-filter: var(--glass-blur)'), 'Must apply glass blur');
  assert.ok(css.includes('-webkit-backdrop-filter: var(--glass-blur)'), 'Must apply webkit backdrop-filter');
  assert.ok(css.includes('border: 1px solid var(--glass-border)'), 'Must apply specular glass border');
  assert.ok(css.includes(':root[data-card-style="glass"] .category-card:hover'), 'Must have hover highlight');
});

test('8.2 Cards Feature: VALID_CARD_STYLES includes "glass" and applyCardSettings applies attribute', () => {
  assert.ok(VALID_CARD_STYLES.includes('glass'), 'VALID_CARD_STYLES must include "glass"');

  const attributes = {};
  const mockRoot = {
    setAttribute: (key, val) => { attributes[key] = val; }
  };

  applyCardSettings({ cards: { style: 'glass', translucent: false, equalHeight: true } }, mockRoot);
  assert.equal(attributes['data-card-style'], 'glass');
});

test('8.2 data-bg root attribute: applyBackground sets data-bg attribute on document.documentElement', async () => {
  const rootAttrs = {};
  const overlayStyle = { backgroundImage: '', backgroundColor: '', opacity: '0', filter: 'none' };

  globalThis.document = {
    documentElement: {
      setAttribute: (k, v) => { rootAttrs[k] = v; },
      getAttribute: (k) => rootAttrs[k] || null
    },
    getElementById: (id) => (id === 'bg-overlay' ? { style: overlayStyle } : null)
  };

  try {
    if (_resetBackgroundStateForTests) _resetBackgroundStateForTests();

    // 1. Solid background
    await applyBackground({ type: 'solid', value: '#334155', dim: 0.2 }, true);
    assert.equal(rootAttrs['data-bg'], 'solid');

    // 2. Gradient background
    await applyBackground({ type: 'gradient', value: { from: '#0f172a', to: '#1e293b', angle: 135 }, dim: 0.2 }, true);
    assert.equal(rootAttrs['data-bg'], 'gradient');

    // 3. None
    await applyBackground({ type: 'none', value: null, dim: 0.35 }, true);
    assert.equal(rootAttrs['data-bg'], 'none');
  } finally {
    delete globalThis.document;
  }
});
