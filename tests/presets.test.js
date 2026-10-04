import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_PRESETS,
  validatePreset,
  applyThemePreset,
  exportPresetToJson,
  importPresetFromJson
} from '../extension/js/features/presets.js';

test('4.5 Theme presets: 5 curated presets defined with valid properties', () => {
  assert.equal(THEME_PRESETS.length, 5, 'Must have exactly 5 curated presets');

  const names = THEME_PRESETS.map(p => p.name);
  assert.ok(names.includes('Default'));
  assert.ok(names.includes('Warm paper'));
  assert.ok(names.includes('Forest'));
  assert.ok(names.includes('Midnight'));
  assert.ok(names.includes('High contrast'));

  for (const preset of THEME_PRESETS) {
    assert.ok(preset.id);
    assert.ok(preset.name);
    assert.ok(preset.settings);
    const validation = validatePreset(preset);
    assert.equal(validation.valid, true, `Preset "${preset.name}" must be valid: ${validation.error}`);
  }
});

test('4.5 Theme presets: validatePreset rejects invalid or malicious presets', () => {
  assert.equal(validatePreset(null).valid, false);
  assert.equal(validatePreset({}).valid, false);
  assert.equal(validatePreset({ name: 'Bad', settings: { theme: 'neon' } }).valid, false);
  assert.equal(validatePreset({
    name: 'XSS',
    settings: {
      background: { type: 'solid', value: 'url(https://evil.com)' }
    }
  }).valid, false);
});

test('4.5 Theme presets: applyThemePreset updates store settings and provides working undo', () => {
  let currentSettings = {
    theme: 'light',
    palette: 'paper',
    accent: 'amber',
    cards: { style: 'filled' },
    background: { type: 'none' }
  };

  const mockStore = {
    get() {
      return { settings: JSON.parse(JSON.stringify(currentSettings)) };
    },
    updateSettings(patch) {
      currentSettings = { ...currentSettings, ...patch };
    }
  };

  // Apply Midnight preset
  const res = applyThemePreset('midnight', mockStore);
  assert.equal(res.success, true);
  assert.equal(currentSettings.theme, 'dark');
  assert.equal(currentSettings.palette, 'amoled');
  assert.equal(currentSettings.accent, 'blue');
  assert.ok(typeof res.undo === 'function');

  // Trigger Undo
  res.undo();
  assert.equal(currentSettings.theme, 'light');
  assert.equal(currentSettings.palette, 'paper');
  assert.equal(currentSettings.accent, 'amber');
});

test('4.5 Theme presets: export and import round-trip preset JSON', () => {
  const original = THEME_PRESETS[1]; // Warm paper
  const exportedJson = exportPresetToJson(original.id);
  assert.ok(exportedJson.length > 0);

  const imported = importPresetFromJson(exportedJson);
  assert.equal(imported.success, true);
  assert.equal(imported.preset.name, original.name);
  assert.equal(imported.preset.settings.palette, 'paper');
});
