import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDashboardData, createDefaultSettings } from '../extension/js/core/schema.js';
import { store } from '../extension/js/core/state.js';
import {
  openDrawer,
  closeDrawer,
  filterSettingsByQuery,
  resetSettingsSection,
  _getOpeningSnapshotForTests
} from '../extension/js/ui/drawer.js';

beforeEach(async () => {
  // Mock minimal DOM for drawer tests
  globalThis.document = {
    body: {
      appendChild: () => {},
      contains: () => true
    },
    documentElement: {
      classList: { add: () => {}, remove: () => {} },
      setAttribute: () => {}
    },
    activeElement: null,
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        attributes: {},
        children: [],
        open: false,
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k],
        appendChild: (c) => { el.children.push(c); return c; },
        addEventListener: () => {},
        classList: {
          add: (c) => { el.className += ` ${c}`; },
          remove: (c) => { el.className = el.className.replace(c, '').trim(); }
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        showModal: () => { el.open = true; },
        close: () => { el.open = false; }
      };
      return el;
    }
  };

  await store.replaceData(createDefaultDashboardData(), true);
});

afterEach(() => {
  delete globalThis.document;
});

test('1.3 Settings Plumbing: live preview applies changes, and Cancel reverts to opening state', () => {
  // Start with default theme 'system'
  store.updateSettings({ theme: 'system', accent: 'slate' });
  assert.equal(store.get().settings.theme, 'system');

  // Open drawer -> records opening snapshot
  openDrawer('appearance');
  const snap = _getOpeningSnapshotForTests();
  assert.equal(snap.settings.theme, 'system');

  // User changes theme to 'dark' and accent to 'emerald' (live preview)
  store.updateSettings({ theme: 'dark', accent: 'emerald' });
  assert.equal(store.get().settings.theme, 'dark');
  assert.equal(store.get().settings.accent, 'emerald');

  // User cancels -> reverts to opening state
  closeDrawer(true);
  assert.equal(store.get().settings.theme, 'system');
  assert.equal(store.get().settings.accent, 'slate');
});

test('1.3 Settings Plumbing: Done / save keeps live preview changes', () => {
  store.updateSettings({ theme: 'system', accent: 'slate' });
  openDrawer('appearance');

  store.updateSettings({ theme: 'dark', accent: 'rose' });
  assert.equal(store.get().settings.accent, 'rose');

  // User finishes with Done (revert = false)
  closeDrawer(false);
  assert.equal(store.get().settings.theme, 'dark');
  assert.equal(store.get().settings.accent, 'rose');
});

test('1.3 Settings Plumbing: resetSettingsSection resets only the target section', () => {
  // Mutate appearance and clock
  store.updateSettings({
    theme: 'dark',
    accent: 'rose',
    timeFormat: '24h',
    showDate: false
  });

  assert.equal(store.get().settings.theme, 'dark');
  assert.equal(store.get().settings.timeFormat, '24h');

  // Reset only 'appearance'
  resetSettingsSection('appearance');

  const current = store.get().settings;
  const defaults = createDefaultSettings();
  // Appearance fields restored
  assert.equal(current.theme, defaults.theme);
  assert.equal(current.accent, defaults.accent);
  // Clock fields remain customized
  assert.equal(current.timeFormat, '24h');
  assert.equal(current.showDate, false);

  // Now reset 'clock'
  resetSettingsSection('clock');
  assert.equal(store.get().settings.timeFormat, defaults.timeFormat);
  assert.equal(store.get().settings.showDate, defaults.showDate);
});

test('1.3 Settings Plumbing: filterSettingsByQuery matches setting titles and hints', () => {
  const appearanceMatches = filterSettingsByQuery('dark');
  assert.ok(appearanceMatches.some(m => m.id === 'theme' || m.section === 'appearance'));

  const clockMatches = filterSettingsByQuery('24-hour');
  assert.ok(clockMatches.some(m => m.section === 'clock'));

  const emptyMatches = filterSettingsByQuery('xyz-nonexistent-query-12345');
  assert.equal(emptyMatches.length, 0);
});
