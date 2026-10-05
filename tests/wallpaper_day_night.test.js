import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setDayNightWallpaper,
  resolveActiveWallpaperId,
  renderWallpaperLibrary
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
    createObjectURL: (blob) => `blob:${blob?.name || 'url'}`,
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

test('5.4 Day/Night: resolveActiveWallpaperId returns appropriate id based on theme', () => {
  const bgConfig = {
    type: 'image',
    activeId: 'wp_fallback',
    dayId: 'wp_sunny',
    nightId: 'wp_stars'
  };

  // Light theme: should pick dayId
  assert.equal(resolveActiveWallpaperId(bgConfig, false), 'wp_sunny');

  // Dark theme: should pick nightId
  assert.equal(resolveActiveWallpaperId(bgConfig, true), 'wp_stars');

  // Partial pair: nightId set, dayId null
  assert.equal(resolveActiveWallpaperId({ ...bgConfig, dayId: null }, false), 'wp_fallback');
  assert.equal(resolveActiveWallpaperId({ ...bgConfig, dayId: null }, true), 'wp_stars');
});

test('5.4 Day/Night: setDayNightWallpaper updates dayId and nightId in store', () => {
  let settingsState = {
    background: {
      type: 'image',
      activeId: 'wp_default',
      dayId: null,
      nightId: null,
      wallpapers: [
        { id: 'wp_1', name: 'day.jpg' },
        { id: 'wp_2', name: 'night.jpg' }
      ]
    }
  };

  const store = {
    get: () => ({ settings: settingsState }),
    updateSettings: (update) => {
      settingsState = { ...settingsState, ...update };
    }
  };

  // Set day wallpaper
  setDayNightWallpaper('day', 'wp_1', store);
  assert.equal(store.get().settings.background.dayId, 'wp_1');

  // Set night wallpaper
  setDayNightWallpaper('night', 'wp_2', store);
  assert.equal(store.get().settings.background.nightId, 'wp_2');

  // Toggle off day wallpaper
  setDayNightWallpaper('day', 'wp_1', store);
  assert.equal(store.get().settings.background.dayId, null);
});

test('5.4 Day/Night: applyBackground applies dayId in light theme and nightId in dark theme', async () => {
  mockStorage.set('wp_day', { id: 'wp_day', name: 'day-image', blob: { name: 'day-image' } });
  mockStorage.set('wp_night', { id: 'wp_night', name: 'night-image', blob: { name: 'night-image' } });

  const bgConfig = {
    type: 'image',
    activeId: 'wp_default',
    dayId: 'wp_day',
    nightId: 'wp_night'
  };

  // 1. Dark theme
  globalThis.document.documentElement.getAttribute = (attr) => (attr === 'data-theme' ? 'dark' : null);
  globalThis.document.documentElement.classList.contains = (cls) => cls === 'dark';
  await applyBackground(bgConfig, true);
  assert.equal(mockOverlay.style.backgroundImage, 'url("blob:night-image")');

  // 2. Light theme
  globalThis.document.documentElement.getAttribute = (attr) => (attr === 'data-theme' ? 'light' : null);
  globalThis.document.documentElement.classList.contains = () => false;
  await applyBackground(bgConfig, true);
  assert.equal(mockOverlay.style.backgroundImage, 'url("blob:day-image")');
});

test('5.4 Day/Night UI: renders day and night assignment buttons on cards', async () => {
  let settingsState = {
    background: {
      type: 'image',
      activeId: 'wp_1',
      dayId: 'wp_1',
      nightId: null,
      wallpapers: [
        { id: 'wp_1', name: 'nature.jpg' }
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

  const dayBtn = container.querySelector('.wallpaper-day-btn');
  const nightBtn = container.querySelector('.wallpaper-night-btn');
  assert.ok(dayBtn, 'Day button should exist');
  assert.ok(nightBtn, 'Night button should exist');

  // Clicking night button sets nightId
  await nightBtn._on_click({ stopPropagation: () => {} });
  assert.equal(store.get().settings.background.nightId, 'wp_1');
});
