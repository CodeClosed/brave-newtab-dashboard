import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDashboardData, generateId } from '../extension/js/core/schema.js';
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
  assert.equal(migrated.version, 1);
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
