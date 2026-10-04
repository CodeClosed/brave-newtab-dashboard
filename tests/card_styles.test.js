import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultSettings } from '../extension/js/core/schema.js';
import { repairSettings } from '../extension/js/core/migrate.js';
import { applyCardSettings } from '../extension/js/features/cards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('4.1 Card styles: schema defaults and repairSettings support filled, frosted, outline, minimal', () => {
  const defaults = createDefaultSettings();
  assert.equal(defaults.cards.style, 'filled');
  assert.equal(defaults.cards.translucent, false);
  assert.equal(defaults.cards.equalHeight, true);

  // Valid styles
  for (const style of ['filled', 'frosted', 'outline', 'minimal']) {
    const repaired = repairSettings({ cards: { style } });
    assert.equal(repaired.cards.style, style, `Style "${style}" should be accepted`);
  }

  // Aliases for backwards compatibility
  assert.equal(repairSettings({ cards: { style: 'outlined' } }).cards.style, 'outline');
  assert.equal(repairSettings({ cards: { style: 'subtle' } }).cards.style, 'minimal');

  // Invalid style falls back to filled
  assert.equal(repairSettings({ cards: { style: 'invalid-neon-glow' } }).cards.style, 'filled');

  // Translucent and equalHeight toggles
  const repairedToggles = repairSettings({ cards: { translucent: true, equalHeight: false } });
  assert.equal(repairedToggles.cards.translucent, true);
  assert.equal(repairedToggles.cards.equalHeight, false);
});

test('4.1 Card styles: applyCardSettings sets data attributes on root element', () => {
  const mockRoot = {
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; }
  };

  applyCardSettings({
    cards: {
      style: 'frosted',
      translucent: true,
      equalHeight: false
    }
  }, mockRoot);

  assert.equal(mockRoot.getAttribute('data-card-style'), 'frosted');
  assert.equal(mockRoot.getAttribute('data-card-translucent'), 'true');
  assert.equal(mockRoot.getAttribute('data-equal-height'), 'false');
});

test('4.1 Card styles: stylesheet defines CSS rules for card styles, translucent, equal-height and reduced-transparency', () => {
  const cardsCss = fs.readFileSync(path.join(__dirname, '../extension/css/components/cards.css'), 'utf8');
  const baseCss = fs.readFileSync(path.join(__dirname, '../extension/css/base.css'), 'utf8');
  const combined = cardsCss + '\n' + baseCss;

  assert.match(combined, /\[data-card-style="filled"\]/);
  assert.match(combined, /\[data-card-style="frosted"\]/);
  assert.match(combined, /\[data-card-style="outline"\]/);
  assert.match(combined, /\[data-card-style="minimal"\]/);
  assert.match(combined, /\[data-card-translucent="true"\]/);
  assert.match(combined, /\[data-equal-height="true"\]/);
  assert.match(combined, /\[data-equal-height="false"\]/);
  assert.match(combined, /prefers-reduced-transparency/);
});
