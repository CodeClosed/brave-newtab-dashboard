import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import { validateCustomIcon, renderBookmarkIcon } from '../extension/js/features/custom-icons.js';
import { refreshFavicon, _resetFaviconCacheForTests } from '../extension/js/ui/favicons.js';

test('3.4 Custom Icons: validateCustomIcon enforces rules and size caps', () => {
  // Website icon (null) is valid
  assert.equal(validateCustomIcon(null).valid, true);
  assert.equal(validateCustomIcon(undefined).valid, true);

  // Valid emoji (<= 8 chars)
  assert.equal(validateCustomIcon({ type: 'emoji', value: '🚀' }).valid, true);
  assert.equal(validateCustomIcon({ type: 'emoji', value: '⭐' }).valid, true);

  // Invalid emoji (empty or > 8 chars)
  assert.equal(validateCustomIcon({ type: 'emoji', value: '' }).valid, false);
  assert.equal(validateCustomIcon({ type: 'emoji', value: '123456789' }).valid, false);

  // Valid image data URL under 12 KB (~16,384 characters in base64)
  const smallDataUrl = 'data:image/png;base64,' + 'A'.repeat(500);
  assert.equal(validateCustomIcon({ type: 'image', value: smallDataUrl }).valid, true);

  // Invalid image data URL (not data:image or exceeding size)
  assert.equal(validateCustomIcon({ type: 'image', value: 'https://unsafe.com/img.png' }).valid, false);
  const oversizedDataUrl = 'data:image/png;base64,' + 'A'.repeat(20000);
  assert.equal(validateCustomIcon({ type: 'image', value: oversizedDataUrl }).valid, false);

  // Unknown icon type
  assert.equal(validateCustomIcon({ type: 'svg', value: '<svg></svg>' }).valid, false);
});

test('3.4 Custom Icons: store updates bookmark icon and resets to website icon', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const cat = store.get().categories[0];
  const bm = cat.bookmarks[0];

  // Set emoji icon
  store.updateBookmark(cat.id, bm.id, {
    icon: { type: 'emoji', value: '🔥' }
  });
  let updatedBm = store.get().categories[0].bookmarks.find(b => b.id === bm.id);
  assert.deepEqual(updatedBm.icon, { type: 'emoji', value: '🔥' });

  // Set custom image icon
  const dataUrl = 'data:image/webp;base64,AAAA';
  store.updateBookmark(cat.id, bm.id, {
    icon: { type: 'image', value: dataUrl }
  });
  updatedBm = store.get().categories[0].bookmarks.find(b => b.id === bm.id);
  assert.deepEqual(updatedBm.icon, { type: 'image', value: dataUrl });

  // Reset to website icon (null)
  store.updateBookmark(cat.id, bm.id, { icon: null });
  updatedBm = store.get().categories[0].bookmarks.find(b => b.id === bm.id);
  assert.equal(updatedBm.icon, null);
});

test('3.4 Custom Icons: refreshFavicon evicts domain status cache', () => {
  _resetFaviconCacheForTests();
  const refreshed = refreshFavicon('https://github.com/foo/bar');
  assert.equal(refreshed, true);

  // Invalid domain URL returns false
  const invalidRefreshed = refreshFavicon('');
  assert.equal(invalidRefreshed, false);
});
