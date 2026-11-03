// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimer, renderTimerWidget, _resetTimerForTests } from '../extension/js/features/timer.js';
import { renderQuoteWidget } from '../extension/js/features/quote.js';
import { renderSpeedDialWidget } from '../extension/js/features/speeddial.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

let origDocument;

beforeEach(() => {
  origDocument = globalThis.document;
  _resetTimerForTests();

  globalThis.document = {
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        attributes: {},
        children: [],
        dataset: {},
        value: '',
        textContent: '',
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k],
        appendChild: (c) => { el.children.push(c); return c; },
        addEventListener: () => {},
        classList: {
          add: (c) => { el.className += ` ${c}`; },
          remove: (c) => { el.className = el.className.replace(c, '').trim(); }
        },
        querySelector: () => null,
        querySelectorAll: () => []
      };
      return el;
    }
  };
});

afterEach(() => {
  globalThis.document = origDocument;
  _resetTimerForTests();
});

test('Timer Widget: formatTimer correctly formats minutes and seconds', () => {
  assert.equal(formatTimer(25 * 60), '25:00');
  assert.equal(formatTimer(5 * 60), '05:00');
  assert.equal(formatTimer(65), '01:05');
  assert.equal(formatTimer(9), '00:09');
  assert.equal(formatTimer(0), '00:00');
  assert.equal(formatTimer(-10), '00:00');
});

test('Timer Widget: renders correctly when enabled', () => {
  const state = createDefaultDashboardData();
  state.settings.widgets.timer = true;
  state.settings.hero.widgets.timer.hidden = false;

  let children = [];
  const container = {
    hidden: true,
    style: {},
    dataset: {},
    children,
    querySelector: (sel) => null,
    replaceChildren: (...els) => { children = els; },
    appendChild: (el) => { children.push(el); }
  };

  renderTimerWidget(container, state);
  assert.equal(container.hidden, false);
  assert.ok(children.length > 0);
  assert.ok(children[0].className.includes('widget-timer'));
});

test('Timer Widget: hides container when disabled', () => {
  const state = createDefaultDashboardData();
  state.settings.widgets.timer = false;

  const container = {
    hidden: false,
    style: {},
    dataset: {}
  };

  renderTimerWidget(container, state);
  assert.equal(container.hidden, true);
  assert.equal(container.style.display, 'none');
});

test('Quote Widget: renders daily quote and focus input', () => {
  const state = createDefaultDashboardData();
  state.settings.widgets.quote = true;
  state.settings.hero.widgets.quote.hidden = false;

  let children = [];
  const container = {
    hidden: true,
    style: {},
    dataset: {},
    children,
    replaceChildren: (...els) => { children = els; },
    appendChild: (el) => { children.push(el); }
  };

  renderQuoteWidget(container, state);
  assert.equal(container.hidden, false);
  assert.ok(children.length > 0);
  assert.ok(children[0].className.includes('widget-quote'));
});

test('Speed Dial Widget: renders pinned or top bookmarks', () => {
  const state = createDefaultDashboardData();
  state.settings.widgets.speeddial = true;
  state.settings.hero.widgets.speeddial.hidden = false;

  let children = [];
  const container = {
    hidden: true,
    style: {},
    dataset: {},
    children,
    replaceChildren: (...els) => { children = els; },
    appendChild: (el) => { children.push(el); }
  };

  renderSpeedDialWidget(container, state);
  assert.equal(container.hidden, false);
  assert.ok(children.length > 0);
  assert.ok(children[0].className.includes('widget-speeddial'));
});

test('Default presentation: new widgets (timer, speeddial, quote) are enabled and unhidden by default', () => {
  const state = createDefaultDashboardData();
  assert.equal(state.settings.widgets.timer, true);
  assert.equal(state.settings.widgets.speeddial, true);
  assert.equal(state.settings.widgets.quote, true);
  assert.equal(state.settings.hero.widgets.timer.hidden, false);
  assert.equal(state.settings.hero.widgets.speeddial.hidden, false);
  assert.equal(state.settings.hero.widgets.quote.hidden, false);

  // Directly verify they all render with default state without manual toggling
  const makeContainer = () => {
    let children = [];
    return {
      hidden: true,
      style: {},
      dataset: {},
      children,
      replaceChildren: (...els) => { children = els; },
      appendChild: (el) => { children.push(el); },
      querySelector: () => null
    };
  };

  const timerC = makeContainer();
  renderTimerWidget(timerC, state);
  assert.equal(timerC.hidden, false);

  const speeddialC = makeContainer();
  renderSpeedDialWidget(speeddialC, state);
  assert.equal(speeddialC.hidden, false);

  const quoteC = makeContainer();
  renderQuoteWidget(quoteC, state);
  assert.equal(quoteC.hidden, false);
});

