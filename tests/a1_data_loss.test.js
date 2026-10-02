import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../extension/js/core/migrate.js';
import { parseAndValidateImport } from '../extension/js/features/data-io.js';
import { loadDashboardData } from '../extension/js/core/storage.js';

test('A1: invalid theme in settings keeps user categories (does not return seed data)', () => {
  const customData = {
    version: 1,
    settings: {
      theme: 'purple', // invalid theme
      accent: 'slate',
      layout: 'grid',
      searchEngine: 'google',
      timeFormat: '12h',
      showClock: true,
      showDate: true,
      showGreeting: true
    },
    categories: [
      {
        id: 'cat-unique-1',
        name: 'My Special Work',
        icon: '💼',
        order: 0,
        collapsed: false,
        bookmarks: [
          { id: 'b1', name: 'Work App', url: 'https://work.example.com', order: 0 }
        ]
      }
    ]
  };

  const migrated = migrate(customData);
  assert.equal(migrated.categories.length, 1);
  assert.equal(migrated.categories[0].name, 'My Special Work');
  assert.equal(migrated.settings.theme, 'system', 'Clamps invalid theme to system default');
});

test('A1: missing accent in settings keeps user categories', () => {
  const customData = {
    version: 1,
    settings: {
      theme: 'dark'
      // missing accent, layout, searchEngine, etc.
    },
    categories: [
      {
        id: 'cat-unique-2',
        name: 'My Personal Notes',
        icon: '📝',
        order: 0,
        collapsed: false,
        bookmarks: []
      }
    ]
  };

  const migrated = migrate(customData);
  assert.equal(migrated.categories.length, 1);
  assert.equal(migrated.categories[0].name, 'My Personal Notes');
  assert.equal(migrated.settings.accent, 'slate', 'Provides default accent');
});

test('A1: v1 backup without settings imports its own categories (never seed data)', () => {
  const jsonWithoutSettings = JSON.stringify({
    version: 1,
    categories: [
      {
        id: 'c1',
        name: 'Imported No Settings',
        icon: '📁',
        order: 0,
        collapsed: false,
        bookmarks: [
          { id: 'b1', name: 'Site', url: 'https://example.com', order: 0 }
        ]
      }
    ]
  });

  const result = parseAndValidateImport(jsonWithoutSettings);
  assert.equal(result.success, true);
  assert.equal(result.data?.categories.length, 1);
  assert.equal(result.data?.categories[0].name, 'Imported No Settings');
  assert.equal(result.data?.settings?.theme, 'system');
});

test('A1: import of a non-backup JSON file fails with a clear message', () => {
  const nonBackupJson = JSON.stringify({
    title: 'Some other config',
    items: [1, 2, 3]
  });

  const result = parseAndValidateImport(nonBackupJson);
  assert.equal(result.success, false);
  assert.match(result.error || '', /categories/i);
});

test('A1: import preview reports skipped-URL count for invalid URLs', () => {
  const backupWithBadUrls = JSON.stringify({
    version: 1,
    categories: [
      {
        id: 'c1',
        name: 'Mixed Links',
        bookmarks: [
          { id: 'b1', name: 'Good', url: 'https://good.com' },
          { id: 'b2', name: 'Bad 1', url: 'javascript:alert(1)' },
          { id: 'b3', name: 'Bad 2', url: 'data:text/html,bad' },
          { id: 'b4', name: 'Bad 3', url: 'not a url' }
        ]
      }
    ]
  });

  const result = parseAndValidateImport(backupWithBadUrls);
  assert.equal(result.success, true);
  assert.equal(result.summary?.categoryCount, 1);
  assert.equal(result.summary?.bookmarkCount, 1);
  assert.equal(result.summary?.skippedBookmarksCount, 3);
});

test('A1: unreadable stored data leaves a recovery copy and does not overwrite storage', async () => {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => mem.get(k) || null,
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  };

  const unreadablePayload = JSON.stringify({ categories: 'not-an-array' });
  globalThis.localStorage.setItem('dashboard', unreadablePayload);

  const loaded = await loadDashboardData();
  // Must have kept a recovery copy in localStorage under dashboard:recovery
  const recoveryRaw = globalThis.localStorage.getItem('dashboard:recovery');
  assert.notEqual(recoveryRaw, null, 'Recovery copy must be kept');
  assert.equal(recoveryRaw, unreadablePayload);

  // Must not have overwritten the corrupt dashboard data with defaults
  const currentStored = globalThis.localStorage.getItem('dashboard');
  assert.equal(currentStored, unreadablePayload, 'Must not overwrite storage with defaults');
});

test('A1: stored version higher than schema version keeps recovery copy, loads best-effort, does not downgrade', async () => {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => mem.get(k) || null,
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  };

  const futurePayload = {
    version: 99,
    settings: { theme: 'dark' },
    categories: [
      { id: 'c1', name: 'Future Cat', bookmarks: [] }
    ]
  };
  globalThis.localStorage.setItem('dashboard', JSON.stringify(futurePayload));

  const loaded = await loadDashboardData();
  assert.equal(loaded.version, 99, 'Must not downgrade version');
  assert.equal(loaded.categories[0].name, 'Future Cat');
  const recoveryRaw = globalThis.localStorage.getItem('dashboard:recovery');
  assert.notEqual(recoveryRaw, null, 'Recovery copy must be kept');
  const currentStored = globalThis.localStorage.getItem('dashboard');
  assert.equal(JSON.parse(currentStored).version, 99, 'Must not overwrite/downgrade stored version');
});

