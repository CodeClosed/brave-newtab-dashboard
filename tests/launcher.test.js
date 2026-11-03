// @ts-check
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import {
  ensureLauncherDOM,
  openAppLauncher,
  closeAppLauncher,
  toggleAppLauncher,
  ensureUncategorizedCategory,
  positionAndMountContextMenu,
  closeContextMenu
} from '../extension/js/ui/launcher.js';

function setupDomMock() {
  const listeners = new Map();
  const children = [];
  const classListSet = new Set();
  let _className = '';

  const mockDialog = {
    tagName: 'DIALOG',
    open: false,
    dataset: {},
    style: {},
    children,
    get className() { return _className; },
    set className(val) {
      _className = String(val);
      classListSet.clear();
      _className.split(/\s+/).filter(Boolean).forEach((c) => classListSet.add(c));
    },
    classList: {
      add: (...cls) => {
        cls.forEach((c) => classListSet.add(c));
        _className = Array.from(classListSet).join(' ');
      },
      remove: (...cls) => {
        cls.forEach((c) => classListSet.delete(c));
        _className = Array.from(classListSet).join(' ');
      },
      contains: (c) => classListSet.has(c)
    },
    setAttribute: (k, v) => { mockDialog[k] = v; },
    getAttribute: (k) => mockDialog[k] ?? null,
    addEventListener: (evt, fn) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    },
    removeEventListener: (evt, fn) => {
      const arr = listeners.get(evt) || [];
      const idx = arr.indexOf(fn);
      if (idx !== -1) arr.splice(idx, 1);
    },
    dispatchEvent: (evt) => {
      (listeners.get(evt.type) || []).forEach(fn => fn(evt));
    },
    appendChild: (child) => {
      child.parentNode = mockDialog;
      children.push(child);
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
      return child;
    },
    querySelectorAll: (sel) => {
      const results = [];
      function walk(node) {
        if (!node) return;
        if (sel.startsWith('.') && node.classList?.contains(sel.slice(1))) {
          results.push(node);
        }
        (node.children || []).forEach(walk);
      }
      walk(mockDialog);
      return results;
    },
    querySelector: (sel) => {
      const all = mockDialog.querySelectorAll(sel);
      return all[0] || null;
    },
    showModal: () => { mockDialog.open = true; },
    close: () => { mockDialog.open = false; },
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ top: 10, left: 10, right: 800, bottom: 600 })
  };

  const bodyChildren = [];
  const mockBody = {
    appendChild: (c) => { bodyChildren.push(c); return c; },
    contains: (c) => bodyChildren.includes(c),
    clientWidth: 1000,
    clientHeight: 800,
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 1000, bottom: 800 })
  };

  // @ts-ignore
  globalThis.document = {
    body: mockBody,
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => {
      if (tag.toLowerCase() === 'dialog') return mockDialog;
      const elChildren = [];
      const cSet = new Set();
      let cName = '';
      const thisNode = {
        tagName: tag.toUpperCase(),
        dataset: {},
        style: {},
        children: elChildren,
        get className() { return cName; },
        set className(v) {
          cName = String(v);
          cSet.clear();
          cName.split(/\s+/).filter(Boolean).forEach(c => cSet.add(c));
        },
        classList: {
          add: (...c) => { c.forEach(x => cSet.add(x)); cName = Array.from(cSet).join(' '); },
          remove: (...c) => { c.forEach(x => cSet.delete(x)); cName = Array.from(cSet).join(' '); },
          contains: (x) => cSet.has(x)
        },
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: (child) => {
          child.parentNode = thisNode;
          elChildren.push(child);
          return child;
        },
        removeChild: (child) => {
          const idx = elChildren.indexOf(child);
          if (idx !== -1) elChildren.splice(idx, 1);
          child.parentNode = null;
          return child;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        contains: (target) => target === thisNode || elChildren.includes(target),
        querySelectorAll: () => [],
        querySelector: () => null,
        focus: () => {}
      };
      return thisNode;
    },
    createElementNS: (ns, tag) => {
      return globalThis.document.createElement(tag);
    }
  };

  return { mockDialog };
}

test('App Launcher: creates modal DOM, opens, toggles, and closes cleanly', () => {
  const { mockDialog } = setupDomMock();
  const data = createDefaultDashboardData();
  store.replaceData(data);

  const dialog = ensureLauncherDOM();
  assert.ok(dialog);

  openAppLauncher();
  assert.equal(mockDialog.open, true);
  assert.equal(mockDialog.classList.contains('open'), true);

  toggleAppLauncher();
  assert.equal(mockDialog.open, false);
  assert.equal(mockDialog.classList.contains('open'), false);

  toggleAppLauncher();
  assert.equal(mockDialog.open, true);

  closeAppLauncher();
  assert.equal(mockDialog.open, false);
});

