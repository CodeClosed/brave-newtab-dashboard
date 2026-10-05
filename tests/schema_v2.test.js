import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDashboardData, validateDashboardData, CURRENT_SCHEMA_VERSION } from '../extension/js/core/schema.js';
import { migrate } from '../extension/js/core/migrate.js';
import { serializeDashboardExport, parseAndValidateImport } from '../extension/js/features/data-io.js';

test('1.1 Schema: CURRENT_SCHEMA_VERSION is 3 and default document satisfies structure', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 3, 'CURRENT_SCHEMA_VERSION must be 3');

  const doc = createDefaultDashboardData();
  assert.equal(doc.version, 3, 'Default document must have version 3');
  assert.ok(Array.isArray(doc.spaces), 'Document must have spaces array');
  assert.ok(doc.spaces.length >= 1, 'Document must have at least one default space');
  assert.ok(doc.activeSpaceId, 'Document must have an activeSpaceId');
  assert.equal(doc.activeSpaceId, doc.spaces[0].id, 'activeSpaceId must match the first space id');

  // Verify categories have spaceId
  for (const cat of doc.categories) {
    assert.equal(cat.spaceId, doc.activeSpaceId, 'Categories must belong to active space');
    assert.equal(cat.displayMode, null);
    assert.equal(cat.accent, null);
    for (const bm of cat.bookmarks) {
      assert.equal(bm.icon, null);
    }
  }

  // Verify settings has new v2 fields
  assert.equal(doc.settings.palette, 'default');
  assert.equal(doc.settings.motion, 'system');
  assert.equal(doc.settings.cards.style, 'filled');
  assert.equal(doc.settings.behavior.search.filterBookmarks, true);
  assert.equal(doc.settings.background.autoReadability, true);

  const validation = validateDashboardData(doc);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);
});

test('1.1 Migration: migrates v1 document to v2 preserving all categories and bookmarks', () => {
  const v1Doc = {
    version: 1,
    settings: {
      theme: 'dark',
      accent: 'emerald',
      layout: 'compact',
      showClock: true,
      showDate: false,
      showGreeting: true,
      timeFormat: '24h',
      searchEngine: 'duckduckgo',
      background: { type: 'solid', value: '#123456', dim: 0.5 }
    },
    categories: [
      {
        id: 'cat-work',
        name: 'Work',
        icon: '💼',
        order: 0,
        collapsed: false,
        bookmarks: [
          { id: 'bm-1', name: 'Docs', url: 'https://docs.example.com', order: 0 },
          { id: 'bm-2', name: 'Repo', url: 'https://github.com', order: 1 }
        ]
      }
    ]
  };

  const v2Migrated = migrate(v1Doc);
  assert.equal(v2Migrated.version, 3);
  assert.ok(Array.isArray(v2Migrated.spaces));
  assert.equal(v2Migrated.spaces.length, 1);
  assert.equal(v2Migrated.spaces[0].name, 'Home');
  assert.equal(v2Migrated.activeSpaceId, v2Migrated.spaces[0].id);

  // Categories preserved
  assert.equal(v2Migrated.categories.length, 1);
  assert.equal(v2Migrated.categories[0].id, 'cat-work');
  assert.equal(v2Migrated.categories[0].spaceId, v2Migrated.activeSpaceId);
  assert.equal(v2Migrated.categories[0].bookmarks.length, 2);
  assert.equal(v2Migrated.categories[0].bookmarks[0].name, 'Docs');
  assert.equal(v2Migrated.categories[0].bookmarks[1].name, 'Repo');

  // V1 settings preserved
  assert.equal(v2Migrated.settings.theme, 'dark');
  assert.equal(v2Migrated.settings.accent, 'emerald');
  assert.equal(v2Migrated.settings.layout, 'compact');
  assert.equal(v2Migrated.settings.searchEngine, 'duckduckgo');
  assert.equal(v2Migrated.settings.background.value, '#123456');

  // V2 default settings populated
  assert.equal(v2Migrated.settings.palette, 'default');
  assert.equal(v2Migrated.settings.cards.style, 'filled');

  const validation = validateDashboardData(v2Migrated);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);
});

test('1.1 Round-trip: v2 file exports and re-imports identically', () => {
  const original = createDefaultDashboardData();
  const serialized = serializeDashboardExport(original);
  const parsed = parseAndValidateImport(serialized);

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.version, 3);
  assert.equal(parsed.data.activeSpaceId, original.activeSpaceId);
  assert.equal(parsed.data.spaces.length, original.spaces.length);
  assert.equal(parsed.data.categories.length, original.categories.length);
  assert.equal(parsed.data.settings.palette, original.settings.palette);
});
