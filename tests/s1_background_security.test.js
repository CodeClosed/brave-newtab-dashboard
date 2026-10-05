import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDefaultDashboardData, validateDashboardData } from '../extension/js/core/schema.js';
import { migrate } from '../extension/js/core/migrate.js';
import { applyBackground, _resetBackgroundStateForTests } from '../extension/js/features/theme.js';

test('S1: validateDashboardData rejects background with url(...) payload', () => {
  const data = createDefaultDashboardData();
  data.settings.background = {
    type: 'solid',
    value: 'url("https://malicious.example.com/leak.png")',
    dim: 0.35
  };

  const validation = validateDashboardData(data);
  assert.equal(validation.valid, false, 'Should reject background containing url()');
  assert.match(validation.errors.join(' '), /background/i);
});

test('S1: migrate resets malicious background containing url(...) to safe default', () => {
  const maliciousDoc = {
    version: 1,
    settings: {
      theme: 'dark',
      background: {
        type: 'gradient',
        value: 'linear-gradient(to right, #000, #fff), url("https://evil.com/ping")',
        dim: 0.35
      }
    },
    categories: [
      { id: 'cat-1', name: 'Safe Cat', order: 0, bookmarks: [] }
    ]
  };

  const migrated = migrate(maliciousDoc);
  assert.notEqual(migrated.settings.background.value, maliciousDoc.settings.background.value);
  assert.ok(!JSON.stringify(migrated.settings.background).includes('evil.com'));
});

test('S1: applyBackground never applies a background containing url(...) from settings', async () => {
  _resetBackgroundStateForTests();
  const mockOverlay = {
    style: {
      backgroundImage: '',
      backgroundColor: '',
      opacity: ''
    }
  };

  globalThis.document = {
    getElementById: (id) => id === 'bg-overlay' ? mockOverlay : null
  };

  // Attempt to apply solid background with url payload
  await applyBackground({
    type: 'solid',
    value: 'url("https://evil.com/beacon.png")',
    dim: 0.35
  }, true);

  assert.ok(
    !mockOverlay.style.backgroundImage.includes('evil.com'),
    'applyBackground must never inject remote url into backgroundImage'
  );
  assert.ok(
    !mockOverlay.style.backgroundColor.includes('evil.com'),
    'applyBackground must never inject remote url into backgroundColor'
  );

  delete globalThis.document;
});

test('S1: manifest.json defines explicit extension_pages CSP', () => {
  const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf-8'));
  assert.ok(manifest.content_security_policy, 'manifest must declare content_security_policy');
  assert.ok(
    manifest.content_security_policy.extension_pages,
    'manifest must define content_security_policy.extension_pages'
  );

  const csp = manifest.content_security_policy.extension_pages;
  assert.ok(csp.includes("default-src 'self'"), 'CSP must restrict default-src to self');
  assert.ok(csp.includes("frame-src 'none'"), 'CSP must restrict frame-src to none');
  assert.ok(csp.includes("object-src 'self'"), 'CSP must restrict object-src');
  assert.ok(csp.includes("connect-src 'self' https://api.open-meteo.com"), 'CSP must allow Open-Meteo connect-src');
});
