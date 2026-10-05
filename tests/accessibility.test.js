import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyAccessibilitySettings } from '../extension/js/features/accessibility.js';
import { repairSettings } from '../extension/js/core/migrate.js';
import { createDefaultSettings } from '../extension/js/core/schema.js';

test('7.1 Accessibility: applyAccessibilitySettings applies motion and large targets', () => {
  const attrs = {};
  const classes = new Set();
  const mockRoot = {
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] ?? null; },
    removeAttribute(k) { delete attrs[k]; },
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); }
    }
  };

  // Default settings
  applyAccessibilitySettings({ motion: 'system', largeTargets: false }, mockRoot);
  assert.equal(attrs['data-motion'], 'system');
  assert.equal(attrs['data-large-targets'], 'false');

  // Reduced motion and large targets enabled
  applyAccessibilitySettings({ motion: 'reduce', largeTargets: true }, mockRoot);
  assert.equal(attrs['data-motion'], 'reduce');
  assert.equal(attrs['data-large-targets'], 'true');

  // Invalid fallbacks to system and false
  applyAccessibilitySettings({ motion: 'fast', largeTargets: 'yes' }, mockRoot);
  assert.equal(attrs['data-motion'], 'system');
  assert.equal(attrs['data-large-targets'], 'false');
});

test('7.1 Accessibility Stylesheet: base.css defines reduced motion and 44px touch targets', () => {
  const cssPath = path.resolve('extension/css/base.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(css.includes('data-motion="reduce"'), 'base.css must define rules for data-motion="reduce"');
  assert.ok(css.includes('data-large-targets="true"'), 'base.css must define rules for data-large-targets="true"');
  assert.ok(css.includes('44px'), 'base.css must enforce 44px min-dimensions for large targets');
});

test('7.1 Accessibility Migration: repairs motion and largeTargets settings', () => {
  const defaults = createDefaultSettings();

  const repaired = repairSettings({
    motion: 'reduce',
    largeTargets: true
  });
  assert.equal(repaired.motion, 'reduce');
  assert.equal(repaired.largeTargets, true);

  const fallback = repairSettings({
    motion: 'invalid',
    largeTargets: 'invalid'
  });
  assert.equal(fallback.motion, defaults.motion);
  assert.equal(fallback.largeTargets, defaults.largeTargets);
});

test('7.1 Accessibility Drawer: resetSettingsSection restores accessibility settings', async () => {
  const { store } = await import('../extension/js/core/state.js');
  const { resetSettingsSection } = await import('../extension/js/ui/drawer.js');

  store.updateSettings({
    motion: 'reduce',
    largeTargets: true,
    palette: 'contrast'
  });

  assert.equal(store.get().settings.motion, 'reduce');
  assert.equal(store.get().settings.largeTargets, true);
  assert.equal(store.get().settings.palette, 'contrast');

  resetSettingsSection('accessibility');

  const defaults = createDefaultSettings();
  assert.equal(store.get().settings.motion, defaults.motion);
  assert.equal(store.get().settings.largeTargets, defaults.largeTargets);
  assert.equal(store.get().settings.palette, defaults.palette);
});

