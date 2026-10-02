import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { showToast } from '../extension/js/ui/toasts.js';

let mockElements = [];

beforeEach(() => {
  mockElements = [];
  globalThis.document = {
    body: {
      appendChild: (el) => { el.parentNode = globalThis.document.body; mockElements.push(el); },
      removeChild: (el) => { const idx = mockElements.indexOf(el); if (idx !== -1) mockElements.splice(idx, 1); },
      contains: (el) => mockElements.includes(el)
    },
    createElement: (tag) => {
      const attrs = {};
      const listeners = {};
      const classes = new Set();
      const el = {
        tagName: tag.toUpperCase(),
        attrs,
        children: [],
        className: '',
        style: {},
        dataset: {},
        classList: {
          add: (c) => { classes.add(c); el.className = [...classes].join(' '); },
          remove: (c) => { classes.delete(c); el.className = [...classes].join(' '); },
          contains: (c) => classes.has(c)
        },
        addEventListener: (k, fn) => { listeners[k] = listeners[k] || []; listeners[k].push(fn); },
        dispatchEvent: (evt) => {
          if (listeners[evt.type]) {
            for (const fn of listeners[evt.type]) fn(evt);
          }
        },
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] ?? null; },
        hasAttribute(k) { return k in attrs; },
        appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
        removeChild(c) { const i = el.children.indexOf(c); if (i !== -1) el.children.splice(i, 1); return c; },
        contains(node) {
          let cur = node;
          while (cur) {
            if (cur === el) return true;
            cur = cur.parentNode;
          }
          return false;
        },
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
});

afterEach(() => {
  delete globalThis.document;
});

test('B5: toast has role="status", reachable undo button, and does not dismiss while focused', async () => {
  let undoClicked = false;
  showToast('Bookmark deleted', () => { undoClicked = true; }, 100);

  const container = mockElements.find(e => e.className.includes('toast-container'));
  assert.ok(container, 'Toast container must exist');
  assert.equal(container.getAttribute('aria-live'), 'polite');

  const toast = container.querySelector('.toast');
  assert.ok(toast, 'Toast element must exist');
  assert.equal(toast.getAttribute('role'), 'status', 'Toast must have role="status"');

  const undoBtn = toast.querySelector('.toast-undo-btn');
  assert.ok(undoBtn, 'Undo button must exist in toast');
  assert.equal(undoBtn.tagName, 'BUTTON', 'Undo button must be a native focusable button');

  // Simulate keyboard focus entering the toast
  toast.dispatchEvent({ type: 'focusin', target: undoBtn });

  // Wait 150ms (longer than durationMs = 100ms)
  await new Promise(resolve => setTimeout(resolve, 150));

  // The toast must NOT have been dismissed or marked for hiding while focused
  assert.ok(!toast.classList.contains('toast-hiding'), 'Toast must not disappear while focused');
  assert.ok(container.children.includes(toast), 'Toast must still be in container');

  // Simulate focus leaving the toast
  toast.dispatchEvent({ type: 'focusout', target: undoBtn });

  // Wait for the resumed timer to dismiss the toast (100ms duration + 200ms dismiss animation)
  await new Promise(resolve => setTimeout(resolve, 350));

  // Now it should be dismissed
  assert.ok(!container.children.includes(toast), 'Toast should dismiss after focus leaves');
});
