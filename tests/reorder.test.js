import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('Reorder - Category move forward and backward', async () => {
  await store.replaceData(createDefaultDashboardData(), true);

  const initialCat0 = store.get().categories[0].name;
  const initialCat1 = store.get().categories[1].name;

  // Move category 0 to position 1
  store.reorderCategories(0, 1);

  assert.equal(store.get().categories[0].name, initialCat1);
  assert.equal(store.get().categories[1].name, initialCat0);
  assert.equal(store.get().categories[0].order, 0);
  assert.equal(store.get().categories[1].order, 1);

  // Move category 1 back to position 0
  store.reorderCategories(1, 0);
  assert.equal(store.get().categories[0].name, initialCat0);
  assert.equal(store.get().categories[1].name, initialCat1);
});

test('Reorder - Bookmark within same category', () => {
  const cat = store.get().categories[0];
  const bm0Name = cat.bookmarks[0].name;
  const bm1Name = cat.bookmarks[1].name;

  // Swap bm0 and bm1
  store.reorderBookmarks(cat.id, 0, 1);

  const updatedCat = store.get().categories.find(c => c.id === cat.id);
  assert.equal(updatedCat.bookmarks[0].name, bm1Name);
  assert.equal(updatedCat.bookmarks[1].name, bm0Name);
  assert.equal(updatedCat.bookmarks[0].order, 0);
  assert.equal(updatedCat.bookmarks[1].order, 1);
});

test('Reorder - Move bookmark across categories at specific index', () => {
  const sourceCat = store.get().categories[0];
  const targetCat = store.get().categories[1];
  const targetBmCount = targetCat.bookmarks.length;
  const movingBm = sourceCat.bookmarks[0];

  store.moveBookmark(sourceCat.id, targetCat.id, movingBm.id, 1);

  const updatedSource = store.get().categories.find(c => c.id === sourceCat.id);
  const updatedTarget = store.get().categories.find(c => c.id === targetCat.id);

  // Check removed from source
  assert.equal(updatedSource.bookmarks.some(b => b.id === movingBm.id), false);

  // Check inserted at index 1 in target
  assert.equal(updatedTarget.bookmarks.length, targetBmCount + 1);
  assert.equal(updatedTarget.bookmarks[1].id, movingBm.id);
  assert.equal(updatedTarget.bookmarks[1].order, 1);
  assert.equal(updatedTarget.bookmarks[2].order, 2);
});

test('Reorder - Safe guards on invalid indices', () => {
  const catCount = store.get().categories.length;

  // Invalid indices should be no-ops
  store.reorderCategories(-1, 2);
  store.reorderCategories(0, 999);
  assert.equal(store.get().categories.length, catCount);

  const catId = store.get().categories[0].id;
  const bmCount = store.get().categories[0].bookmarks.length;
  store.reorderBookmarks(catId, -5, 2);
  store.reorderBookmarks(catId, 0, 500);
  assert.equal(store.get().categories[0].bookmarks.length, bmCount);
});
