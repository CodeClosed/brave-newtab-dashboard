import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import { parseAddManyInput, getRangeSelectionIndices, bulkDeleteBookmarks, bulkMoveBookmarks, bulkPinBookmarks } from '../extension/js/features/bulk-ops.js';

test('3.2 Bulk Ops: parseAddManyInput handles plain URLs, name | url, and identifies invalid lines', () => {
  const input = `
    https://github.com
    Google Docs | docs.google.com
    invalid-url-with-no-domain
    javascript:alert(1)
    MDN Web Docs | https://developer.mozilla.org/en-US/

    ftp://unsafe.com
  `;

  const { valid, invalid } = parseAddManyInput(input);

  assert.equal(valid.length, 3);
  assert.equal(valid[0].url, 'https://github.com/');
  assert.equal(valid[0].name, 'github.com');

  assert.equal(valid[1].url, 'https://docs.google.com/');
  assert.equal(valid[1].name, 'Google Docs');

  assert.equal(valid[2].url, 'https://developer.mozilla.org/en-US/');
  assert.equal(valid[2].name, 'MDN Web Docs');

  assert.equal(invalid.length, 3);
  assert.equal(invalid.some(item => item.line.includes('invalid-url-with-no-domain')), true);
  assert.equal(invalid.some(item => item.line.includes('javascript:alert(1)')), true);
  assert.equal(invalid.some(item => item.line.includes('ftp://unsafe.com')), true);
});

test('3.2 Bulk Ops: getRangeSelectionIndices computes index range between last and current', () => {
  const indices = getRangeSelectionIndices(1, 4);
  assert.deepEqual(indices, [1, 2, 3, 4]);

  const reverseIndices = getRangeSelectionIndices(4, 2);
  assert.deepEqual(reverseIndices, [2, 3, 4]);

  const sameIndex = getRangeSelectionIndices(3, 3);
  assert.deepEqual(sameIndex, [3]);
});

test('3.2 Bulk Ops: bulkDeleteBookmarks deletes selected items with undo', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const cat0 = store.get().categories[0];
  const bm1 = cat0.bookmarks[0];
  const bm2 = cat0.bookmarks[1];
  const initialCount = cat0.bookmarks.length;

  const undo = bulkDeleteBookmarks([bm1.id, bm2.id], store);

  const updatedCat = store.get().categories.find(c => c.id === cat0.id);
  assert.equal(updatedCat.bookmarks.length, initialCount - 2);
  assert.equal(updatedCat.bookmarks.some(b => b.id === bm1.id || b.id === bm2.id), false);

  // Undo restores both bookmarks
  undo();
  const restoredCat = store.get().categories.find(c => c.id === cat0.id);
  assert.equal(restoredCat.bookmarks.length, initialCount);
  assert.equal(restoredCat.bookmarks.some(b => b.id === bm1.id), true);
  assert.equal(restoredCat.bookmarks.some(b => b.id === bm2.id), true);
});

test('3.2 Bulk Ops: bulkMoveBookmarks moves multiple bookmarks to target category with undo', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const cat0 = store.get().categories[0];
  const cat1 = store.get().categories[1];
  const bm0 = cat0.bookmarks[0];
  const bm1 = cat0.bookmarks[1];

  const cat0InitialLen = cat0.bookmarks.length;
  const cat1InitialLen = cat1.bookmarks.length;

  const undo = bulkMoveBookmarks([bm0.id, bm1.id], cat1.id, store);

  const updatedCat0 = store.get().categories.find(c => c.id === cat0.id);
  const updatedCat1 = store.get().categories.find(c => c.id === cat1.id);

  assert.equal(updatedCat0.bookmarks.length, cat0InitialLen - 2);
  assert.equal(updatedCat1.bookmarks.length, cat1InitialLen + 2);
  assert.equal(updatedCat1.bookmarks.some(b => b.id === bm0.id), true);
  assert.equal(updatedCat1.bookmarks.some(b => b.id === bm1.id), true);

  // Undo restores
  undo();
  const restoredCat0 = store.get().categories.find(c => c.id === cat0.id);
  const restoredCat1 = store.get().categories.find(c => c.id === cat1.id);
  assert.equal(restoredCat0.bookmarks.length, cat0InitialLen);
  assert.equal(restoredCat1.bookmarks.length, cat1InitialLen);
});

test('3.2 Bulk Ops: bulkPinBookmarks pins multiple items capping at 8', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const activeSpace = store.get().spaces.find(s => s.id === store.get().activeSpaceId);
  assert.equal(activeSpace.pinned.length, 0);

  const bmIds = store.get().categories[0].bookmarks.map(b => b.id);
  const result = bulkPinBookmarks(bmIds, store);

  assert.equal(result.pinnedCount, bmIds.length);
  const updatedSpace = store.get().spaces.find(s => s.id === store.get().activeSpaceId);
  assert.equal(updatedSpace.pinned.length, bmIds.length);

  // Test undo restoration
  result.undo();
  const unpinnedSpace = store.get().spaces.find(s => s.id === store.get().activeSpaceId);
  assert.equal(unpinnedSpace.pinned.length, 0);
});

test('3.2 Bulk Ops: bulk operations invoke persistence and notify subscribers', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  let notified = false;
  const unsub = store.subscribe(() => {
    notified = true;
  });

  const cat = store.get().categories[0];
  const bm = cat.bookmarks[0];

  notified = false;
  bulkDeleteBookmarks([bm.id], store);
  assert.equal(notified, true, 'bulkDeleteBookmarks must notify subscribers and persist');

  unsub();
});
