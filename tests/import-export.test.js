import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeDashboardExport, parseAndValidateImport } from '../extension/js/features/data-io.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('Data IO - Serialize dashboard state to valid JSON', async () => {
  await store.replaceData(createDefaultDashboardData(), true);
  const exported = serializeDashboardExport();

  assert.equal(typeof exported, 'string');
  const parsed = JSON.parse(exported);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.categories.length > 0, true);
});

test('Data IO - Successfully parse and validate clean backup', () => {
  const validJson = serializeDashboardExport();
  const result = parseAndValidateImport(validJson);

  assert.equal(result.success, true);
  assert.equal(result.summary?.categoryCount > 0, true);
  assert.equal(result.summary?.bookmarkCount > 0, true);
  assert.equal(typeof result.data?.version, 'number');
});

test('Data IO - Rejects malformed JSON syntax', () => {
  const result = parseAndValidateImport('{ bad json: true, ');
  assert.equal(result.success, false);
  assert.match(result.error || '', /valid JSON/);
});

test('Data IO - Migrates legacy unversioned backup', () => {
  const legacyBackup = JSON.stringify({
    categories: [
      {
        name: 'Work Links',
        bookmarks: [
          { name: 'Git', url: 'github.com' }
        ]
      }
    ]
  });

  const result = parseAndValidateImport(legacyBackup);
  assert.equal(result.success, true);
  assert.equal(result.data?.version, 1);
  assert.equal(result.data?.categories[0].bookmarks[0].url, 'https://github.com/');
});

test('Data IO - Deduplicates duplicate IDs on import', () => {
  const duplicateIdJson = JSON.stringify({
    version: 1,
    settings: {
      theme: 'dark',
      accent: 'slate',
      layout: 'grid',
      searchEngine: 'google'
    },
    categories: [
      {
        id: 'dup-cat-id',
        name: 'Cat 1',
        icon: '📁',
        order: 0,
        collapsed: false,
        bookmarks: [
          { id: 'dup-bm-id', name: 'Item 1', url: 'https://example.com', order: 0 }
        ]
      },
      {
        id: 'dup-cat-id', // Duplicate
        name: 'Cat 2',
        icon: '📁',
        order: 1,
        collapsed: false,
        bookmarks: [
          { id: 'dup-bm-id', name: 'Item 2', url: 'https://example.org', order: 0 } // Duplicate
        ]
      }
    ]
  });

  const result = parseAndValidateImport(duplicateIdJson);
  assert.equal(result.success, true);
  // Verify IDs were assigned unique values
  const cat0 = result.data?.categories[0];
  const cat1 = result.data?.categories[1];
  assert.notEqual(cat0?.id, cat1?.id);
  assert.notEqual(cat0?.bookmarks[0].id, cat1?.bookmarks[0].id);
});

test('Data IO - Strips dangerous URLs on import', () => {
  const dangerousJson = JSON.stringify({
    version: 1,
    settings: { theme: 'system', accent: 'slate', layout: 'grid', searchEngine: 'google' },
    categories: [
      {
        id: 'cat-x',
        name: 'Untrusted Links',
        bookmarks: [
          { id: 'b1', name: 'Safe Link', url: 'https://trusted.com' },
          { id: 'b2', name: 'XSS Attack', url: 'javascript:alert(document.cookie)' },
          { id: 'b3', name: 'Data URI', url: 'data:text/html,<script>evil()</script>' }
        ]
      }
    ]
  });

  const result = parseAndValidateImport(dangerousJson);
  assert.equal(result.success, true);
  const cat = result.data?.categories[0];
  // Only the safe link should be imported
  assert.equal(cat?.bookmarks.length, 1);
  assert.equal(cat?.bookmarks[0].name, 'Safe Link');
});
