import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('CRUD - Add new custom category', async () => {
  await store.replaceData(createDefaultDashboardData(), true);
  const initialCount = store.get().categories.length;

  const newCat = store.addCategory({ name: 'Gaming & Anime', icon: '🎮' });
  assert.equal(store.get().categories.length, initialCount + 1);
  assert.equal(newCat.name, 'Gaming & Anime');
  assert.equal(newCat.icon, '🎮');
  assert.equal(newCat.bookmarks.length, 0);
});

test('CRUD - Update category details', () => {
  const cat = store.get().categories[0];
  store.updateCategory(cat.id, { name: 'Engineering Core', icon: '⚡' });

  const updated = store.get().categories.find(c => c.id === cat.id);
  assert.equal(updated.name, 'Engineering Core');
  assert.equal(updated.icon, '⚡');
});

test('CRUD - Delete category and Undo restore', () => {
  const initialCategories = store.get().categories;
  const targetId = initialCategories[0].id;
  const initialLength = initialCategories.length;

  const undo = store.deleteCategory(targetId);
  assert.equal(store.get().categories.length, initialLength - 1);
  assert.equal(store.get().categories.some(c => c.id === targetId), false);

  // Execute undo
  undo();
  assert.equal(store.get().categories.length, initialLength);
  assert.equal(store.get().categories.some(c => c.id === targetId), true);
});

test('CRUD - Add bookmark with normalization', () => {
  const cat = store.get().categories[0];
  const initialBmCount = cat.bookmarks.length;

  const bm = store.addBookmark(cat.id, { name: 'Vite', url: 'vite.dev' });
  assert.equal(cat.bookmarks.length, initialBmCount + 1);
  assert.equal(bm.name, 'Vite');
  assert.equal(bm.url, 'https://vite.dev/');
});

test('CRUD - Edit bookmark and move category', () => {
  const catA = store.get().categories[0];
  const catB = store.get().categories[1];
  const bm = catA.bookmarks[0];

  store.updateBookmark(catA.id, bm.id, {
    name: 'Vite Next Gen',
    url: 'https://vite.dev/guide/',
    targetCategoryId: catB.id
  });

  // Verify removed from catA and added to catB
  assert.equal(catA.bookmarks.some(b => b.id === bm.id), false);
  const moved = catB.bookmarks.find(b => b.id === bm.id);
  assert.equal(Boolean(moved), true);
  assert.equal(moved.name, 'Vite Next Gen');
  assert.equal(moved.url, 'https://vite.dev/guide/');
});

test('CRUD - Delete bookmark and Undo restore', () => {
  const cat = store.get().categories[0];
  const bm = cat.bookmarks[0];
  const initialLength = cat.bookmarks.length;

  const undo = store.deleteBookmark(cat.id, bm.id);
  assert.equal(cat.bookmarks.length, initialLength - 1);
  assert.equal(cat.bookmarks.some(b => b.id === bm.id), false);

  // Execute undo
  undo();
  const restoredCat = store.get().categories.find(c => c.id === cat.id);
  assert.equal(restoredCat.bookmarks.length, initialLength);
  assert.equal(restoredCat.bookmarks.some(b => b.id === bm.id), true);
});
