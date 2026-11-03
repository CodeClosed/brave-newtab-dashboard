// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  pctToPx,
  pxToPct,
  snapToGuides,
  clampPosition,
  applyWidgetPositions,
  initWidgetDrag,
  snapToGridDimension,
  getGridUnits,
  GRID_CELL_WIDTH,
  GRID_CELL_HEIGHT,
  WIDGET_GRID_SPECS
} from '../extension/js/features/widget-drag.js';
import { setEditMode } from '../extension/js/features/edit-mode.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

let origDocument;
let origWindow;

beforeEach(() => {
  origDocument = globalThis.document;
  origWindow = globalThis.window;

  let mockElements = [];
  globalThis.document = {
    body: {
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      },
      appendChild: (el) => { if (el) { el.parentNode = globalThis.document.body; mockElements.push(el); } },
      removeChild: (el) => { const idx = mockElements.indexOf(el); if (idx !== -1) mockElements.splice(idx, 1); },
      contains: (el) => mockElements.includes(el)
    },
    getElementById: () => null,
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
        textContent: '',
        parentNode: null,
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
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] ?? null; },
        appendChild(c) {
          if (c) {
            c.parentNode = el;
            el.children.push(c);
          }
          return c;
        },
        removeChild(c) {
          const idx = el.children.indexOf(c);
          if (idx !== -1) el.children.splice(idx, 1);
          return c;
        },
        querySelector: (sel) => {
          function search(node) {
            for (const child of node.children || []) {
              if (sel.startsWith('.') && child.classList?.contains(sel.slice(1))) return child;
              if (child.tagName?.toLowerCase() === sel.toLowerCase()) return child;
              const found = search(child);
              if (found) return found;
            }
            return null;
          }
          return search(el);
        }
      };
      return el;
    }
  };

  globalThis.window = {
    innerWidth: 1000,
    innerHeight: 800
  };
});

afterEach(() => {
  setEditMode(false);
  globalThis.document = origDocument;
  globalThis.window = origWindow;
});

test('16.1 pctToPx and pxToPct conversions', () => {
  assert.equal(pctToPx(50, 1000), 500);
  assert.equal(pctToPx(25, 800), 200);
  assert.equal(pctToPx(0, 500), 0);

  assert.equal(pxToPct(500, 1000), 50);
  assert.equal(pxToPct(200, 800), 25);
  assert.equal(pxToPct(0, 500), 0);
});

test('16.1 snapToGuides snaps within threshold and respects disabled flag', () => {
  const guides = [500]; // e.g. center line

  // Within threshold (8px)
  const snap1 = snapToGuides({ targetPx: 504, guides, threshold: 8 });
  assert.equal(snap1.snapped, true);
  assert.equal(snap1.value, 500);

  // Outside threshold
  const snap2 = snapToGuides({ targetPx: 512, guides, threshold: 8 });
  assert.equal(snap2.snapped, false);
  assert.equal(snap2.value, 512);

  // Disabled with Alt key
  const snap3 = snapToGuides({ targetPx: 504, guides, threshold: 8, disabled: true });
  assert.equal(snap3.snapped, false);
  assert.equal(snap3.value, 504);
});