test('App Launcher: ensureUncategorizedCategory creates Quick Apps collection for standalone bookmarks', () => {
  const { mockDialog } = setupDomMock();
  const data = createDefaultDashboardData();
  store.replaceData(data);

  const state = store.get();
  const activeSpaceId = state.activeSpaceId;
  const quickCat = ensureUncategorizedCategory(state, activeSpaceId);

  assert.ok(quickCat);
  assert.equal(quickCat.name, 'Quick Apps');
  assert.equal(quickCat.icon, 'zap');

  // Calling again returns existing instance without duplicate creation
  const existing = ensureUncategorizedCategory(store.get(), activeSpaceId);
  assert.equal(existing.id, quickCat.id);
});

test('App Launcher: moving bookmarks between folders and standalone apps works via store', () => {
  const data = createDefaultDashboardData();
  store.replaceData(data);

  const state = store.get();
  const sourceCat = state.categories[0];
  const targetCat = state.categories[1];
  const bmToMove = sourceCat.bookmarks[0];

  assert.ok(bmToMove);
  const initialSourceCount = sourceCat.bookmarks.length;
  const initialTargetCount = targetCat.bookmarks.length;

  store.moveBookmark(sourceCat.id, targetCat.id, bmToMove.id);

  const updatedState = store.get();
  const updatedSource = updatedState.categories.find(c => c.id === sourceCat.id);
  const updatedTarget = updatedState.categories.find(c => c.id === targetCat.id);

  assert.equal(updatedSource.bookmarks.length, initialSourceCount - 1);
  assert.equal(updatedTarget.bookmarks.length, initialTargetCount + 1);
  assert.ok(updatedTarget.bookmarks.some(b => b.id === bmToMove.id));
});

test('App Launcher: positionAndMountContextMenu mounts inside modal dialog and closes cleanly', () => {
  const { mockDialog } = setupDomMock();
  const data = createDefaultDashboardData();
  store.replaceData(data);

  ensureLauncherDOM();
  openAppLauncher();

  const fakeMenu = globalThis.document.createElement('div');
  fakeMenu.className = 'launcher-context-menu';

  const fakeTarget = {
    getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 150, right: 170 })
  };

  const fakeEvent = {
    currentTarget: fakeTarget,
    preventDefault: () => {},
    stopPropagation: () => {}
  };

  positionAndMountContextMenu(fakeMenu, fakeEvent);

  // Must mount inside dialog (or launcherModal), not isolated body outside top-layer
  assert.ok(mockDialog.children.includes(fakeMenu));
  assert.equal(fakeMenu.style.position, 'absolute');
  assert.ok(parseInt(fakeMenu.style.top, 10) > 0);
  assert.ok(parseInt(fakeMenu.style.left, 10) > 0);

  closeContextMenu();
  assert.ok(!mockDialog.children.includes(fakeMenu));
});

test('App Launcher: pinning an app from Quick Apps or folder adds it to navbar and updates state', async () => {
  const { isBookmarkPinned, togglePinBookmark, pinBookmark } = await import('../extension/js/features/pinned.js');
  const { mockDialog } = setupDomMock();
  const data = createDefaultDashboardData();
  store.replaceData(data);

  ensureLauncherDOM();
  openAppLauncher();

  const state = store.get();
  const bm = state.categories[0].bookmarks[0];

  assert.equal(isBookmarkPinned(bm.id), false);

  // Pin the app
  const pinRes = togglePinBookmark(bm.id);
  assert.equal(pinRes.success, true);
  assert.equal(pinRes.pinned, true);
  assert.equal(isBookmarkPinned(bm.id), true);

  // Active space has the pinned bookmark
  const activeSpace = store.get().spaces.find(s => s.id === store.get().activeSpaceId);
  assert.ok(activeSpace.pinned.includes(bm.id));

  // Unpin the app
  const unpinRes = togglePinBookmark(bm.id);
  assert.equal(unpinRes.success, true);
  assert.equal(unpinRes.pinned, false);
  assert.equal(isBookmarkPinned(bm.id), false);
  assert.ok(!store.get().spaces.find(s => s.id === store.get().activeSpaceId).pinned.includes(bm.id));
});

test('App Launcher: pinning all folder apps adds them to active space navbar dock up to max items', async () => {
  const { isBookmarkPinned, pinBookmark } = await import('../extension/js/features/pinned.js');
  const data = createDefaultDashboardData();
  store.replaceData(data);

  const state = store.get();
  const folder = state.categories[0];
  assert.ok(folder.bookmarks.length > 0);

  let pinnedCount = 0;
  for (const b of folder.bookmarks) {
    if (!isBookmarkPinned(b.id)) {
      const res = pinBookmark(b.id);
      if (res.success && !res.alreadyPinned) pinnedCount++;
    }
  }

  assert.ok(pinnedCount > 0);
  for (const b of folder.bookmarks) {
    assert.equal(isBookmarkPinned(b.id), true);
  }
});


