import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderCategoryCard } from '../extension/js/ui/components.js';

beforeEach(() => {
  globalThis.document = {
    createElement: (tag) => {
      const attrs = {};
      const el = {
        tagName: tag.toUpperCase(),
        attrs,
        children: [],
        className: '',
        style: {},
        dataset: {},
        addEventListener() {},
        setAttribute(k, v) {
          attrs[k] = String(v);
          if (k === 'id') el.id = String(v);
        },
        getAttribute(k) { return attrs[k] ?? null; },
        hasAttribute(k) { return k in attrs; },
        appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
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

test('B3: collapse button has stable accessible name, aria-expanded, and aria-controls pointing to bookmarks list', () => {
  const categoryOpen = {
    id: 'cat-test-1',
    name: 'Work Tools',
    icon: '💼',
    order: 0,
    collapsed: false,
    bookmarks: []
  };

  const cardOpen = renderCategoryCard(categoryOpen, 0, 1);
  const actionBtnsOpen = cardOpen.querySelectorAll('.icon-action-btn');
  const collapseBtnOpen = actionBtnsOpen[actionBtnsOpen.length - 1];
  const listOpen = cardOpen.querySelector('.bookmarks-list');

  assert.ok(collapseBtnOpen, 'Collapse button must exist');
  assert.ok(listOpen, 'Bookmarks list must exist');
  assert.ok(listOpen.id, 'Bookmarks list must have an id');

  // Verify stable accessible name (does not start with Expand/Collapse)
  const openLabel = collapseBtnOpen.getAttribute('aria-label');
  assert.equal(openLabel, 'Toggle Work Tools', 'Accessible name must be stable');

  // Expose state via aria-expanded
  assert.equal(collapseBtnOpen.getAttribute('aria-expanded'), 'true');

  // Expose aria-controls pointing at bookmarks list
  assert.equal(collapseBtnOpen.getAttribute('aria-controls'), listOpen.id);

  // Now test collapsed state
  const categoryCollapsed = {
    ...categoryOpen,
    collapsed: true
  };

  const cardCollapsed = renderCategoryCard(categoryCollapsed, 0, 1);
  const actionBtnsCollapsed = cardCollapsed.querySelectorAll('.icon-action-btn');
  const collapseBtnCollapsed = actionBtnsCollapsed[actionBtnsCollapsed.length - 1];
  const listCollapsed = cardCollapsed.querySelector('.bookmarks-list');

  const collapsedLabel = collapseBtnCollapsed.getAttribute('aria-label');
  assert.equal(collapsedLabel, openLabel, 'Accessible name must remain identical between open and collapsed states');
  assert.equal(collapseBtnCollapsed.getAttribute('aria-expanded'), 'false');
  assert.equal(collapseBtnCollapsed.getAttribute('aria-controls'), listCollapsed.id);
});
