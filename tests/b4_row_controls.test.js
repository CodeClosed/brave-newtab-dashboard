import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderBookmarkItem } from '../extension/js/ui/components.js';

test('B4: CSS verification - bookmark actions are never display:none or visibility:hidden and show on hover/focus-within', () => {
  const cardsCss = fs.readFileSync(path.resolve('extension/css/components/cards.css'), 'utf-8');
  const baseCss = fs.readFileSync(path.resolve('extension/css/base.css'), 'utf-8');

  // Verify .bookmark-actions does not use display: none or visibility: hidden
  const actionsMatch = cardsCss.match(/\.bookmark-actions\s*\{([^}]+)\}/);
  assert.ok(actionsMatch, '.bookmark-actions CSS rule must exist');
  const actionsBody = actionsMatch[1];

  assert.ok(!actionsBody.includes('display: none'), '.bookmark-actions must not use display: none');
  assert.ok(!actionsBody.includes('visibility: hidden'), '.bookmark-actions must not use visibility: hidden');
  assert.ok(actionsBody.includes('opacity: 0'), '.bookmark-actions should be visually hidden via opacity: 0');

  // Verify :hover and :focus-within reveal actions with opacity: 1
  assert.ok(
    cardsCss.includes('.bookmark-item:focus-within .bookmark-actions'),
    'CSS must reveal .bookmark-actions on .bookmark-item:focus-within'
  );
  assert.ok(
    cardsCss.includes('.bookmark-item:hover .bookmark-actions'),
    'CSS must reveal .bookmark-actions on .bookmark-item:hover'
  );

  // Verify compact layout does not hide actions
  assert.ok(!cardsCss.includes('compact') || !cardsCss.includes('display: none'), 'Compact layout must not hide bookmark controls');
  assert.ok(!baseCss.includes('data-layout="compact"') || !baseCss.includes('.bookmark-actions'), 'Base CSS must not hide bookmark actions in compact');
});

test('B4: DOM verification - bookmark action controls exist in tab order with accessible names', () => {
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
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] ?? null; },
        appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
        querySelector: (sel) => {
          for (const c of el.children) {
            if (sel.startsWith('.') && (c.className || '').includes(sel.slice(1))) return c;
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

  const bm = {
    id: 'bm-1',
    name: 'GitHub',
    url: 'https://github.com',
    order: 1
  };

  // Middle item (index 1 of 3) so moveUp, moveDown, edit, delete all exist
  const item = renderBookmarkItem(bm, 'cat-1', 1, 3);
  const actions = item.querySelector('.bookmark-actions');
  assert.ok(actions, '.bookmark-actions container must exist');

  const buttons = actions.querySelectorAll('.bookmark-action-btn');
  // 5 buttons: move up, move down, pin, edit, delete
  assert.equal(buttons.length, 5, 'All 5 bookmark controls must be present in tab order');

  for (const btn of buttons) {
    assert.equal(btn.tagName, 'BUTTON', 'Control must be a native focusable button');
    assert.ok(btn.getAttribute('aria-label'), `Button ${btn.textContent} must have an aria-label`);
    assert.ok(btn.getAttribute('title'), `Button ${btn.textContent} must have a title`);
  }

  delete globalThis.document;
});
