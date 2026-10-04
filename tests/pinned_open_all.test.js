import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  togglePinBookmark,
  isBookmarkPinned,
  getPinnedBookmarks,
  openAllCollectionLinks
} from '../extension/js/features/pinned.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

test('2.5 Pinned strip: toggles pin/unpin and caps at 8 items', () => {
  const initial = createDefaultDashboardData();
  const spaceId = initial.activeSpaceId;
  initial.spaces[0].pinned = [];
  store.replaceData(initial);

  // Pin bookmark 1
  const res1 = togglePinBookmark('bm-1');
  assert.equal(res1.pinned, true);
  assert.equal(isBookmarkPinned('bm-1'), true);
  assert.deepEqual(store.getState().spaces[0].pinned, ['bm-1']);

  // Unpin bookmark 1
  const res2 = togglePinBookmark('bm-1');
  assert.equal(res2.pinned, false);
  assert.equal(isBookmarkPinned('bm-1'), false);
  assert.deepEqual(store.getState().spaces[0].pinned, []);

  // Fill up to 8 pinned bookmarks
  for (let i = 1; i <= 8; i++) {
    togglePinBookmark(`bm-${i}`);
  }
  assert.equal(store.getState().spaces[0].pinned.length, 8);

  // 9th bookmark must be rejected
  const res9 = togglePinBookmark('bm-9');
  assert.equal(res9.success, false);
  assert.equal(res9.pinned, false);
  assert.equal(store.getState().spaces[0].pinned.length, 8);
});

test('2.5 Pinned strip: deleting a bookmark removes it from pinned array', () => {
  const data = createDefaultDashboardData();
  const cat = data.categories[0];
  const bm = cat.bookmarks[0];
  data.spaces[0].pinned = [bm.id];
  store.replaceData(data);

  assert.equal(isBookmarkPinned(bm.id), true);

  // Delete bookmark
  store.deleteBookmark(cat.id, bm.id);

  assert.equal(isBookmarkPinned(bm.id), false);
  assert.ok(!store.getState().spaces[0].pinned.includes(bm.id));
});

test('2.5 Open All Links: opens tabs using chrome.tabs.create', async () => {
  const openedUrls = [];
  globalThis.chrome = {
    tabs: {
      create(opts) {
        openedUrls.push(opts.url);
        return Promise.resolve({ id: openedUrls.length });
      }
    }
  };

  const bookmarks = [
    { id: 'b1', name: 'Site 1', url: 'https://site1.com' },
    { id: 'b2', name: 'Site 2', url: 'https://site2.com' },
    { id: 'b3', name: 'Site 3', url: 'https://site3.com' }
  ];

  await openAllCollectionLinks(bookmarks);
  assert.equal(openedUrls.length, 3);
  assert.equal(openedUrls[0], 'https://site1.com');
  assert.equal(openedUrls[1], 'https://site2.com');
  assert.equal(openedUrls[2], 'https://site3.com');

  delete globalThis.chrome;
});

test('2.5 Open All Links: asks confirmation when links exceed 10', async () => {
  const openedUrls = [];
  globalThis.chrome = {
    tabs: {
      create(opts) {
        openedUrls.push(opts.url);
      }
    }
  };

  const bookmarks = Array.from({ length: 12 }, (_, i) => ({
    id: `b-${i}`,
    name: `Site ${i}`,
    url: `https://site${i}.com`
  }));

  let confirmPromptShown = false;
  const mockConfirm = (msg) => {
    confirmPromptShown = true;
    return false; // User cancels
  };

  await openAllCollectionLinks(bookmarks, { confirmFn: mockConfirm });
  assert.equal(confirmPromptShown, true);
  assert.equal(openedUrls.length, 0, 'Must not open links if user cancelled confirmation');

  // When user confirms:
  await openAllCollectionLinks(bookmarks, { confirmFn: () => true });
  assert.equal(openedUrls.length, 12);

  delete globalThis.chrome;
});
