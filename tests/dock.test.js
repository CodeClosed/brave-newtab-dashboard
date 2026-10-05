// @ts-check
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  togglePinBookmark,
  pinBookmark,
  isBookmarkPinned,
  getPinnedBookmarks,
  reorderPinnedBookmark,
  moveDockItem
} from '../extension/js/features/pinned.js';
import {
  applyDockPosition,
  renderDock,
  initDock
} from '../extension/js/features/dock.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

// Setup minimal DOM mock if running in Node environment
function setupDomMock() {
  const elements = new Map();

  function createMockElement(tag = 'div') {
    const classListSet = new Set();
    const listeners = new Map();
    const children = [];
    let _className = '';
    const elMock = {
      tagName: tag.toUpperCase(),
      dataset: {},
      style: {},
      hidden: false,
      tabIndex: 0,
      draggable: false,
      title: '',
      href: '',
      children,
      get firstChild() { return children[0] || null; },
      get className() { return _className; },
      set className(val) {
        _className = String(val);
        classListSet.clear();
        _className.split(/\s+/).filter(Boolean).forEach((c) => classListSet.add(c));
      },
      setAttribute: (k, v) => { elMock[k] = v; },
      getAttribute: (k) => elMock[k] ?? null,
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
      appendChild: (child) => {
        children.push(child);
        return child;
      },
      removeChild: (child) => {
        const idx = children.indexOf(child);
        if (idx !== -1) children.splice(idx, 1);
        return child;
      },
      addEventListener: (evt, handler) => {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt).push(handler);
      },
      removeEventListener: (evt, handler) => {
        if (listeners.has(evt)) {
          const arr = listeners.get(evt);
          const i = arr.indexOf(handler);
          if (i !== -1) arr.splice(i, 1);
        }
      },
      dispatchEvent: (evt) => {
        const arr = listeners.get(evt.type) || [];
        arr.forEach((fn) => fn(evt));
      },
      querySelectorAll: (sel) => {
        const results = [];
        function walk(node) {
          if (sel.startsWith('.') && node.classList?.contains(sel.slice(1))) {
            results.push(node);
          }
          (node.children || []).forEach(walk);
        }
        walk(elMock);
        return results;
      },
      querySelector: (sel) => {
        const all = elMock.querySelectorAll(sel);
        return all[0] || null;
      },
      getBoundingClientRect: () => ({ top: 10, left: 10, width: 36, height: 36 }),
      contains: (target) => {
        if (target === elMock) return true;
        return children.some((c) => c === target || (c.contains && c.contains(target)));
      }
    };
    return elMock;
  }

  const mockBody = createMockElement('body');
  mockBody.dataset = {};

  // @ts-ignore
  globalThis.document = {
    body: mockBody,
    createElement: (tag) => createMockElement(tag),
    createTextNode: (text) => {
      const t = createMockElement('#text');
      t.textContent = String(text);
      return t;
    },
    getElementById: (id) => elements.get(id) || null
  };

  return { mockBody, createMockElement };
}

test('11.1 Dock Cap: defaults to 12 items and rejects 13th bookmark', () => {
  const data = createDefaultDashboardData();
  data.spaces[0].pinned = [];
  store.replaceData(data);

  // Default cap from schema is 12
  assert.equal(data.settings.dock.maxItems, 12);

  // Pin 12 bookmarks
  for (let i = 1; i <= 12; i++) {
    const res = togglePinBookmark(`bm-slot-${i}`);
    assert.equal(res.success, true, `Should pin bookmark ${i}`);
    assert.equal(res.pinned, true);
  }

  assert.equal(store.getState().spaces[0].pinned.length, 12);

  // 13th bookmark must be rejected
  const res13 = togglePinBookmark('bm-slot-13');
  assert.equal(res13.success, false);
  assert.equal(res13.pinned, false);
  assert.ok(res13.reason.includes('Maximum 12 pinned bookmarks reached'));
  assert.equal(store.getState().spaces[0].pinned.length, 12);
});

test('11.1 Custom Dock Cap: respects custom maxItems setting', () => {
  const data = createDefaultDashboardData();
  data.spaces[0].pinned = [];
  data.settings.dock.maxItems = 5;
  store.replaceData(data);

  for (let i = 1; i <= 5; i++) {
    const res = togglePinBookmark(`item-${i}`);
    assert.equal(res.success, true);
  }
  assert.equal(store.getState().spaces[0].pinned.length, 5);

  const res6 = togglePinBookmark('item-6');
  assert.equal(res6.success, false);
  assert.ok(res6.reason.includes('Maximum 5 pinned bookmarks reached'));
});

