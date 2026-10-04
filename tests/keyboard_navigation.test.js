// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

function createMockElement(tag) {
  const attrs = {};
  const listeners = {};
  const children = [];
  const el = Object.create(MockNode.prototype);
  Object.assign(el, {
    tagName: tag.toUpperCase(),
    style: {},
    className: '',
    dataset: {},
    id: '',
    tabIndex: 0,
    classList: {
      add: (c) => { el.className = (el.className ? el.className + ' ' : '') + c; },
      remove: (c) => { el.className = (el.className || '').replace(c, '').trim(); },
      contains: (c) => (el.className || '').includes(c)
    },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k] ?? null,
    hasAttribute: (k) => k in attrs,
    removeAttribute: (k) => { delete attrs[k]; },
    addEventListener: (k, fn) => {
      listeners[k] = listeners[k] || [];
      listeners[k].push(fn);
    },
    removeEventListener: (k, fn) => {
      if (listeners[k]) listeners[k] = listeners[k].filter(f => f !== fn);
    },
    dispatchEvent: (evt) => {
      if (!evt.stopPropagation) evt.stopPropagation = () => {};
      if (!evt.preventDefault) evt.preventDefault = () => {};
      if (listeners[evt.type]) {
        for (const fn of listeners[evt.type]) fn(evt);
      }
      return true;
    },
    click: () => {
      const evt = { type: 'click', target: el, stopPropagation: () => {}, preventDefault: () => {} };
      el.dispatchEvent(evt);
    },
    focus: () => {
      globalThis.document.activeElement = el;
    },
    appendChild: (child) => {
      if (typeof child === 'string') {
        child = { nodeType: 3, textContent: child, parentNode: el };
      } else {
        child.parentNode = el;
      }
      children.push(child);
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    },
    querySelector: (sel) => {
      function find(node) {
        for (const c of node.children || []) {
          if (matches(c, sel)) return c;
          const sub = find(c);
          if (sub) return sub;
        }
        return null;
      }
      return find(el);
    },
    querySelectorAll: (sel) => {
      const res = [];
      function recurse(node) {
        for (const c of node.children || []) {
          if (matches(c, sel)) res.push(c);
          recurse(c);
        }
      }
      recurse(el);
      return res;
    },
    contains: (other) => {
      let cur = other;
      while (cur) {
        if (cur === el) return true;
        cur = cur.parentNode;
      }
      return false;
    },
    get children() { return children; },
    get firstChild() { return children[0] || null; }
  });

  Object.defineProperty(el, 'textContent', {
    get() {
      if (children.length > 0) {
        return children.map(c => c.textContent || '').join('');
      }
      return attrs['text'] || '';
    },
    set(v) {
      children.length = 0;
      children.push({ nodeType: 3, textContent: String(v), parentNode: el });
    },
    configurable: true
  });

  if (tag.toLowerCase() === 'dialog') {
    el.open = false;
    el.showModal = () => {
      el.open = true;
      el.setAttribute('open', '');
    };
    el.close = () => {
      el.open = false;
      el.removeAttribute('open');
      el.dispatchEvent({ type: 'close' });
    };
  }

  function matches(node, sel) {
    if (!node || typeof node.getAttribute !== 'function') return false;
    if (sel.includes(' ')) {
      const parts = sel.split(' ').filter(Boolean);
      const last = parts[parts.length - 1];
      if (!matches(node, last)) return false;
      let ancestor = node.parentNode;
      let pIdx = parts.length - 2;
      while (ancestor && pIdx >= 0) {
        if (matches(ancestor, parts[pIdx])) {
          pIdx--;
        }
        ancestor = ancestor.parentNode;
      }
      return pIdx < 0;
    }
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return (node.className || '').includes(cls);
    }
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      return node.id === id || node.getAttribute('id') === id;
    }
    if (sel.includes('[')) {
      const match = sel.match(/^([a-zA-Z0-9_-]+)?\[([a-zA-Z0-9_-]+)(?:="([^"]+)")?\]$/);
      if (match) {
        const tagMatch = !match[1] || node.tagName.toLowerCase() === match[1].toLowerCase();
        const attrVal = node.getAttribute(match[2]);
        if (match[3] !== undefined) return tagMatch && attrVal === match[3];
        return tagMatch && node.hasAttribute(match[2]);
      }
    }
    return node.tagName.toLowerCase() === sel.toLowerCase();
  }

  return el;
}

class MockNode {}
// @ts-ignore
globalThis.Node = MockNode;

let docBody;

beforeEach(async () => {
  docBody = createMockElement('body');
  const winListeners = {};
  // @ts-ignore
  globalThis.document = {
    body: docBody,
    activeElement: docBody,
    createElement: (tag) => createMockElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    getElementById: (id) => {
      function find(node) {
        if (node.id === id) return node;
        for (const c of node.children || []) {
          const res = find(c);
          if (res) return res;
        }
        return null;
      }
      return find(docBody);
    },
    querySelector: (sel) => {
      if (sel === 'dialog[open], .settings-drawer.open') {
        const d = docBody.querySelector('dialog[open]');
        if (d) return d;
        return docBody.querySelector('.settings-drawer.open');
      }
      return docBody.querySelector(sel);
    },
    querySelectorAll: (sel) => docBody.querySelectorAll(sel),
    addEventListener: (type, fn) => {
      docBody.addEventListener(type, fn);
    },
    removeEventListener: (type, fn) => {
      docBody.removeEventListener(type, fn);
    }
  };

  // @ts-ignore
  globalThis.window = {
    addEventListener: (type, fn) => {
      winListeners[type] = winListeners[type] || [];
      winListeners[type].push(fn);
    },
    removeEventListener: (type, fn) => {
      if (winListeners[type]) winListeners[type] = winListeners[type].filter(f => f !== fn);
    },
    dispatchEvent: (evt) => {
      if (winListeners[evt.type]) {
        for (const fn of winListeners[evt.type]) fn(evt);
      }
    }
  };

  const { cancelJumpMode } = await import('../extension/js/features/keyboard.js');
  cancelJumpMode();
});

