import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyBackground, _resetBackgroundStateForTests } from '../extension/js/features/theme.js';
import { getBackgroundImage, saveBackgroundImage, closeDB, _getOpenCountForTests } from '../extension/js/core/idb.js';

let createdObjectUrls = [];
let revokedObjectUrls = [];
let overlayElement = null;

beforeEach(() => {
  createdObjectUrls = [];
  revokedObjectUrls = [];

  overlayElement = {
    style: {
      backgroundImage: '',
      backgroundColor: '',
      opacity: '0'
    }
  };

  globalThis.document = {
    getElementById: (id) => (id === 'bg-overlay' ? overlayElement : null)
  };

  globalThis.URL = {
    createObjectURL: (blob) => {
      const url = `blob:mock-${Math.random()}`;
      createdObjectUrls.push(url);
      return url;
    },
    revokeObjectURL: (url) => {
      revokedObjectUrls.push(url);
    }
  };

  if (_resetBackgroundStateForTests) {
    _resetBackgroundStateForTests();
  }
});

afterEach(async () => {
  if (closeDB) {
    await closeDB();
  }
  delete globalThis.document;
  delete globalThis.URL;
  delete globalThis.indexedDB;
});

test('A4: does not re-apply background or re-read image when settings.background has not changed', async () => {
  const bgConfig = { type: 'solid', value: '#123456', dim: 0.5 };

  await applyBackground(bgConfig);
  assert.equal(overlayElement.style.backgroundColor, '#123456');

  // Change style manually to verify if second call touches DOM
  overlayElement.style.backgroundColor = '#changed-manually';

  // Second call with identical background config (as happens during bookmark reorder)
  await applyBackground(bgConfig);

  // If skipped, background was NOT overwritten back to #123456
  assert.equal(overlayElement.style.backgroundColor, '#changed-manually', 'Must skip applyBackground if config key is unchanged');
});

test('A4: guards against out-of-order async image results', async () => {
  // Simulate slow image resolution
  let resolveSlowBlob;
  const slowPromise = new Promise((resolve) => {
    resolveSlowBlob = resolve;
  });

  // Mock getBackgroundImage in theme or idb
  const originalGetBg = getBackgroundImage;
  let getBgCallCount = 0;

  // First call starts slow image load
  const bgImageConfig = { type: 'image', value: 'custom_wallpaper', dim: 0.35 };

  // Set up mock indexedDB
  let openCallCount = 0;
  globalThis.indexedDB = {
    open: () => {
      openCallCount++;
      const req = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              get: () => {
                const getReq = {};
                slowPromise.then((b) => {
                  getReq.result = b;
                  if (getReq.onsuccess) getReq.onsuccess();
                });
                return getReq;
              }
            })
          }),
          close: () => {}
        }
      };
      setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 0);
      return req;
    }
  };

  const imageLoadPromise = applyBackground(bgImageConfig);

  // User immediately switches to solid background
  const solidConfig = { type: 'solid', value: '#999999', dim: 0.2 };
  await applyBackground(solidConfig);

  assert.equal(overlayElement.style.backgroundColor, '#999999');

  // Now the slow image resolves late
  resolveSlowBlob(new Blob(['fake'], { type: 'image/png' }));
  await imageLoadPromise;

  // Stale image must NOT overwrite solid background
  assert.equal(overlayElement.style.backgroundColor, '#999999', 'Stale image result must not overwrite newer solid background');
  assert.equal(overlayElement.style.backgroundImage, 'none', 'Stale image must not set backgroundImage');
});

test('A4: reuses IndexedDB connection across multiple calls', async () => {
  let openCount = 0;
  globalThis.indexedDB = {
    open: () => {
      openCount++;
      const req = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              get: () => {
                const getReq = { result: null };
                setTimeout(() => { if (getReq.onsuccess) getReq.onsuccess(); }, 0);
                return getReq;
              }
            })
          }),
          close: () => {}
        }
      };
      setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 0);
      return req;
    }
  };

  await getBackgroundImage();
  await getBackgroundImage();

  assert.equal(openCount, 1, 'IndexedDB connection should be reused, open called only once');
});

test('A4: revokes previous object URL when replaced', async () => {
  let blobToReturn = new Blob(['img1'], { type: 'image/png' });

  globalThis.indexedDB = {
    open: () => {
      const req = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              get: () => {
                const getReq = { result: blobToReturn };
                setTimeout(() => { if (getReq.onsuccess) getReq.onsuccess(); }, 0);
                return getReq;
              }
            })
          }),
          close: () => {}
        }
      };
      setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 0);
      return req;
    }
  };

  await applyBackground({ type: 'image', value: 'custom_wallpaper', dim: 0.35 });
  assert.equal(createdObjectUrls.length, 1);
  const firstUrl = createdObjectUrls[0];

  // Switch to solid background
  await applyBackground({ type: 'solid', value: '#111111', dim: 0.35 });

  assert.ok(revokedObjectUrls.includes(firstUrl), 'Previous object URL must be revoked when background is replaced');
});
