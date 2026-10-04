import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setWallpaperFocalPoint,
  renderWallpaperLibrary,
  calculateAutoReadabilityDim
} from '../extension/js/features/wallpaper.js';
import {
  applyBackground,
  _resetBackgroundStateForTests
} from '../extension/js/features/theme.js';
import { closeDB } from '../extension/js/core/idb.js';

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
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
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

let mockOverlay = null;

beforeEach(() => {
  mockStorage.clear();
  _resetBackgroundStateForTests();

  mockOverlay = createMockElement('div', { id: 'bg-overlay' });

  globalThis.document = {
    createElement: (tag) => createMockElement(tag),
    createTextNode: (txt) => ({ textContent: String(txt) }),
    getElementById: (id) => (id === 'bg-overlay' ? mockOverlay : null),
    documentElement: {
      classList: {
        contains: (cls) => cls === 'dark'
      },
      getAttribute: (attr) => (attr === 'data-theme' ? 'dark' : null)
    }
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
                mockStorage.set(id, val);
                const r = { result: id };
                setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                return r;
              },
              get: (key) => {
                const r = { result: mockStorage.get(key) || null };
                setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                return r;
              },
              getAll: () => {
                const r = { result: Array.from(mockStorage.values()) };
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

  globalThis.URL = {
    createObjectURL: (blob) => 'blob:mock-url',
    revokeObjectURL: () => {}
  };
});

afterEach(async () => {
  await closeDB();
  _resetBackgroundStateForTests();
  delete globalThis.document;
  delete globalThis.indexedDB;
  delete globalThis.URL;
  mockStorage.clear();
});

test('5.3 Focal point: setWallpaperFocalPoint updates wallpaper and global focal position', () => {
  let settingsState = {
    background: {
      type: 'image',
      activeId: 'wp_1',
      focal: { x: 0.5, y: 0.5 },
      wallpapers: [
        { id: 'wp_1', name: 'photo.jpg', focal: { x: 0.5, y: 0.5 } }
      ]
    }
  };

  const store = {
    get: () => ({ settings: settingsState }),
    updateSettings: (update) => {
      settingsState = { ...settingsState, ...update };
    }
  };

  setWallpaperFocalPoint('wp_1', { x: 0.2, y: 0.8 }, store);

  const updatedBg = store.get().settings.background;
  assert.deepEqual(updatedBg.focal, { x: 0.2, y: 0.8 });
  assert.deepEqual(updatedBg.wallpapers[0].focal, { x: 0.2, y: 0.8 });
});

test('5.3 Focal point and Blur: applyBackground applies focal position and blur filter', async () => {
  mockStorage.set('wp_1', {
    id: 'wp_1',
    name: 'test.jpg',
    blob: { size: 1000 }
  });

  const bgConfig = {
    type: 'image',
    activeId: 'wp_1',
    focal: { x: 0.35, y: 0.75 },
    blur: 8,
    dim: 0.4
  };

  await applyBackground(bgConfig, true);

  assert.equal(mockOverlay.style.backgroundPosition, '35% 75%');
  assert.equal(mockOverlay.style.filter, 'blur(8px)');
  assert.equal(mockOverlay.style.opacity, '0.6');
});

test('5.3 Auto-readability: applyBackground computes automatic dimming from luminance data in dark theme', async () => {
  // Bright wallpaper in dark theme: autoReadability sets dim to ~0.8 (opacity ~0.2)
  mockStorage.set('wp_bright', {
    id: 'wp_bright',
    name: 'snow.jpg',
    blob: { size: 1000 }
  });

  const bgConfig = {
    type: 'image',
    activeId: 'wp_bright',
    autoReadability: true,
    dim: 0.35, // Manual default that should be overridden by autoReadability
    wallpapers: [
      {
        id: 'wp_bright',
        name: 'snow.jpg',
        luminanceData: { p90: 0.95, p10: 0.7, mean: 0.85 }
      }
    ]
  };

  await applyBackground(bgConfig, true);

  const opacity = parseFloat(mockOverlay.style.opacity);
  // Dim should be ~0.8, so opacity = 1 - dim should be around 0.19 - 0.22
  assert.ok(opacity < 0.30, `Expected dimmed opacity < 0.30 for bright wallpaper, got ${opacity}`);
});

test('5.3 Thumbnail focal click: clicking active thumbnail calculates relative coordinates and sets focal point', async () => {
  let settingsState = {
    background: {
      type: 'image',
      activeId: 'wp_1',
      focal: { x: 0.5, y: 0.5 },
      wallpapers: [
        { id: 'wp_1', name: 'photo.jpg', focal: { x: 0.5, y: 0.5 }, thumbnailUrl: 'data:img' }
      ]
    }
  };

  const store = {
    get: () => ({ settings: settingsState }),
    updateSettings: (update) => {
      settingsState = { ...settingsState, ...update };
    }
  };

  const container = createMockElement('div');
  await renderWallpaperLibrary(container, store);

  const card = container.querySelector('.wallpaper-card');
  assert.ok(card);
  const thumb = card.querySelector('.wallpaper-thumb');
  assert.ok(thumb);

  // Simulate click on thumbnail at x=50, y=80 inside a 200x100 rect -> x = 0.25, y = 0.8
  const clickEvent = {
    clientX: 50,
    clientY: 80,
    stopPropagation: () => {}
  };

  await thumb._on_click(clickEvent);

  const updatedBg = store.get().settings.background;
  assert.equal(updatedBg.focal.x, 0.25);
  assert.equal(updatedBg.focal.y, 0.8);
});
