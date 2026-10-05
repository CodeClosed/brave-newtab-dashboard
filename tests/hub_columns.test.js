// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  filterHubCollections,
  toggleHubView,
  getRememberedTab,
  setRememberedTab,
  renderTabbedHub
} from '../extension/js/features/hub.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

beforeEach(() => {
  globalThis.document = {
    createElement: (tag) => {
      const attrs = {};
      const classListSet = new Set();
      const listeners = new Map();
      const el = {
        tagName: tag.toUpperCase(),
        attrs,
        children: [],
        style: {},
        dataset: {},
        get className() { return Array.from(classListSet).join(' '); },
        set className(v) {
          classListSet.clear();
          String(v).split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
        },
        classList: {
          add: (...cls) => cls.forEach(c => classListSet.add(c)),
          remove: (...cls) => cls.forEach(c => classListSet.delete(c)),
          contains: (c) => classListSet.has(c)
        },
        addEventListener(evt, handler) {
          if (!listeners.has(evt)) listeners.set(evt, []);
          listeners.get(evt).push(handler);
        },
        dispatchEvent(evt) {
          const arr = listeners.get(evt.type) || [];
          arr.forEach(fn => fn(evt));
        },
        setAttribute(k, v) {
          attrs[k] = String(v);
          if (k === 'id') el.id = String(v);
        },
        getAttribute(k) { return attrs[k] ?? null; },
        hasAttribute(k) { return k in attrs; },
        appendChild(c) {
          if (c) {
            c.parentNode = el;
            el.children.push(c);
          }
          return c;
        },
        querySelector: (sel) => {
          for (const c of el.children) {
            if (sel.startsWith('.') && (c.className || '').includes(sel.slice(1))) return c;
            if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
            const sub = c.querySelector?.(sel);
            if (sub) return sub;
          }
          return null;
        },
        querySelectorAll: (sel) => {
          const res = [];
          function rec(n) {
            for (const c of n.children || []) {
              if (sel.startsWith('.') && (c.className || '').includes(sel.slice(1))) res.push(c);
              if (sel.startsWith('#') && c.id === sel.slice(1)) res.push(c);
              rec(c);
            }
          }
          rec(el);
          return res;
        }
      };
      return el;
    },
    createTextNode: (t) => ({ textContent: t, nodeType: 3 })
  };
});

afterEach(() => {
  delete globalThis.document;
});

test('12.4 Hub Filtering: filterHubCollections filters by category name and bookmark title/URL', () => {
  const categories = [
    {
      id: 'c1',
      name: 'Development',
      icon: '💻',
      order: 0,
      collapsed: false,
      bookmarks: [
        { id: 'b1', name: 'GitHub', url: 'https://github.com', order: 0 },
        { id: 'b2', name: 'Stack Overflow', url: 'https://stackoverflow.com', order: 1 }
      ]
    },
    {
      id: 'c2',
      name: 'Reading',
      icon: '📚',
      order: 1,
      collapsed: false,
      bookmarks: [
        { id: 'b3', name: 'Wikipedia', url: 'https://wikipedia.org', order: 0 },
        { id: 'b4', name: 'Substack', url: 'https://substack.com', order: 1 }
      ]
    }
  ];

  // Empty query returns all categories
  assert.equal(filterHubCollections(categories, '').length, 2);
  assert.equal(filterHubCollections(categories, '   ').length, 2);

  // Match category name
  const matchDev = filterHubCollections(categories, 'develop');
  assert.equal(matchDev.length, 1);
  assert.equal(matchDev[0].id, 'c1');
  assert.equal(matchDev[0].bookmarks.length, 2);

  // Match bookmark title
  const matchWiki = filterHubCollections(categories, 'wikipedia');
  assert.equal(matchWiki.length, 1);
  assert.equal(matchWiki[0].id, 'c2');
  assert.equal(matchWiki[0].bookmarks.length, 1);
  assert.equal(matchWiki[0].bookmarks[0].name, 'Wikipedia');

  // Match bookmark URL
  const matchUrl = filterHubCollections(categories, 'stackoverflow');
  assert.equal(matchUrl.length, 1);
  assert.equal(matchUrl[0].id, 'c1');
  assert.equal(matchUrl[0].bookmarks.length, 1);

  // No match
  const noMatch = filterHubCollections(categories, 'nonexistent query 12345');
  assert.equal(noMatch.length, 0);
});

test('12.5 Hub View Toggle: toggleHubView switches between columns and tabs', () => {
  const data = createDefaultDashboardData();
  data.settings.hub = { view: 'columns' };
  store.replaceData(data);

  const view1 = toggleHubView(store);
  assert.equal(view1, 'tabs');
  assert.equal(store.getState().settings.hub.view, 'tabs');

  const view2 = toggleHubView(store);
  assert.equal(view2, 'columns');
  assert.equal(store.getState().settings.hub.view, 'columns');
});

test('12.5 Tabbed Stack View: renders pill tabs and remembers active tab per space', () => {
  const categories = [
    {
      id: 'cat-alpha',
      name: 'Alpha Collection',
      icon: '🚀',
      color: 'blue',
      order: 0,
      collapsed: false,
      bookmarks: [{ id: 'b1', name: 'Alpha Bookmark', url: 'https://alpha.test', order: 0 }]
    },
    {
      id: 'cat-beta',
      name: 'Beta Collection',
      icon: '⭐',
      color: 'green',
      order: 1,
      collapsed: false,
      bookmarks: [{ id: 'b2', name: 'Beta Bookmark', url: 'https://beta.test', order: 0 }]
    }
  ];

  setRememberedTab('space-1', 'cat-beta');
  assert.equal(getRememberedTab('space-1', categories), 'cat-beta');

  // Container mock
  const container = document.createElement('div');
  renderTabbedHub(categories, container, { spaceId: 'space-1' });

  const tabs = container.querySelectorAll('.hub-tab-btn');
  assert.equal(tabs.length, 2);

  // Beta should be active
  const betaTab = container.querySelector('#hub-tab-cat-beta');
  assert.ok(betaTab);
  assert.equal(betaTab.getAttribute('aria-selected'), 'true');
  assert.ok(betaTab.className.includes('active'));

  const panel = container.querySelector('#hub-panel-cat-beta');
  assert.ok(panel);
});

test('12.2 Responsive Columns Stylesheet: defines responsive 5, 4, 3, 2, 1 columns in base.css', () => {
  const cssPath = path.resolve('extension/css/base.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(css.includes('repeat(5, minmax(0, 1fr))'), 'base.css must define 5 columns');
  assert.ok(css.includes('repeat(4, minmax(0, 1fr))'), 'base.css must define 4 columns');
  assert.ok(css.includes('repeat(3, minmax(0, 1fr))'), 'base.css must define 3 columns');
  assert.ok(css.includes('repeat(2, minmax(0, 1fr))'), 'base.css must define 2 columns');
  assert.ok(css.includes('grid-template-columns: 1fr'), 'base.css must define 1 column');
});