test('2.6 Keyboard shortcuts: opens help dialog on ? when no input is focused', async () => {
  const { initKeyboardNavigation } = await import('../extension/js/features/keyboard.js');
  initKeyboardNavigation();

  window.dispatchEvent({ type: 'keydown', key: '?', preventDefault: () => {} });

  const dialog = document.querySelector('dialog[open]');
  assert.ok(dialog, 'Shortcuts dialog should be opened on "?"');
  assert.ok(dialog.getAttribute('aria-labelledby'), 'Dialog should have aria-labelledby');
  assert.ok(dialog.querySelector('#shortcuts-dialog-title'), 'Dialog title should exist');
});

test('2.6 Keyboard shortcuts: does not trigger shortcuts when input is focused or dialog is open', async () => {
  const { initKeyboardNavigation } = await import('../extension/js/features/keyboard.js');
  initKeyboardNavigation();

  // Test when another dialog is open
  const existingDialog = document.createElement('dialog');
  existingDialog.id = 'other-dialog';
  existingDialog.setAttribute('open', '');
  existingDialog.open = true;
  document.body.appendChild(existingDialog);

  window.dispatchEvent({ type: 'keydown', key: '?', preventDefault: () => {} });
  const shortcutsDialog = document.getElementById('shortcuts-dialog');
  assert.strictEqual(shortcutsDialog?.hasAttribute('open') || false, false, 'Should not open when dialog is active');

  document.body.removeChild(existingDialog);

  // Test when an input is focused
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();

  window.dispatchEvent({ type: 'keydown', key: '?', preventDefault: () => {} });
  assert.strictEqual(shortcutsDialog?.hasAttribute('open') || false, false, 'Should not open when input is focused');
});

test('2.6 Collection jump navigation: "g" shows badges, digit 1 selects collection, second digit opens link', async () => {
  const grid = document.createElement('div');
  grid.id = 'categories-grid';
  document.body.appendChild(grid);

  const cat1 = document.createElement('div');
  cat1.className = 'category-card';
  cat1.dataset.categoryId = 'cat-1';
  const name1 = document.createElement('h2');
  name1.className = 'category-name';
  name1.textContent = 'Work';
  cat1.appendChild(name1);

  const link1 = document.createElement('a');
  link1.className = 'bookmark-link';
  link1.setAttribute('href', 'https://example.com/1');
  cat1.appendChild(link1);

  const link2 = document.createElement('a');
  link2.className = 'bookmark-link';
  link2.setAttribute('href', 'https://example.com/2');
  cat1.appendChild(link2);

  grid.appendChild(cat1);

  let openedUrl = null;
  const { initKeyboardNavigation, getJumpState } = await import('../extension/js/features/keyboard.js');
  initKeyboardNavigation({ onOpenUrl: (url) => { openedUrl = url; } });

  // Press 'g'
  window.dispatchEvent({ type: 'keydown', key: 'g', preventDefault: () => {} });
  assert.strictEqual(getJumpState().active, true, 'Jump state should be active after pressing "g"');

  let badges = document.querySelectorAll('.jump-badge');
  assert.strictEqual(badges.length, 1, 'Should render 1 badge for 1 collection');
  assert.strictEqual(badges[0].textContent, '1');

  // Press '1'
  window.dispatchEvent({ type: 'keydown', key: '1', preventDefault: () => {} });
  assert.strictEqual(getJumpState().collectionIndex, 0, 'First collection should be selected');

  badges = document.querySelectorAll('.jump-badge');
  assert.strictEqual(badges.length, 2, 'Should render 2 badges for bookmarks in collection 1');
  assert.strictEqual(badges[0].textContent, '1');
  assert.strictEqual(badges[1].textContent, '2');

  // Press '2'
  window.dispatchEvent({ type: 'keydown', key: '2', preventDefault: () => {} });
  assert.strictEqual(openedUrl, 'https://example.com/2', 'Should open link 2');
  assert.strictEqual(getJumpState().active, false, 'Jump mode should reset');
  assert.strictEqual(document.querySelectorAll('.jump-badge').length, 0, 'Badges removed');
});

test('2.6 Jump navigation: Escape cancels jump mode', async () => {
  const grid = document.createElement('div');
  grid.id = 'categories-grid';
  document.body.appendChild(grid);

  const cat1 = document.createElement('div');
  cat1.className = 'category-card';
  grid.appendChild(cat1);

  const { initKeyboardNavigation, getJumpState } = await import('../extension/js/features/keyboard.js');
  initKeyboardNavigation();

  window.dispatchEvent({ type: 'keydown', key: 'g', preventDefault: () => {} });
  assert.strictEqual(getJumpState().active, true);

  window.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {} });
  assert.strictEqual(getJumpState().active, false);
  assert.strictEqual(document.querySelectorAll('.jump-badge').length, 0);
});
