// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderCategoryCard } from '../extension/js/ui/components.js';
import { VALID_TAB_GROUP_COLORS } from '../extension/js/core/schema.js';

beforeEach(() => {
  globalThis.document = {
    createElement: (tag) => {
      const attrs = {};
      const classListSet = new Set();
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
        addEventListener() {},
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

test('12.3 Category Colors: renders color dot and data attribute when color is present', () => {
  VALID_TAB_GROUP_COLORS.forEach((color) => {
    const category = {
      id: `cat-${color}`,
      name: `${color} Collection`,
      icon: '📁',
      color: color,
      order: 0,
      collapsed: false,
      bookmarks: []
    };

    const card = renderCategoryCard(category, 0, 1);
    const colorDot = card.querySelector('.category-color-dot');

    assert.ok(colorDot, `Color dot should be rendered for color ${color}`);
    assert.ok(colorDot.className.includes(`color-${color}`), `Dot should include color-${color}`);
    assert.equal(card.dataset.color, color, `Card dataset should reflect color ${color}`);
  });
});

test('12.3 Category Colors: no color dot rendered when color is null or undefined', () => {
  const categoryNoColor = {
    id: 'cat-none',
    name: 'Plain Collection',
    icon: '📁',
    color: null,
    order: 0,
    collapsed: false,
    bookmarks: []
  };

  const card = renderCategoryCard(categoryNoColor, 0, 1);
  const colorDot = card.querySelector('.category-color-dot');
  assert.equal(colorDot, null, 'No color dot should be rendered when color is null');
});

test('12.1 Glass Windows: includes quick-add button in header and card-collapsible-wrapper', () => {
  const category = {
    id: 'cat-quick-add',
    name: 'Quick Add Test',
    icon: '⚡',
    color: 'blue',
    order: 0,
    collapsed: false,
    bookmarks: [{ id: 'b1', name: 'Example', url: 'https://example.com', order: 0 }]
  };

  const card = renderCategoryCard(category, 0, 1);
  const quickAddBtn = card.querySelector('.quick-add-btn');
  assert.ok(quickAddBtn, 'Quick add button must exist in card header');
  assert.equal(quickAddBtn.textContent, '+');

  const wrapper = card.querySelector('.card-collapsible-wrapper');
  assert.ok(wrapper, 'Card collapsible wrapper must exist for grid-rows animation');

  const list = card.querySelector('.bookmarks-list');
  assert.ok(list, 'Bookmarks list must exist inside wrapper');
});
