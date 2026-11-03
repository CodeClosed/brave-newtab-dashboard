import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDashboardData, generateId, CURRENT_SCHEMA_VERSION } from '../extension/js/core/schema.js';
import { migrate } from '../extension/js/core/migrate.js';
import { serializeDashboardExport, parseAndValidateImport } from '../extension/js/features/data-io.js';

/**
 * Creates a fixture dataset with 12 categories and 150 bookmarks.
 */
function createHeavyFixture() {
  const categories = [];
  let totalBookmarks = 0;

  for (let c = 0; c < 12; c++) {
    const bookmarks = [];
    // 12 to 13 bookmarks per category for a total of 150
    const count = c < 6 ? 13 : 12;
    for (let b = 0; b < count; b++) {
      totalBookmarks++;
      bookmarks.push({
        id: generateId(),
        name: `Resource ${totalBookmarks}`,
        url: `https://site${totalBookmarks}.example.com/docs`,
        order: b
      });
    }

    categories.push({
      id: generateId(),
      name: `Category Collection ${c + 1}`,
      icon: '📁',
      order: c,
      collapsed: false,
      bookmarks
    });
  }

  return {
    version: 1,
    settings: {
      theme: 'dark',
      accent: 'slate',
      layout: 'grid',
      showClock: true,
      showDate: true,
      showGreeting: true,
      timeFormat: '12h',
      searchEngine: 'google',
      background: { type: 'none', value: null, dim: 0.35 }
    },
    categories
  };
}

test('Benchmark - 12 categories & 150 bookmarks validation and processing under budget', () => {
  const fixture = createHeavyFixture();
  assert.equal(fixture.categories.length, 12);
  const totalItems = fixture.categories.reduce((acc, c) => acc + c.bookmarks.length, 0);
  assert.equal(totalItems, 150);

  // Measure validation speed
  const t0 = performance.now();
  const validation = validateDashboardData(fixture);
  const valDuration = performance.now() - t0;
  assert.equal(validation.valid, true);
  assert.equal(valDuration < 25, true, `Validation took ${valDuration}ms (expected < 25ms)`);

  // Measure migration runner speed
  const t1 = performance.now();
  const migrated = migrate(fixture);
  const migDuration = performance.now() - t1;
  assert.equal(migrated.version, CURRENT_SCHEMA_VERSION);
  assert.equal(migDuration < 25, true, `Migration took ${migDuration}ms (expected < 25ms)`);

  // Measure serialization and export parsing speed
  const t2 = performance.now();
  const jsonStr = JSON.stringify(fixture);
  const importResult = parseAndValidateImport(jsonStr);
  const importDuration = performance.now() - t2;
  assert.equal(importResult.success, true);
  assert.equal(importResult.summary?.categoryCount, 12);
  assert.equal(importResult.summary?.bookmarkCount, 150);
  assert.equal(importDuration < 40, true, `Import parse took ${importDuration}ms (expected < 40ms)`);
});

import { matchAndRankBookmarks } from '../extension/js/features/search.js';

test('Benchmark - 1,000 & 5,000 bookmarks search ranking and throughput under budget', () => {
  // Generate 50 categories with 100 bookmarks each = 5,000 bookmarks
  const largeCategories = [];
  let idCounter = 0;
  for (let c = 0; c < 50; c++) {
    const bms = [];
    for (let b = 0; b < 100; b++) {
      idCounter++;
      bms.push({
        id: 'bm_' + idCounter,
        name: `Resource Developer Docs ${idCounter} ${b % 2 === 0 ? 'React GitHub' : 'TypeScript Node'}`,
        url: `https://devdocs${idCounter}.example.org/api/ref`,
        order: b
      });
    }
    largeCategories.push({
      id: 'cat_' + c,
      name: `Collection ${c}`,
      icon: '📁',
      order: c,
      collapsed: false,
      bookmarks: bms
    });
  }

  // 1. Benchmark 1,000 bookmarks search (first 10 categories)
  const subset1000 = largeCategories.slice(0, 10);
  const t0 = performance.now();
  for (let q = 0; q < 5; q++) {
    const results = matchAndRankBookmarks('React GitHub', subset1000);
    assert.ok(results.length > 0);
  }
  const dur1000 = (performance.now() - t0) / 5;
  // Searching 1,000 bookmarks must complete within 15ms per search query
  assert.ok(dur1000 < 15, `1,000-bookmark search took ${dur1000}ms (expected < 15ms)`);

  // 2. Benchmark 5,000 bookmarks search
  const t1 = performance.now();
  for (let q = 0; q < 5; q++) {
    const results = matchAndRankBookmarks('TypeScript', largeCategories);
    assert.ok(results.length > 0);
  }
  const dur5000 = (performance.now() - t1) / 5;
  // Searching 5,000 bookmarks must complete within 45ms per search query
  assert.ok(dur5000 < 45, `5,000-bookmark search took ${dur5000}ms (expected < 45ms)`);
});
