import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  initAutoHide,
  isAutoHideActive,
  isAutoHideIdle,
  destroyAutoHide
} from '../extension/js/features/auto-hide.js';

function createMockElement(tag = 'div') {
  const listeners = {};
  const classListSet = new Set();
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    classList: {
      add(c) {
        classListSet.add(c);
        el.className = Array.from(classListSet).join(' ');
      },
      remove(c) {
        classListSet.delete(c);
        el.className = Array.from(classListSet).join(' ');
      },
      toggle(c, force) {
        const shouldHave = force !== undefined ? force : !classListSet.has(c);
        if (shouldHave) el.classList.add(c);
        else el.classList.remove(c);
        return shouldHave;
      },
      contains(c) {
        return classListSet.has(c);
      }
    },
    addEventListener(evt, fn) {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (listeners[evt]) listeners[evt] = listeners[evt].filter(f => f !== fn);
    },
    dispatchEvent(evt) {
      if (listeners[evt.type]) {
        for (const fn of listeners[evt.type]) fn(evt);
      }
    }
  };
  return el;
}

beforeEach(() => {
  destroyAutoHide();

  const body = createMockElement('body');
  const windowListeners = {};

  global.document = {
    body,
    activeElement: body,
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: (evt, fn) => {
      body.addEventListener(evt, fn);
    },
    removeEventListener: (evt, fn) => {
      body.removeEventListener(evt, fn);
    }
  };

  global.window = {
    addEventListener(evt, fn) {
      windowListeners[evt] = windowListeners[evt] || [];
      windowListeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (windowListeners[evt]) windowListeners[evt] = windowListeners[evt].filter(f => f !== fn);
    },
    dispatchEvent(evt) {
      if (windowListeners[evt.type]) {
        for (const fn of windowListeners[evt.type]) fn(evt);
      }
    }
  };
});

test('6.5 Auto-Hide: disabled by default and toggles classes', () => {
  initAutoHide({ behavior: { autoHide: false } });
  assert.equal(isAutoHideActive(), false);
  assert.equal(document.body.classList.contains('auto-hide-enabled'), false);

  initAutoHide({ behavior: { autoHide: true } });
  assert.equal(isAutoHideActive(), true);
  assert.equal(document.body.classList.contains('auto-hide-enabled'), true);
  assert.equal(document.body.classList.contains('auto-hide-idle'), true);
  assert.equal(isAutoHideIdle(), true);
});

test('6.5 Auto-Hide: activity wakes up dashboard', () => {
  initAutoHide({ behavior: { autoHide: true } });
  assert.equal(isAutoHideIdle(), true);

  // User moves pointer -> wakes up dashboard
  window.dispatchEvent({ type: 'pointermove' });
  assert.equal(isAutoHideIdle(), false);
  assert.equal(document.body.classList.contains('auto-hide-idle'), false);

  // User presses key -> also wakes up dashboard
  document.body.classList.add('auto-hide-idle');
  window.dispatchEvent({ type: 'keydown', key: 'a' });
  assert.equal(isAutoHideIdle(), false);
});

test('6.5 Auto-Hide Stylesheet: base.css defines rules for auto-hide-idle and settings focusability', () => {
  const cssPath = path.resolve('extension/css/base.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(cssContent.includes('.auto-hide-enabled'), 'base.css must define .auto-hide-enabled');
  assert.ok(cssContent.includes('.auto-hide-idle'), 'base.css must define .auto-hide-idle');
  assert.ok(cssContent.includes(':focus-within') || cssContent.includes(':focus-visible'), 'settings cog must reveal on focus');
});