test('16.1 clampPosition keeps widget within viewport and avoids dock area', () => {
  // Screen: 1000 x 800. Widget: 200 x 100.
  // HalfW = 100, HalfH = 50.
  // Valid cx range: [100, 900]. In pct: [10%, 90%].
  // Valid cy range: [50, 750]. In pct: [6.25%, 93.75%].

  // Pushed far off-screen to top-left (0%, 0%)
  const clampedTopLeft = clampPosition({
    xPct: 0,
    yPct: 0,
    widthPx: 200,
    heightPx: 100,
    viewportWidth: 1000,
    viewportHeight: 800,
    dockPosition: 'off'
  });
  assert.equal(clampedTopLeft.xPct, 10);
  assert.equal(clampedTopLeft.yPct, 6.3);

  // Pushed far off-screen to bottom-right (100%, 100%)
  const clampedBottomRight = clampPosition({
    xPct: 100,
    yPct: 100,
    widthPx: 200,
    heightPx: 100,
    viewportWidth: 1000,
    viewportHeight: 800,
    dockPosition: 'off'
  });
  assert.equal(clampedBottomRight.xPct, 90);
  assert.equal(clampedBottomRight.yPct, 93.8);

  // With Top Dock (dockSize = 64): minY = 64 + 50 = 114px -> (114 / 800) * 100 = 14.3%
  const clampedTopDock = clampPosition({
    xPct: 50,
    yPct: 5,
    widthPx: 200,
    heightPx: 100,
    viewportWidth: 1000,
    viewportHeight: 800,
    dockPosition: 'top',
    dockSize: 64
  });
  assert.equal(clampedTopDock.xPct, 50);
  assert.ok(clampedTopDock.yPct >= 14.2 && clampedTopDock.yPct <= 14.4);
});

test('16.1 applyWidgetPositions applies free-drag positioning and width', () => {
  const clockEl = { style: {}, dataset: {} };
  const searchEl = { style: {}, dataset: {} };

  const heroPanel = {
    querySelector: (sel) => {
      if (sel === '.dashboard-header') return clockEl;
      if (sel === '.search-container') return searchEl;
      return null;
    }
  };

  const widgetsConfig = {
    clock: { x: 30, y: 40, w: 320, hidden: false },
    search: { x: null, y: null, w: null, hidden: true }
  };

  // @ts-ignore
  applyWidgetPositions(heroPanel, widgetsConfig);

  // Clock positioned
  assert.equal(clockEl.dataset.freeDrag, 'true');
  assert.equal(clockEl.style.position, 'absolute');
  assert.equal(clockEl.style.left, '30%');
  assert.equal(clockEl.style.top, '40%');
  assert.equal(clockEl.style.width, '320px');

  // Search hidden
  assert.equal(searchEl.style.display, 'none');

  // Reset clock to fluid flow
  const resetConfig = {
    clock: { x: null, y: null, w: null, hidden: false }
  };
  // @ts-ignore
  applyWidgetPositions(heroPanel, resetConfig);
  assert.equal(clockEl.dataset.freeDrag, undefined);
  assert.equal(clockEl.style.position, '');
  assert.equal(clockEl.style.left, '');
});

test('16.1 initWidgetDrag keyboard shortcuts (R reset, Delete hide, arrows)', () => {
  const initial = createDefaultDashboardData();
  initial.settings.hero.widgets.clock = { x: 35, y: 45, w: 300, hidden: false };
  store.replaceData(initial);

  let frameListeners = [];
  let frameCreated = null;

  const clockEl = {
    offsetWidth: 300,
    offsetHeight: 100,
    style: {},
    dataset: {},
    children: [],
    appendChild: (c) => {
      frameCreated = c;
      const origAdd = c.addEventListener;
      c.addEventListener = (evt, fn) => {
        if (evt === 'keydown') frameListeners.push(fn);
        if (origAdd) origAdd.call(c, evt, fn);
      };
      return c;
    },
    querySelector: (sel) => (sel === '.widget-drag-frame' ? frameCreated : null)
  };

  const heroPanel = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
    querySelector: (sel) => (sel === '.dashboard-header' ? clockEl : null)
  };

  // @ts-ignore
  initWidgetDrag(heroPanel, store);

  // Enter edit mode
  setEditMode(true);

  assert.ok(frameListeners.length > 0, 'Keydown listener must be attached');
  const onKeyDown = frameListeners[0];

  // Press ArrowRight (+1%)
  onKeyDown({ key: 'ArrowRight', shiftKey: false, preventDefault: () => {} });
  let s = store.get().settings.hero.widgets.clock;
  assert.equal(s.x, 36);

  // Press + to increase width by 20px
  onKeyDown({ key: '+', shiftKey: false, preventDefault: () => {} });
  s = store.get().settings.hero.widgets.clock;
  assert.equal(s.w, 320);

  // Press - to decrease width by 20px
  onKeyDown({ key: '-', shiftKey: false, preventDefault: () => {} });
  s = store.get().settings.hero.widgets.clock;
  assert.equal(s.w, 300);

  // Press [ to decrease height by 20px (from offsetHeight 100 down to 80)
  onKeyDown({ key: '[', shiftKey: false, preventDefault: () => {} });
  s = store.get().settings.hero.widgets.clock;
  assert.equal(s.h, 80);

  // Press ] to increase height by 20px (from 80 up to 100)
  onKeyDown({ key: ']', shiftKey: false, preventDefault: () => {} });
  s = store.get().settings.hero.widgets.clock;
  assert.equal(s.h, 100);

  // Press R (reset)
  onKeyDown({ key: 'r', preventDefault: () => {} });
  s = store.get().settings.hero.widgets.clock;
  assert.equal(s.x, null);
  assert.equal(s.y, null);
  assert.equal(s.w, null);
  assert.equal(s.h, null);

  // Press Delete (hide)
  onKeyDown({ key: 'Delete', preventDefault: () => {} });
  s = store.get().settings.hero.widgets.clock;
  assert.equal(s.hidden, true);
});

