import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveWallpaperRecord,
  getWallpaperRecord,
  getAllWallpaperRecords,
  deleteWallpaperRecord,
  getWallpaperCountAndSize,
  closeDB
} from '../extension/js/core/idb.js';

let mockStorage = new Map();

beforeEach(() => {
  mockStorage.clear();

  // Mock IndexedDB in memory
  globalThis.indexedDB = {
    open: (dbName, version) => {
      const req = {
        result: {
          objectStoreNames: {
            contains: (name) => true
          },
          transaction: (storeName, mode) => {
            return {
              objectStore: (sName) => ({
                put: (val, key) => {
                  const id = key || val.id;
                  mockStorage.set(id, JSON.parse(JSON.stringify(val)));
                  const r = { result: id };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                },
                get: (key) => {
                  const r = { result: mockStorage.get(key) ? JSON.parse(JSON.stringify(mockStorage.get(key))) : null };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                },
                getAll: () => {
                  const items = Array.from(mockStorage.values()).map(v => JSON.parse(JSON.stringify(v)));
                  const r = { result: items };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                },
                delete: (key) => {
                  mockStorage.delete(key);
                  const r = { result: undefined };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                }
              })
            };
          },
          close: () => {}
        }
      };
      setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 0);
      return req;
    }
  };
});

afterEach(async () => {
  await closeDB();
  delete globalThis.indexedDB;
  mockStorage.clear();
});

test('5.1 Wallpaper library: saveWallpaperRecord and getWallpaperRecord round-trip', async () => {
  const item = {
    id: 'wp_1',
    name: 'mountain.jpg',
    size: 102400,
    createdAt: new Date().toISOString(),
    thumbnailUrl: 'data:image/webp;base64,mockthumb'
  };

  const saved = await saveWallpaperRecord(item);
  assert.equal(saved.id, 'wp_1');

  const retrieved = await getWallpaperRecord('wp_1');
  assert.ok(retrieved);
  assert.equal(retrieved.id, 'wp_1');
  assert.equal(retrieved.name, 'mountain.jpg');
  assert.equal(retrieved.size, 102400);
});

test('5.1 Wallpaper library: getAllWallpaperRecords returns all items sorted by date', async () => {
  const wp1 = { id: 'wp_1', name: 'first.jpg', size: 1000, createdAt: '2026-01-01T00:00:00.000Z' };
  const wp2 = { id: 'wp_2', name: 'second.jpg', size: 2000, createdAt: '2026-01-02T00:00:00.000Z' };

  await saveWallpaperRecord(wp1);
  await saveWallpaperRecord(wp2);

  const all = await getAllWallpaperRecords();
  assert.equal(all.length, 2);
  // Sorted newest first
  assert.equal(all[0].id, 'wp_2');
  assert.equal(all[1].id, 'wp_1');
});

test('5.1 Wallpaper library: deleteWallpaperRecord removes specific wallpaper', async () => {
  const wp = { id: 'wp_delete_me', name: 'del.jpg', size: 500, createdAt: new Date().toISOString() };
  await saveWallpaperRecord(wp);

  let fetched = await getWallpaperRecord('wp_delete_me');
  assert.ok(fetched);

  await deleteWallpaperRecord('wp_delete_me');
  fetched = await getWallpaperRecord('wp_delete_me');
  assert.equal(fetched, null);
});

test('5.1 Wallpaper library: getWallpaperCountAndSize computes accurate counts and totals', async () => {
  await saveWallpaperRecord({ id: 'wp_a', size: 5000, createdAt: '2026-01-01T00:00:00.000Z' });
  await saveWallpaperRecord({ id: 'wp_b', size: 15000, createdAt: '2026-01-02T00:00:00.000Z' });

  const stats = await getWallpaperCountAndSize();
  assert.equal(stats.count, 2);
  assert.equal(stats.totalBytes, 20000);
});

test('5.1 Wallpaper library: formatBytes formats sizes correctly', async () => {
  const { formatBytes } = await import('../extension/js/features/wallpaper.js');
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1048576), '1.0 MB');
  assert.equal(formatBytes(5242880), '5.0 MB');
});

test('5.1 Wallpaper library: addWallpaperToLibrary rejects when cap of 10 is reached', async () => {
  const { addWallpaperToLibrary, MAX_WALLPAPERS } = await import('../extension/js/features/wallpaper.js');
  assert.equal(MAX_WALLPAPERS, 10);

  // Fill up to 10
  for (let i = 0; i < 10; i++) {
    await saveWallpaperRecord({ id: `wp_${i}`, name: `wp_${i}.jpg`, size: 1000, createdAt: new Date().toISOString() });
  }

  const mockStore = {
    get() {
      return {
        settings: {
          background: {
            wallpapers: Array.from({ length: 10 }, (_, i) => ({ id: `wp_${i}` }))
          }
        }
      };
    },
    updateSettings() {}
  };

  const res = await addWallpaperToLibrary(new Blob(['fake']), 'exceed.jpg', mockStore);
  assert.equal(res.success, false);
  assert.ok(res.reason.includes('maximum 10'));
});

test('5.1 Wallpaper library: removeWallpaperFromLibrary deletes record and updates store', async () => {
  const { removeWallpaperFromLibrary } = await import('../extension/js/features/wallpaper.js');

  await saveWallpaperRecord({ id: 'wp_keep', name: 'keep.jpg', size: 1000, createdAt: new Date().toISOString() });
  await saveWallpaperRecord({ id: 'wp_rem', name: 'rem.jpg', size: 2000, createdAt: new Date().toISOString() });

  let updatedSettings = null;
  const mockStore = {
    get() {
      return {
        settings: {
          background: {
            type: 'image',
            activeId: 'wp_rem',
            wallpapers: [
              { id: 'wp_keep', name: 'keep.jpg' },
              { id: 'wp_rem', name: 'rem.jpg' }
            ]
          }
        }
      };
    },
    updateSettings(delta) {
      updatedSettings = delta;
    }
  };

  const res = await removeWallpaperFromLibrary('wp_rem', mockStore);
  assert.equal(res.success, true);

  // Check deleted from IDB
  const checkIdb = await getWallpaperRecord('wp_rem');
  assert.equal(checkIdb, null);

  // Store updated with new activeId and wallpapers list
  assert.ok(updatedSettings);
  assert.equal(updatedSettings.background.activeId, 'wp_keep');
  assert.equal(updatedSettings.background.wallpapers.length, 1);
});

test('5.1 Wallpaper library: setActiveWallpaper updates activeId and retains focal point', async () => {
  const { setActiveWallpaper } = await import('../extension/js/features/wallpaper.js');

  let updatedSettings = null;
  const mockStore = {
    get() {
      return {
        settings: {
          background: {
            type: 'none',
            activeId: null,
            wallpapers: [
              { id: 'wp_1', name: 'wp1.jpg', focal: { x: 0.2, y: 0.8 } },
              { id: 'wp_2', name: 'wp2.jpg', focal: { x: 0.5, y: 0.5 } }
            ]
          }
        }
      };
    },
    updateSettings(delta) {
      updatedSettings = delta;
    }
  };

  setActiveWallpaper('wp_1', mockStore);
  assert.ok(updatedSettings);
  assert.equal(updatedSettings.background.type, 'image');
  assert.equal(updatedSettings.background.activeId, 'wp_1');
  assert.deepEqual(updatedSettings.background.focal, { x: 0.2, y: 0.8 });
});
