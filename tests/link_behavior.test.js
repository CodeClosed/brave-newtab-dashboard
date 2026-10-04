// @ts-check
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
      const evt = { type: 'click', target: el, button: 0, stopPropagation: () => {}, preventDefault: () => {} };
      el.dispatchEvent(evt);
    },
    focus: () => {
      globalThis.document.activeElement = el;
    },
    appendChild: (child) => {
      if (typeof child === 'string') {
        child = { nodeType: 3, textContent: child, parentNode: el };
      } else if (child) {
        child.parentNode = el;
      }
      if (child) children.push(child);
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

  function matches(node, sel) {
    if (!node || typeof node.getAttribute !== 'function') return false;
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return (node.className || '').includes(cls);
    }
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      return node.id === id || node.getAttribute('id') === id;
    }
    return node.tagName.toLowerCase() === sel.toLowerCase();
  }

  return el;
}

class MockNode {}
// @ts-ignore
globalThis.Node = MockNode;

let docBody;

beforeEach(() => {
  docBody = createMockElement('body');
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
    querySelector: (sel) => docBody.querySelector(sel),
    querySelectorAll: (sel) => docBody.querySelectorAll(sel),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  // @ts-ignore
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  };
});

test('2.7 Link behavior: openIn="same" renders target="_self" and full URL tooltip', async () => {
  const { store } = await import('../extension/js/core/state.js');
  await store.init();
  store.updateSettings({
    behavior: {
      openIn: 'same',
      autoHide: false,
      search: { filterBookmarks: true, calculator: true, shortcuts: [] }
    }
  });

  const { createBookmarkElement } = await import('../extension/js/ui/components.js');
  const bm = {
    id: 'test-bm-1',
    name: 'Super Long Article Title That Truncates On Normal Layouts',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a'
  };

  const item = createBookmarkElement(bm, 'test-cat-1');
  const link = item.querySelector('.bookmark-link');
  assert.ok(link, 'Bookmark link must be present');
  assert.strictEqual(link.getAttribute('href'), bm.url);
  assert.strictEqual(link.getAttribute('target') || '_self', '_self', 'openIn same should target _self or default');
  assert.strictEqual(link.getAttribute('title'), bm.url, 'title should contain the full URL for hover/focus tooltip');
  assert.strictEqual(link.getAttribute('data-tooltip'), bm.url, 'data-tooltip should contain the full URL');
});

test('2.7 Link behavior: openIn="new" renders target="_blank" with noopener rel', async () => {
  const { store } = await import('../extension/js/core/state.js');
  await store.init();
  store.updateSettings({
    behavior: {
      openIn: 'new',
      autoHide: false,
      search: { filterBookmarks: true, calculator: true, shortcuts: [] }
    }
  });

  const { createBookmarkElement } = await import('../extension/js/ui/components.js');
  const bm = {
    id: 'test-bm-2',
    name: 'Documentation Link',
    url: 'https://developer.chrome.com/docs/extensions/mv3/'
  };

  const item = createBookmarkElement(bm, 'test-cat-1');
  const link = item.querySelector('.bookmark-link');
  assert.ok(link, 'Bookmark link must be present');
  assert.strictEqual(link.getAttribute('target'), '_blank', 'openIn new should target _blank');
  assert.ok(link.getAttribute('rel')?.includes('noopener'), 'rel must include noopener');
});

test('2.7 Ellipsis truncation and CSS tooltip styles exist in stylesheet', () => {
  const css = fs.readFileSync(path.resolve('extension/css/components/cards.css'), 'utf-8');
  assert.ok(css.includes('text-overflow: ellipsis'), 'CSS must include text-overflow: ellipsis for bookmark names');
  assert.ok(css.includes('white-space: nowrap'), 'CSS must include white-space: nowrap');
  assert.ok(css.includes('overflow: hidden'), 'CSS must include overflow: hidden');
  assert.ok(css.includes('data-tooltip'), 'CSS must style data-tooltip for hover/focus preview');
});