test('16.1 Android grid dimension calculations and snapping', () => {
  // Test snapToGridDimension
  assert.equal(snapToGridDimension(118, 60, 60, 600), 120);
  assert.equal(snapToGridDimension(135, 60, 60, 600), 120);
  assert.equal(snapToGridDimension(155, 60, 60, 600), 180);
  assert.equal(snapToGridDimension(20, 60, 100, 600), 100); // clamped to min
  assert.equal(snapToGridDimension(800, 60, 100, 600), 600); // clamped to max

  // Disabled snap (Alt key)
  assert.equal(snapToGridDimension(137, 60, 60, 600, true), 137);

  // Test getGridUnits
  const units = getGridUnits(420, 160, GRID_CELL_WIDTH, GRID_CELL_HEIGHT);
  assert.equal(units.cols, 7); // 420 / 60
  assert.equal(units.rows, 4); // 160 / 40

  // Test widget specs
  assert.equal(WIDGET_GRID_SPECS.search.resizeMode, 'horizontal');
  assert.equal(WIDGET_GRID_SPECS.clock.resizeMode, 'both');
  assert.equal(WIDGET_GRID_SPECS.speeddial.resizeMode, 'both');
  assert.equal(WIDGET_GRID_SPECS.timer.resizeMode, 'both');
});

test('16.1 applyWidgetPositions applies width, height, and clock font scaling', () => {
  const clockEl = {
    style: {
      setProperty: (k, v) => { clockEl.style[k] = v; },
      removeProperty: (k) => { delete clockEl.style[k]; }
    },
    dataset: {}
  };

  const heroPanel = {
    querySelector: (sel) => {
      if (sel === '.dashboard-header') return clockEl;
      return null;
    }
  };

  const widgetsConfig = {
    clock: { x: 50, y: 30, w: 600, h: 200, hidden: false }
  };

  // @ts-ignore
  applyWidgetPositions(heroPanel, widgetsConfig);

  assert.equal(clockEl.style.width, '600px');
  assert.equal(clockEl.style.height, '200px');
  assert.ok(clockEl.style['--hero-clock-size'], 'Dynamic clock font size must be set');

  // Reset
  const resetConfig = {
    clock: { x: null, y: null, w: null, h: null, hidden: false }
  };
  // @ts-ignore
  applyWidgetPositions(heroPanel, resetConfig);

  assert.equal(clockEl.style.width, '');
  assert.equal(clockEl.style.height, '');
  assert.equal(clockEl.style['--hero-clock-size'], undefined);
});

