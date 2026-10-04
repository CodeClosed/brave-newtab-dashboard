import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveWallpaperRecord,
  deleteWallpaperRecord,
  closeDB
} from '../extension/js/core/idb.js';
import {
  renderWallpaperLibrary,
  MAX_WALLPAPERS,
  formatBytes
} from '../extension/js/features/wallpaper.js';

let mockStorage = new Map();

function createMockElement(tag, attrs = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    className: attrs.className || '',
    textContent: attrs.text || '',
    children: [],
    attributes: { ...attrs },
    style: {},
    disabled: false,
    value: '',
    setAttribute: (k, v) => { el.attributes[k] = v; },
    getAttribute: (k) => el.attributes[k],
    removeAttribute: (k) => { delete el.attributes[k]; },
    appendChild: (child) => {
      el.children.push(child);
      return child;
    },
    removeChild: (child) => {
      const idx = el.children.indexOf(child);
      if (idx !== -1) el.children.splice(idx, 1);
      return child;
    },
    addEventListener: (evt, handler) => {
      el[`_on_${evt}`] = handler;
    },
    querySelector: (sel) => {
      if (sel.startsWith('.')) {
        const classes = sel.split('.').filter(Boolean);
        const find = (node) => {
          if (node.className) {
            const nodeClasses = node.className.split(' ');
            if (classes.every(c => nodeClasses.includes(c))) return node;
          }
          for (const c of node.children) {
            const found = find(c);
            if (found) return found;
          }
          return null;
        };
        return find(el);
      }
      return null;
    },
    querySelectorAll: (sel) => {
      const results = [];
      if (sel.startsWith('.')) {
        const classes = sel.split('.').filter(Boolean);
        const search = (node) => {
          if (node.className) {
            const nodeClasses = node.className.split(' ');
            if (classes.every(c => nodeClasses.includes(c))) {
              results.push(node);
            }
          }
          for (const c of node.children) {
            search(c);
          }
        };
        for (const c of el.children) {
          search(c);
        }
      }
      return results;
    }
  };
  Object.defineProperty(el, 'firstChild', {
    get: () => el.children[0] || null
  });
  return el;
}

beforeEach(() => {
  mockStorage.clear();

  globalThis.document = {
    createElement: (tag) => createMockElement(tag),
    createTextNode: (txt) => ({ textContent: String(txt) })
  };

  globalThis.indexedDB = {
    open: () => {
      const req = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
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
          }),
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
  delete globalThis.document;
  delete globalThis.indexedDB;
  mockStorage.clear();
});

test('5.1 Wallpaper library UI: renders library stats and thumbnail cards', async () => {
  await saveWallpaperRecord({
    id: 'wp_1',
    name: 'Nature.jpg',
    size: 1536000,
    thumbnailUrl: 'data:image/webp;base64,thumb1',
    createdAt: '2026-01-01T00:00:00Z'
  });
  await saveWallpaperRecord({
    id: 'wp_2',
    name: 'Urban.jpg',
    size: 2621440,
    thumbnailUrl: 'data:image/webp;base64,thumb2',
    createdAt: '2026-01-02T00:00:00Z'
  });

  const mockStore = {
    get() {
      return {
        settings: {
          background: {
            type: 'image',
            activeId: 'wp_2',
            wallpapers: [
              { id: 'wp_2', name: 'Urban.jpg', size: 2621440, thumbnailUrl: 'data:image/webp;base64,thumb2' },
              { id: 'wp_1', name: 'Nature.jpg', size: 1536000, thumbnailUrl: 'data:image/webp;base64,thumb1' }
            ]
          }
        }
      };
    },
    updateSettings() {}
  };

  const container = createMockElement('div');
  await renderWallpaperLibrary(container, mockStore);

  const stats = container.querySelector('.wallpaper-stats');
  assert.ok(stats, 'Stats element must exist');
  // 1536000 + 2621440 = 4157440 bytes (~4.0 MB)
  assert.ok(stats.textContent.includes('2 of 10 wallpapers'), `Stats text should show count: ${stats.textContent}`);
  assert.ok(stats.textContent.includes('MB'), `Stats text should show MB: ${stats.textContent}`);

  const cards = container.querySelectorAll('.wallpaper-card');
  assert.equal(cards.length, 2, 'Should render 2 thumbnail cards');

  // wp_2 is activeId, should have active class
  const activeCard = container.querySelector('.wallpaper-card.active');
  assert.ok(activeCard, 'Active card must have active class');
  assert.ok(activeCard.getAttribute('data-id') === 'wp_2');
});

test('5.1 Wallpaper library UI: clicking card activates wallpaper and delete button removes wallpaper', async () => {
  await saveWallpaperRecord({
    id: 'wp_1',
    name: 'Nature.jpg',
    size: 1000,
    createdAt: '2026-01-01T00:00:00Z'
  });
  await saveWallpaperRecord({
    id: 'wp_2',
    name: 'Urban.jpg',
    size: 2000,
    createdAt: '2026-01-02T00:00:00Z'
  });

  let lastSettingsUpdate = null;
  const mockStore = {
    get() {
      return {
        settings: {
          background: {
            type: 'image',
            activeId: 'wp_1',
            wallpapers: [
              { id: 'wp_1', name: 'Nature.jpg', size: 1000 },
              { id: 'wp_2', name: 'Urban.jpg', size: 2000 }
            ]
          }
        }
      };
    },
    updateSettings(delta) {
      lastSettingsUpdate = delta;
    }
  };

  const container = createMockElement('div');
  await renderWallpaperLibrary(container, mockStore);

  const cards = container.querySelectorAll('.wallpaper-card');
  const card2 = cards.find(c => c.getAttribute('data-id') === 'wp_2');
  assert.ok(card2);

  // Click card2 to activate
  card2._on_click({ stopPropagation: () => {} });
  assert.equal(lastSettingsUpdate.background.activeId, 'wp_2');

  // Click delete on card1
  const card1 = cards.find(c => c.getAttribute('data-id') === 'wp_1');
  const delBtn = card1.querySelector('.wallpaper-card-del');
  assert.ok(delBtn, 'Delete button must exist on card');

  let stopped = false;
  await delBtn._on_click({ stopPropagation: () => { stopped = true; } });
  assert.ok(stopped, 'stopPropagation should be called on delete click');
  assert.equal(lastSettingsUpdate.background.wallpapers.length, 1);
});
