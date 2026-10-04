import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEditMode,
  setEditMode,
  toggleEditMode,
  handleInlineAddBookmark,
  startInlineRename
} from '../extension/js/features/edit-mode.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

beforeEach(() => {
  globalThis.document = {
    createElement: (tag) => {
      const attrs = {};
      const listeners = {};
      const el = {
        tagName: tag.toUpperCase(),
        attrs,
        children: [],
        className: '',
        style: {},
        dataset: {},
        value: '',
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] ?? null; },
        hasAttribute(k) { return k in attrs; },
        appendChild(c) { el.children.push(c); return c; },
        addEventListener(evt, fn) {
          listeners[evt] = listeners[evt] || [];
          listeners[evt].push(fn);
        },
        dispatchEvent(e) {
          if (listeners[e.type]) {
            listeners[e.type].forEach(fn => fn(e));
          }
        },
        focus() {},
        select() {}
      };
      return el;
    },
    createTextNode: (t) => ({ textContent: t, nodeType: 3 })
  };
});

afterEach(() => {
  delete globalThis.document;
});

test('2.2 Edit Mode: state management and toggling', () => {
  setEditMode(false);
  assert.equal(getEditMode(), false);

  const newState = toggleEditMode();
  assert.equal(newState, true);
  assert.equal(getEditMode(), true);

  setEditMode(false);
  assert.equal(getEditMode(), false);
});

test('2.2 Inline Add Bookmark: normalizes URL, defaults name to domain, and adds to category', () => {
  const fakeStore = {
    added: null,
    addBookmark(categoryId, bookmarkData) {
      this.added = { categoryId, bookmarkData };
      return { id: 'bm-test', ...bookmarkData };
    }
  };

  const res = handleInlineAddBookmark('cat-1', 'github.com/brave', fakeStore);
  assert.equal(res.success, true);
  assert.equal(res.bookmark.name, 'github.com');
  assert.equal(res.bookmark.url, 'https://github.com/brave');
  assert.equal(fakeStore.added.categoryId, 'cat-1');
  assert.equal(fakeStore.added.bookmarkData.url, 'https://github.com/brave');
  assert.equal(fakeStore.added.bookmarkData.name, 'github.com');
});

test('2.2 Inline Add Bookmark: rejects dangerous or invalid URLs', () => {
  const fakeStore = {
    addBookmark() {
      throw new Error('Should not be called');
    }
  };

  const res1 = handleInlineAddBookmark('cat-1', 'javascript:alert(1)', fakeStore);
  assert.equal(res1.success, false);
  assert.ok(res1.error);

  const res2 = handleInlineAddBookmark('cat-1', '', fakeStore);
  assert.equal(res2.success, false);
});

test('2.2 Inline Rename: Enter commits trimmed text and calls onSave', () => {
  let savedVal = null;
  let cancelled = false;

  // Mock DOM element
  let inputEl = null;
  const mockContainer = {
    textContent: 'Old Title',
    replaceChildren(el) {
      inputEl = el;
    }
  };

  const renameController = startInlineRename(mockContainer, {
    initialValue: 'Old Title',
    onSave: (val) => { savedVal = val; },
    onCancel: () => { cancelled = true; }
  });

  assert.ok(renameController);
  assert.ok(inputEl);
  assert.equal(inputEl.value, 'Old Title');

  // Simulate editing input and pressing Enter
  inputEl.value = '  New Awesome Title  ';
  renameController.commit();

  assert.equal(savedVal, 'New Awesome Title');
  assert.equal(cancelled, false);
});

test('2.2 Inline Rename: Escape cancels and calls onCancel without saving', () => {
  let savedVal = null;
  let cancelled = false;

  let inputEl = null;
  const mockContainer = {
    textContent: 'Original Title',
    replaceChildren(el) {
      inputEl = el;
    }
  };

  const renameController = startInlineRename(mockContainer, {
    initialValue: 'Original Title',
    onSave: (val) => { savedVal = val; },
    onCancel: () => { cancelled = true; }
  });

  inputEl.value = 'Different Title';
  renameController.cancel();

  assert.equal(savedVal, null);
  assert.equal(cancelled, true);
});
