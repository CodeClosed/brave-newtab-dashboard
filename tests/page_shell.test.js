import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  applyPageMode,
  applyLanding,
  scrollToHub,
  scrollToHero,
  initPageShell
} from '../extension/js/features/page-shell.js';
import { toggleFocusMode, isFocusModeActive } from '../extension/js/features/keyboard.js';

test('9.1 DOM Structure: newtab.html contains all preserved and new Stage 1 & Stage 2 elements', () => {
  const html = fs.readFileSync('extension/newtab.html', 'utf-8');

  // Preserved IDs
  const preservedIds = [
    'bg-overlay',
    'app',
    'clock-display',
    'greeting-display',
    'date-display',
    'space-switcher',
    'search-form',
    'search-input',
    'search-results-list',
    'pinned-strip',
    'widgets-container',
    'notes-widget-container',
    'todo-widget-container',
    'categories-grid',
    'add-category-toolbar-btn',
    'collapse-all-btn',
    'expand-all-btn',
    'edit-mode-toggle-btn',
    'settings-trigger-btn'
  ];

  for (const id of preservedIds) {
    assert.ok(html.includes(`id="${id}"`), `newtab.html must preserve element id="${id}"`);
  }

  // New Phase 9 elements
  const newIds = [
    'hero-panel',
    'collections-hub',
    'scroll-to-hub',
    'scroll-to-hero',
    'app-dock'
  ];

  for (const id of newIds) {
    assert.ok(html.includes(`id="${id}"`), `newtab.html must define new element id="${id}"`);
  }
});

test('9.1 Page mode attribute: applyPageMode sets data-page attribute on body', () => {
  const attrs = {};
  const mockBody = {
    setAttribute: (k, v) => { attrs[k] = v; }
  };

  applyPageMode({ page: 'two-stage' }, mockBody);
  assert.equal(attrs['data-page'], 'two-stage');

  // Any legacy or invalid mode enforces modern page mode
  applyPageMode({ page: 'classic' }, mockBody);
  assert.equal(attrs['data-page'], 'two-stage');

  applyPageMode({}, mockBody);
  assert.equal(attrs['data-page'], 'two-stage');
});

test('9.2 Page CSS Rules: base.css defines scroll-snap, 100svh, and content-visibility optimizations', () => {
  const css = fs.readFileSync('extension/css/base.css', 'utf-8');

  assert.ok(css.includes('body[data-page="two-stage"]'), 'Must define two-stage body rules');
  assert.ok(css.includes('scroll-snap-type: y proximity'), 'Must define proximity snap');
  assert.ok(css.includes('min-height: 100svh'), 'Must set 100svh height');
  assert.ok(css.includes('content-visibility: auto'), 'Must optimize hub with content-visibility: auto');
  assert.ok(css.includes('.scroll-prompt'), 'Must style scroll prompt');
  assert.ok(!css.includes('body[data-page="classic"]'), 'Classic mode must be removed from base.css');
});

test('9.3 Landing guarantee: applyLanding sets manual scroll restoration and scrolls to (0, 0)', () => {
  let scrolledX = null;
  let scrolledY = null;

  const mockWindow = {
    history: {
      scrollRestoration: 'auto'
    },
    scrollTo: (x, y) => {
      scrolledX = x;
      scrolledY = y;
    }
  };

  // Default landing is 'hero'
  applyLanding({ landing: 'hero' }, mockWindow);
  assert.equal(mockWindow.history.scrollRestoration, 'manual');
  assert.equal(scrolledX, 0);
  assert.equal(scrolledY, 0);

  // If landing is 'remember', does not force scrollTo(0,0)
  scrolledX = null;
  scrolledY = null;
  applyLanding({ landing: 'remember' }, mockWindow);
  assert.equal(scrolledX, null);
  assert.equal(scrolledY, null);
});

test('9.2 & 9.4 Scroll triggers: scrollToHub and scrollToHero invoke scrollIntoView', () => {
  let hubScrolled = false;
  let heroScrolled = false;

  const mockElements = {
    'collections-hub': {
      scrollIntoView: ({ behavior }) => {
        hubScrolled = true;
        assert.equal(behavior, 'smooth');
      }
    },
    'hero-panel': {
      scrollIntoView: ({ behavior }) => {
        heroScrolled = true;
        assert.equal(behavior, 'smooth');
      }
    }
  };

  globalThis.document = {
    getElementById: (id) => mockElements[id] || null
  };

  try {
    scrollToHub('smooth');
    assert.equal(hubScrolled, true);

    scrollToHero('smooth');
    assert.equal(heroScrolled, true);
  } finally {
    delete globalThis.document;
  }
});

test('9.4 Focus Mode Lock: toggleFocusMode locks scroll and hides collections', () => {
  let scrolledToZero = false;
  const classes = new Set();
  const attributes = {};

  globalThis.document = {
    body: {
      classList: {
        toggle: (cls, active) => {
          if (active) classes.add(cls);
          else classes.delete(cls);
        }
      },
      setAttribute: (k, v) => { attributes[k] = v; }
    }
  };

  globalThis.window = {
    scrollTo: (x, y) => {
      if (x === 0 && y === 0) scrolledToZero = true;
    }
  };

  try {
    // Activate focus mode
    const active = toggleFocusMode(true);
    assert.equal(active, true);
    assert.ok(classes.has('focus-mode'));
    assert.equal(attributes['data-focus-mode'], 'true');
    assert.equal(scrolledToZero, true);

    // Deactivate focus mode
    toggleFocusMode(false);
    assert.ok(!classes.has('focus-mode'));
    assert.equal(attributes['data-focus-mode'], 'false');
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});
