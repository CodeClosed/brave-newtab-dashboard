import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultSettings } from '../extension/js/core/schema.js';
import { repairSettings } from '../extension/js/core/migrate.js';
import {
  calculateRelativeLuminance,
  calculateContrastRatio,
  validateAccentContrast,
  suggestAccessibleShade,
  applyThemeAndAccent
} from '../extension/js/features/theme.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('4.4 Themes & Accent: calculateContrastRatio computes accurate WCAG relative luminance and ratios', () => {
  const blackLum = calculateRelativeLuminance('#000000');
  const whiteLum = calculateRelativeLuminance('#ffffff');
  assert.equal(blackLum, 0);
  assert.equal(whiteLum, 1);

  const blackWhiteRatio = calculateContrastRatio('#000000', '#ffffff');
  assert.equal(Math.round(blackWhiteRatio), 21);

  const sameRatio = calculateContrastRatio('#1b1e22', '#1b1e22');
  assert.equal(sameRatio, 1);
});

test('4.4 Themes & Accent: validateAccentContrast validates and rejects low-contrast custom accents', () => {
  // Light mode (surface ~ #ffffff)
  // Low contrast: light yellow or near-white fails
  const lightFail = validateAccentContrast('#ffff88', false);
  assert.equal(lightFail.valid, false, 'Light yellow should fail contrast against light background');
  assert.ok(lightFail.ratio < 3.0);
  assert.ok(lightFail.suggestedHex, 'Should provide accessible shade suggestion');

  // Dark mode (surface ~ #1b1e22)
  // Low contrast: near-black fails
  const darkFail = validateAccentContrast('#15181a', true);
  assert.equal(darkFail.valid, false, 'Near black should fail contrast against dark background');
  assert.ok(darkFail.ratio < 3.0);
  assert.ok(darkFail.suggestedHex, 'Should provide accessible shade suggestion');

  // High contrast valid accents
  const lightPass = validateAccentContrast('#2563eb', false);
  assert.equal(lightPass.valid, true, 'Blue should pass in light mode');
  assert.ok(lightPass.ratio >= 3.0);

  const darkPass = validateAccentContrast('#38bdf8', true);
  assert.equal(darkPass.valid, true, 'Sky blue should pass in dark mode');
  assert.ok(darkPass.ratio >= 3.0);
});

test('4.4 Themes & Accent: suggestAccessibleShade adjusts failing hex to meet WCAG AA threshold', () => {
  // Suggest for light background
  const suggestedLight = suggestAccessibleShade('#ffff88', '#ffffff', 3.0);
  const checkLight = calculateContrastRatio(suggestedLight, '#ffffff');
  assert.ok(checkLight >= 3.0, `Suggested shade ${suggestedLight} should have contrast >= 3.0 (got ${checkLight})`);

  // Suggest for dark background
  const suggestedDark = suggestAccessibleShade('#15181a', '#1b1e22', 3.0);
  const checkDark = calculateContrastRatio(suggestedDark, '#1b1e22');
  assert.ok(checkDark >= 3.0, `Suggested shade ${suggestedDark} should have contrast >= 3.0 (got ${checkDark})`);
});

test('4.4 Themes & Accent: repairSettings handles palette and validated custom accent', () => {
  // Palettes
  for (const pal of ['default', 'amoled', 'paper', 'contrast']) {
    assert.equal(repairSettings({ palette: pal }).palette, pal);
  }
  assert.equal(repairSettings({ palette: 'neon-cyberpunk' }).palette, 'default');

  // Valid custom accent
  const customSettings = repairSettings({
    accent: 'custom',
    accentCustom: '#2563eb'
  });
  assert.equal(customSettings.accent, 'custom');
  assert.equal(customSettings.accentCustom, '#2563eb');

  // Invalid custom hex reverts to default accent
  const invalidCustom = repairSettings({
    accent: 'custom',
    accentCustom: 'not-a-color'
  });
  assert.equal(invalidCustom.accent, 'slate');
  assert.equal(invalidCustom.accentCustom, null);
});

test('4.4 Themes & Accent: applyThemeAndAccent sets root attributes and custom accent variables', () => {
  const attributes = {};
  const styles = {};

  const mockRoot = {
    style: {
      setProperty(k, v) { styles[k] = String(v); },
      removeProperty(k) { delete styles[k]; }
    },
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return attributes[k]; },
    classList: {
      add() {},
      remove() {}
    }
  };

  applyThemeAndAccent({
    theme: 'dark',
    palette: 'amoled',
    accent: 'custom',
    accentCustom: '#3b82f6'
  }, mockRoot);

  assert.equal(attributes['data-theme'], 'dark');
  assert.equal(attributes['data-palette'], 'amoled');
  assert.equal(attributes['data-accent'], 'custom');
  assert.equal(styles['--accent-base'], '#3b82f6');
  assert.ok(styles['--accent-text']);
});

test('4.4 Themes & Accent: tokens.css defines styles for amoled, paper, and contrast palettes', () => {
  const tokensCss = fs.readFileSync(path.join(__dirname, '../extension/css/tokens.css'), 'utf8');

  assert.match(tokensCss, /\[data-palette="amoled"\]/);
  assert.match(tokensCss, /\[data-palette="paper"\]/);
  assert.match(tokensCss, /\[data-palette="contrast"\]/);
});