test('11.2 Dock Positions: top, bottom, left, right, off', () => {
  const { mockBody, createMockElement } = setupDomMock();
  const dock = createMockElement('nav');

  // Position top
  applyDockPosition(dock, 'top');
  assert.equal(dock.dataset.position, 'top');
  assert.equal(mockBody.dataset.dockPosition, 'top');
  assert.equal(dock.hidden, false);

  // Position bottom
  applyDockPosition(dock, 'bottom');
  assert.equal(dock.dataset.position, 'bottom');
  assert.equal(mockBody.dataset.dockPosition, 'bottom');

  // Position left
  applyDockPosition(dock, 'left');
  assert.equal(dock.dataset.position, 'left');
  assert.equal(mockBody.dataset.dockPosition, 'left');

  // Position right
  applyDockPosition(dock, 'right');
  assert.equal(dock.dataset.position, 'right');
  assert.equal(mockBody.dataset.dockPosition, 'right');

  // Position off
  applyDockPosition(dock, 'off');
  assert.equal(dock.dataset.position, 'off');
  assert.equal(dock.hidden, true);
  assert.equal(dock.style.display, 'none');
});

test('11.4 Dock Reorder: reorderPinnedBookmark and moveDockItem', () => {
  const data = createDefaultDashboardData();
  data.spaces[0].pinned = ['a', 'b', 'c', 'd'];
  store.replaceData(data);

  // Move index 0 ('a') to index 2: resulting order should be ['b', 'c', 'a', 'd']
  const reorderOk = reorderPinnedBookmark(0, 2);
  assert.equal(reorderOk, true);
  assert.deepEqual(store.getState().spaces[0].pinned, ['b', 'c', 'a', 'd']);

  // Move 'a' left by 1: resulting order should be ['b', 'a', 'c', 'd']
  const newIdx = moveDockItem('a', -1);
  assert.equal(newIdx, 1);
  assert.deepEqual(store.getState().spaces[0].pinned, ['b', 'a', 'c', 'd']);

  // Move 'b' left when already at index 0 should clamp
  const clampedIdx = moveDockItem('b', -1);
  assert.equal(clampedIdx, 0);
  assert.deepEqual(store.getState().spaces[0].pinned, ['b', 'a', 'c', 'd']);

  // Direct pin with target index
  pinBookmark('new-item', 1);
  assert.deepEqual(store.getState().spaces[0].pinned, ['b', 'new-item', 'a', 'c', 'd']);
});

test('11.4 Deleting a bookmark removes it from the dock', () => {
  const data = createDefaultDashboardData();
  const cat = data.categories[0];
  const bm1 = cat.bookmarks[0];
  const bm2 = cat.bookmarks[1];

  data.spaces[0].pinned = [bm1.id, bm2.id];
  store.replaceData(data);

  assert.equal(isBookmarkPinned(bm1.id), true);
  assert.equal(isBookmarkPinned(bm2.id), true);

  // Delete bm1
  store.deleteBookmark(cat.id, bm1.id);

  assert.equal(isBookmarkPinned(bm1.id), false);
  assert.equal(isBookmarkPinned(bm2.id), true);
  assert.deepEqual(store.getState().spaces[0].pinned, [bm2.id]);
});

test('11.4 Deleting a category removes all its bookmarks from the dock', () => {
  const data = createDefaultDashboardData();
  const cat = data.categories[0];
  const catBmIds = cat.bookmarks.map((b) => b.id);

  data.spaces[0].pinned = [...catBmIds, 'external-bm'];
  store.replaceData(data);

  // Delete category
  store.deleteCategory(cat.id);

  assert.deepEqual(store.getState().spaces[0].pinned, ['external-bm']);
});

test('11.1 & 11.3 Dock Rendering: renders items with tooltips, favicons, draggable, and auto-hide', () => {
  const { createMockElement } = setupDomMock();
  const data = createDefaultDashboardData();
  const cat = data.categories[0];
  data.spaces[0].pinned = [cat.bookmarks[0].id, cat.bookmarks[1].id];
  data.settings.dock.position = 'top';
  data.settings.dock.autoHide = true;
  store.replaceData(data);

  const container = createMockElement('nav');
  renderDock(container, data);

  assert.equal(container.dataset.position, 'top');
  assert.equal(container.dataset.autohide, 'true');
  assert.equal(container.hidden, false);

  const items = container.querySelectorAll('.app-dock-item');
  assert.equal(items.length, 2);

  const firstItem = items[0];
  assert.ok(firstItem.draggable === true || firstItem.draggable === 'true');
  assert.equal(firstItem.href, cat.bookmarks[0].url);
  assert.equal(firstItem.dataset.id, cat.bookmarks[0].id);
  assert.ok(firstItem.title.includes(cat.bookmarks[0].name));
});
