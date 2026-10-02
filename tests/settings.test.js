import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { SEARCH_ENGINES } from '../extension/js/features/search.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('Settings - Search engine mappings', () => {
  assert.equal(SEARCH_ENGINES.google.url, 'https://www.google.com/search');
  assert.equal(SEARCH_ENGINES.google.param, 'q');

  assert.equal(SEARCH_ENGINES.brave.url, 'https://search.brave.com/search');
  assert.equal(SEARCH_ENGINES.duckduckgo.url, 'https://duckduckgo.com/');
  assert.equal(SEARCH_ENGINES.bing.url, 'https://www.bing.com/search');
});

test('Settings - Update appearance settings', async () => {
  await store.replaceData(createDefaultDashboardData(), true);

  store.updateSettings({
    theme: 'light',
    accent: 'emerald',
    layout: 'compact'
  });

  const settings = store.get().settings;
  assert.equal(settings.theme, 'light');
  assert.equal(settings.accent, 'emerald');
  assert.equal(settings.layout, 'compact');
});

test('Settings - Update clock & search preferences', () => {
  store.updateSettings({
    showClock: false,
    showDate: true,
    showGreeting: false,
    timeFormat: '24h',
    searchEngine: 'brave'
  });

  const settings = store.get().settings;
  assert.equal(settings.showClock, false);
  assert.equal(settings.showDate, true);
  assert.equal(settings.showGreeting, false);
  assert.equal(settings.timeFormat, '24h');
  assert.equal(settings.searchEngine, 'brave');
});
