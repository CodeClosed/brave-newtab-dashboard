import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('C2: default seed data contains only generic bookmarks (no personal college portals)', () => {
  const data = createDefaultDashboardData();

  for (const cat of data.categories) {
    for (const bm of cat.bookmarks) {
      assert.notEqual(
        bm.name.toLowerCase(),
        'college portal',
        'Seed data must not contain personal "College Portal" bookmark'
      );
      assert.ok(
        !bm.url.includes('vtop.vit.ac.in'),
        `Seed bookmark URL "${bm.url}" must not reference personal college portal vtop.vit.ac.in`
      );
    }
  }

  // Ensure category names are generic
  for (const cat of data.categories) {
    assert.ok(
      !cat.name.toLowerCase().includes('college'),
      `Category name "${cat.name}" should be generic (e.g. Reference & Tools, Learning & Tools)`
    );
  }
});
