import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let docBody = null;
let activeModalDialog = null;

class MockDialog {
  constructor() {
    this.tagName = 'DIALOG';
    this.attrs = {};
    this.listeners = {};
    this.children = [];
    this.className = '';
    this.style = {};
    this.open = false;
    const classes = new Set();
    this.classList = {
      add: (c) => { classes.add(c); this.className = [...classes].join(' '); },
      remove: (c) => { classes.delete(c); this.className = [...classes].join(' '); },
      contains: (c) => classes.has(c)
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(k, fn) {
    this.listeners[k] = this.listeners[k] || [];
    this.listeners[k].push(fn);
  }
  dispatchEvent(evt) {
    if (this.listeners[evt.type]) {
      for (const fn of this.listeners[evt.type]) fn(evt);
    }
  }
  showModal() {
    this.open = true;
    activeModalDialog = this;
  }
  close() {
    this.open = false;
    if (activeModalDialog === this) activeModalDialog = null;
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  querySelector(sel) {
    for (const c of this.children || []) {
      if (matches(c, sel)) return c;
      const sub = c.querySelector?.(sel);
      if (sub) return sub;
    }
    return null;
  }
  querySelectorAll(sel) {
    const res = [];
    function recurse(n) {
      for (const c of n.children || []) {
        if (matches(c, sel)) res.push(c);
        recurse(c);
      }
    }
    recurse(this);
    return res;
  }
  contains(node) {
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }
  getBoundingClientRect() {
    return { top: 0, bottom: 768, left: 624, right: 1024, width: 400, height: 768 };
  }
}

function matches(node, sel) {
  if (!node) return false;
  if (sel.startsWith('.')) return (node.className || '').includes(sel.slice(1));
  if (sel.startsWith('#')) return node.id === sel.slice(1);
  return false;
}

beforeEach(() => {
  activeModalDialog = null;
  const mockElements = [];
  globalThis.document = {
    body: {
      appendChild: (el) => { el.parentNode = globalThis.document.body; mockElements.push(el); },
      removeChild: (el) => { const idx = mockElements.indexOf(el); if (idx !== -1) mockElements.splice(idx, 1); },
      contains: (el) => mockElements.includes(el)
    },
    createTextNode: (text) => ({ textContent: text, nodeType: 3 }),
    createElement: (tag) => {
      if (tag.toLowerCase() === 'dialog') {
        return new MockDialog();
      }
      const classes = new Set();
      const el = {
        tagName: tag.toUpperCase(),
        attrs: {},
        listeners: {},
        children: [],
        className: '',
        style: {},
        dataset: {},
        classList: {
          add: (c) => { classes.add(c); el.className = [...classes].join(' '); },
          remove: (c) => { classes.delete(c); el.className = [...classes].join(' '); },
          contains: (c) => classes.has(c)
        },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return this.attrs[k] ?? null; },
        addEventListener(k, fn) { this.listeners[k] = this.listeners[k] || []; this.listeners[k].push(fn); },
        appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
        removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); return c; },
        focus() { globalThis.document.activeElement = this; },
        querySelector: (sel) => {
          for (const c of el.children || []) {
            if (matches(c, sel)) return c;
            const sub = c.querySelector?.(sel);
            if (sub) return sub;
          }
          return null;
        },
        querySelectorAll: (sel) => {
          const res = [];
          function rec(n) {
            for (const c of n.children || []) {
              if (matches(c, sel)) res.push(c);
              rec(c);
            }
          }
          rec(this);
          return res;
        }
      };
      return el;
    },
    activeElement: null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
  };
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
});

test('B2: settings drawer is built on native <dialog> with aria-labelledby', async () => {
  const { openDrawer, closeDrawer, _getDrawerElementForTests } = await import('../extension/js/ui/drawer.js');

  const triggerBtn = globalThis.document.createElement('button');
  triggerBtn.focus();
  assert.equal(globalThis.document.activeElement, triggerBtn);

  openDrawer('appearance');

  const drawer = _getDrawerElementForTests ? _getDrawerElementForTests() : null;
  assert.notEqual(drawer, null, 'Drawer element must exist');
  assert.equal(drawer.tagName, 'DIALOG', 'Drawer must be a native <dialog> element');
  assert.equal(drawer.open, true, 'Drawer must be opened via showModal()');
  assert.equal(drawer.getAttribute('aria-labelledby'), 'settings-drawer-title');

  // Verify close returns focus to trigger
  closeDrawer();
  assert.equal(drawer.open, false, 'Drawer must be closed');
  assert.equal(globalThis.document.activeElement, triggerBtn, 'Must return focus to trigger on close');
});
