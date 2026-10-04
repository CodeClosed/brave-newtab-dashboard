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
    classList: {
      add: (c) => { el.className = (el.className ? el.className + ' ' : '') + c; },
      remove: (c) => { el.className = (el.className || '').replace(c, '').trim(); },
      contains: (c) => (el.className || '').includes(c)
    },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k] ?? null,
    hasAttribute: (k) => k in attrs,
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
      if (el.onclick) el.onclick(evt);
      el.dispatchEvent(evt);
    },
    focus: () => {
      globalThis.document.activeElement = el;
    },
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 120,
      left: 100,
      right: 130,
      width: 160,
      height: 200
    }),
    appendChild: (child) => {
      child.parentNode = el;
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
      for (const c of children) {
        if (matches(c, sel)) return c;
        const sub = c.querySelector?.(sel);
        if (sub) return sub;
      }
      return null;
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

  function matches(node, sel) {
    if (!node || typeof node.getAttribute !== 'function') return false;
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return (node.className || '').includes(cls);
    }
    if (sel.includes('[')) {
      const match = sel.match(/\[([a-zA-Z-]+)(?:="([^"]+)")?\]/);
      if (match) {
        const val = node.getAttribute(match[1]);
        if (match[2] !== undefined) return val === match[2];
        return val !== null;
      }
    }
    return false;
  }

  return el;
}

class MockNode {}
globalThis.Node = MockNode;

let docBody = null;

beforeEach(() => {
  docBody = createMockElement('body');
  globalThis.Node = MockNode;
  globalThis.document = {
    body: docBody,
    createElement: (tag) => createMockElement(tag),
    createTextNode: (t) => {
      const txt = Object.create(MockNode.prototype);
      txt.textContent = String(t);
      return txt;
    },
    activeElement: null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    scrollX: 0,
    scrollY: 0,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
});

test('B1: menu trigger has aria-haspopup="menu" and aria-expanded synced', async () => {
  const { renderCategoryCard, closeActiveMenu } = await import('../extension/js/ui/components.js');

  const category = { id: 'c1', name: 'Work', icon: '💼', order: 0, collapsed: false, bookmarks: [] };
  const card = renderCategoryCard(category, 0, 1);
  const triggerBtn = card.querySelector('[aria-haspopup="menu"]');

  assert.notEqual(triggerBtn, null, 'Must have aria-haspopup="menu"');
  assert.equal(triggerBtn.getAttribute('aria-expanded'), 'false');

  // Click to open menu
  triggerBtn.click();
  assert.equal(triggerBtn.getAttribute('aria-expanded'), 'true');

  const menu = globalThis.document.body.querySelector('.menu-dropdown');
  assert.notEqual(menu, null);
  assert.equal(menu.getAttribute('role'), 'menu');

  const items = menu.querySelectorAll('[role="menuitem"]');
  assert.ok(items.length >= 3, 'Must contain menu items with role="menuitem"');

  // Close menu and verify aria-expanded reset
  closeActiveMenu();
  assert.equal(triggerBtn.getAttribute('aria-expanded'), 'false');
});

test('B1: focuses first item on open and keyboard navigation works', async () => {
  const { renderCategoryCard, closeActiveMenu } = await import('../extension/js/ui/components.js');

  const category = { id: 'c1', name: 'Work', icon: '💼', order: 0, collapsed: false, bookmarks: [] };
  const card = renderCategoryCard(category, 0, 1);
  const triggerBtn = card.querySelector('[aria-haspopup="menu"]');

  triggerBtn.click();

  const menu = globalThis.document.body.querySelector('.menu-dropdown');
  const items = menu.querySelectorAll('[role="menuitem"]');

  // First item focused on open
  assert.equal(globalThis.document.activeElement, items[0], 'First item must be focused on open');

  // ArrowDown moves to next item
  menu.dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(globalThis.document.activeElement, items[1], 'ArrowDown moves to next item');

  // End key moves to last item
  menu.dispatchEvent({ type: 'keydown', key: 'End', preventDefault: () => {} });
  assert.equal(globalThis.document.activeElement, items[items.length - 1], 'End moves to last item');

  // Home key moves to first item
  menu.dispatchEvent({ type: 'keydown', key: 'Home', preventDefault: () => {} });
  assert.equal(globalThis.document.activeElement, items[0], 'Home moves to first item');

  // Escape closes menu and returns focus to trigger
  menu.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {} });
  assert.equal(globalThis.document.body.querySelector('.menu-dropdown'), null, 'Escape closes menu');
  assert.equal(globalThis.document.activeElement, triggerBtn, 'Escape returns focus to trigger');
  assert.equal(triggerBtn.getAttribute('aria-expanded'), 'false');
});
