import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  initKeyboardNavigation,
  toggleFocusMode,
  isFocusModeActive
} from '../extension/js/features/keyboard.js';

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
    dispatchEvent(evt) {
      if (listeners[evt.type]) {
        for (const fn of listeners[evt.type]) fn(evt);
      }
    }
  };
  return el;
}

beforeEach(() => {
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
    }
  };

  global.window = {
    addEventListener(evt, fn) {
      windowListeners[evt] = windowListeners[evt] || [];
      windowListeners[evt].push(fn);
    },
    dispatchEvent(evt) {
      if (windowListeners[evt.type]) {
        for (const fn of windowListeners[evt.type]) fn(evt);
      }
    }
  };
});

test('6.4 Focus Mode: toggleFocusMode updates state and classList', () => {
  assert.equal(isFocusModeActive(), false);

  toggleFocusMode(true);
  assert.equal(isFocusModeActive(), true);
  assert.equal(document.body.classList.contains('focus-mode'), true);

  toggleFocusMode(false);
  assert.equal(isFocusModeActive(), false);
  assert.equal(document.body.classList.contains('focus-mode'), false);

  toggleFocusMode();
  assert.equal(isFocusModeActive(), true);

  toggleFocusMode();
  assert.equal(isFocusModeActive(), false);
});

test('6.4 Focus Mode: keyboard f and Escape shortcuts', () => {
  initKeyboardNavigation();
  assert.equal(isFocusModeActive(), false);

  // Pressing 'f' enters focus mode
  window.dispatchEvent({ type: 'keydown', key: 'f', preventDefault: () => {} });
  assert.equal(isFocusModeActive(), true);

  // Pressing 'Escape' exits focus mode
  window.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {} });
  assert.equal(isFocusModeActive(), false);

  // Pressing 'f' enters again, second 'f' exits
  window.dispatchEvent({ type: 'keydown', key: 'f', preventDefault: () => {} });
  assert.equal(isFocusModeActive(), true);
  window.dispatchEvent({ type: 'keydown', key: 'f', preventDefault: () => {} });
  assert.equal(isFocusModeActive(), false);

  // If an input is focused, 'f' should not trigger focus mode
  const inputEl = createMockElement('input');
  document.activeElement = inputEl;
  window.dispatchEvent({ type: 'keydown', key: 'f', preventDefault: () => {} });
  assert.equal(isFocusModeActive(), false);
});

test('6.4 Focus Mode Stylesheet: base.css defines rules hiding non-clock/search UI in focus-mode', () => {
  const cssPath = path.resolve('extension/css/base.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(cssContent.includes('.focus-mode'), 'base.css must define .focus-mode rules');
  assert.ok(cssContent.includes('.dashboard-main'), 'focus mode must hide .dashboard-main');
  assert.ok(cssContent.includes('.top-nav'), 'focus mode must hide .top-nav');
});
