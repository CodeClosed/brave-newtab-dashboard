import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveDashboardDataImmediately,
  queueSaveDashboardData,
  onExternalStorageChange,
  _resetSyncStateForTests
} from '../extension/js/core/storage.js';

let changeListeners = [];
let mockLocalStorageData = {};

beforeEach(() => {
  changeListeners = [];
  mockLocalStorageData = {};

  // Mock chrome API
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => {
          const res = {};
          for (const k of keys) {
            res[k] = mockLocalStorageData[k];
          }
          return res;
        },
        set: async (obj) => {
          Object.assign(mockLocalStorageData, obj);
        }
      },
      onChanged: {
        addListener: (fn) => {
          changeListeners.push(fn);
        }
      }
    }
  };

  if (_resetSyncStateForTests) {
    _resetSyncStateForTests();
  }
});

afterEach(() => {
  delete globalThis.chrome;
  delete globalThis.document;
});

test('A2: ignores storage.onChanged event produced by this tab\'s own write', async () => {
  let externalChangeCallCount = 0;
  onExternalStorageChange(() => {
    externalChangeCallCount++;
  });

  const tabData = {
    version: 1,
    settings: { theme: 'dark', accent: 'blue', layout: 'grid', searchEngine: 'google', timeFormat: '24h', showClock: true, showDate: true, showGreeting: true, background: { type: 'none', value: null, dim: 0.35 } },
    categories: [{ id: 'c1', name: 'Own Write', icon: '📁', order: 0, collapsed: false, bookmarks: [] }]
  };

  // Tab saves its own data
  await saveDashboardDataImmediately(tabData);

  // Chrome fires onChanged in all tabs including the writer
  for (const listener of changeListeners) {
    listener({ dashboard: { newValue: tabData } }, 'local');
  }

  assert.equal(externalChangeCallCount, 0, 'Must ignore onChanged produced by own write');
});

test('A2: applies storage.onChanged event from a different tab with different data', async () => {
  let receivedData = null;
  onExternalStorageChange((data) => {
    receivedData = data;
  });

  const tabData = {
    version: 1,
    settings: { theme: 'light', accent: 'slate', layout: 'grid', searchEngine: 'google', timeFormat: '24h', showClock: true, showDate: true, showGreeting: true, background: { type: 'none', value: null, dim: 0.35 } },
    categories: [{ id: 'c1', name: 'Tab 1', icon: '📁', order: 0, collapsed: false, bookmarks: [] }]
  };
  await saveDashboardDataImmediately(tabData);

  const otherTabData = {
    version: 1,
    settings: { theme: 'dark', accent: 'rose', layout: 'compact', searchEngine: 'brave', timeFormat: '12h', showClock: true, showDate: true, showGreeting: true, background: { type: 'none', value: null, dim: 0.35 } },
    categories: [{ id: 'c2', name: 'External Tab 2', icon: '🚀', order: 0, collapsed: false, bookmarks: [] }]
  };

  // Another tab saves different data
  for (const listener of changeListeners) {
    listener({ dashboard: { newValue: otherTabData } }, 'local');
  }

  assert.notEqual(receivedData, null, 'Must apply external changes');
  assert.equal(receivedData.categories[0].name, 'External Tab 2');
});

test('A2: does not overwrite local state with external update while local save is pending', async () => {
  let externalChangeCallCount = 0;
  onExternalStorageChange(() => {
    externalChangeCallCount++;
  });

  const pendingData = {
    version: 1,
    settings: { theme: 'light', accent: 'slate', layout: 'grid', searchEngine: 'google', timeFormat: '24h', showClock: true, showDate: true, showGreeting: true, background: { type: 'none', value: null, dim: 0.35 } },
    categories: [{ id: 'c1', name: 'Unsaved Local Edit', icon: '📁', order: 0, collapsed: false, bookmarks: [] }]
  };

  // Local write is queued (in debounce window)
  queueSaveDashboardData(pendingData);

  // Incoming external update arrives before debounce completes
  const externalData = {
    version: 1,
    settings: { theme: 'dark', accent: 'slate', layout: 'grid', searchEngine: 'google', timeFormat: '24h', showClock: true, showDate: true, showGreeting: true, background: { type: 'none', value: null, dim: 0.35 } },
    categories: [{ id: 'c2', name: 'Incoming Conflict', icon: '📁', order: 0, collapsed: false, bookmarks: [] }]
  };

  for (const listener of changeListeners) {
    listener({ dashboard: { newValue: externalData } }, 'local');
  }

  assert.equal(externalChangeCallCount, 0, 'Must not apply external update while local save is pending');
});

test('A2: defers applying external update while a drag is active, applying on dragend', async () => {
  let appliedData = null;
  const dragListeners = {};

  // Mock DOM document with drag listeners and an active .is-dragging element
  let hasDraggingElement = true;
  globalThis.document = {
    querySelector: (sel) => {
      if (sel === '.is-dragging' && hasDraggingElement) {
        return {};
      }
      return null;
    },
    addEventListener: (event, handler) => {
      dragListeners[event] = handler;
    }
  };

  onExternalStorageChange((data) => {
    appliedData = data;
  });

  const externalData = {
    version: 1,
    settings: { theme: 'dark', accent: 'slate', layout: 'grid', searchEngine: 'google', timeFormat: '24h', showClock: true, showDate: true, showGreeting: true, background: { type: 'none', value: null, dim: 0.35 } },
    categories: [{ id: 'c3', name: 'External While Dragging', icon: '📁', order: 0, collapsed: false, bookmarks: [] }]
  };

  // External update arrives while dragging
  for (const listener of changeListeners) {
    listener({ dashboard: { newValue: externalData } }, 'local');
  }

  assert.equal(appliedData, null, 'Must defer applying update while .is-dragging is active');

  // Drag ends
  hasDraggingElement = false;
  if (dragListeners['dragend']) {
    dragListeners['dragend']();
  }

  // Allow microtask/tick
  await new Promise((r) => setTimeout(r, 10));

  assert.notEqual(appliedData, null, 'Must apply deferred external update once drag ends');
  assert.equal(appliedData.categories[0].name, 'External While Dragging');
});
