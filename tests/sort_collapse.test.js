import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('3.3 Sort and collapse: sortCategoryBookmarks sorts A-Z with undo', async () => {
  const initialData = createDefaultDashboardData();
  initialData.categories[0].bookmarks = [
    { id: 'b1', name: 'Zebra', url: 'https://zebra.com', order: 0 },
    { id: 'b2', name: 'Apple', url: 'https://apple.com', order: 1 },
    { id: 'b3', name: 'Mango', url: 'https://mango.com', order: 2 }
  ];
  await store.replaceData(initialData, true);

  const cat = store.get().categories[0];
  const undo = store.sortCategoryBookmarks(cat.id);

  const sortedCat = store.get().categories.find(c => c.id === cat.id);
  assert.equal(sortedCat.bookmarks[0].name, 'Apple');
  assert.equal(sortedCat.bookmarks[0].order, 0);
  assert.equal(sortedCat.bookmarks[1].name, 'Mango');
  assert.equal(sortedCat.bookmarks[1].order, 1);
  assert.equal(sortedCat.bookmarks[2].name, 'Zebra');
  assert.equal(sortedCat.bookmarks[2].order, 2);

  // Undo restores original order
  undo();
  const restoredCat = store.get().categories.find(c => c.id === cat.id);
  assert.equal(restoredCat.bookmarks[0].name, 'Zebra');
  assert.equal(restoredCat.bookmarks[1].name, 'Apple');
  assert.equal(restoredCat.bookmarks[2].name, 'Mango');
});

test('3.3 Sort and collapse: setAllCategoriesCollapsed toggles all categories', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  // Collapse all
  store.setAllCategoriesCollapsed(true);
  for (const cat of store.get().categories) {
    assert.equal(cat.collapsed, true);
  }

  // Expand all
  store.setAllCategoriesCollapsed(false);
  for (const cat of store.get().categories) {
    assert.equal(cat.collapsed, false);
  }
});
