// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANDROID_WIDGET_KEYS,
  getDayAndYearProgress,
  computeHabitStreak,
  computeDaysRemaining,
  evaluateMathExpression,
  convertUnitValue,
  renderGlanceWidget,
  renderHabitsWidget,
  renderWorldClockWidget,
  renderCountdownWidget,
  renderSoundscapesWidget,
  renderVoiceMemoWidget,
  renderPulseWidget,
  renderClipboardWidget,
  renderCalculatorWidget,
  renderReadLaterWidget
} from '../extension/js/features/android-widgets.js';
import { WIDGET_GRID_SPECS, applyWidgetPositions } from '../extension/js/features/widget-drag.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

let origDocument;

beforeEach(() => {
  origDocument = globalThis.document;
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
        innerHTML: '',
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k],
        appendChild: (c) => { el.children.push(c); return c; },
        addEventListener: () => {},
        classList: {
          add: (c) => { el.className += ` ${c}`; },
          remove: (c) => { el.className = el.className.replace(c, '').trim(); },
          toggle: () => {}
        },
        querySelector: () => null,
        querySelectorAll: () => []
      };
      return el;
    },
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) })
  };
});

afterEach(() => {
  globalThis.document = origDocument;
});

function makeContainer() {
  let children = [];
  return {
    hidden: true,
    style: {},
    dataset: {},
    get children() { return children; },
    querySelector: () => null,
    replaceChildren: (...els) => { children = els; },
    appendChild: (el) => { children.push(el); }
  };
}

test('Android Widgets: all 10 keys are registered in schema and WIDGET_GRID_SPECS', () => {
  assert.equal(ANDROID_WIDGET_KEYS.length, 10);
  const data = createDefaultDashboardData();
  for (const key of ANDROID_WIDGET_KEYS) {
    assert.ok(WIDGET_GRID_SPECS[key], `Missing WIDGET_GRID_SPECS for ${key}`);
    assert.equal(typeof WIDGET_GRID_SPECS[key].label, 'string');
    assert.ok(key in data.settings.widgets, `Missing settings.widgets.${key}`);
    assert.ok(key in data.settings.hero.widgets, `Missing settings.hero.widgets.${key}`);
  }
});

test('Android Widgets: evaluateMathExpression safely evaluates arithmetic and rejects invalid input', () => {
  assert.equal(evaluateMathExpression('240 * 1.18'), 283.2);
  assert.equal(evaluateMathExpression('(10 + 5) × 2 ÷ 3'), 10);
  assert.equal(evaluateMathExpression('2^8'), 256);
  assert.equal(evaluateMathExpression('17 % 5'), 2);
  assert.equal(evaluateMathExpression('10 / 0'), null);
  assert.equal(evaluateMathExpression('alert(1)'), null);
  assert.equal(evaluateMathExpression(''), null);
});

test('Android Widgets: convertUnitValue converts km/mi, kg/lb, and C/F accurately', () => {
  assert.equal(convertUnitValue(10, 'km-mi'), '6.21 mi');
  assert.equal(convertUnitValue(10, 'kg-lb'), '22.05 lb');
  assert.equal(convertUnitValue(0, 'c-f'), '32 °F');
  assert.equal(convertUnitValue(212, 'f-c'), '100 °C');
});

test('Android Widgets: getDayAndYearProgress, computeHabitStreak, computeDaysRemaining', () => {
  const prog = getDayAndYearProgress(new Date('2026-06-15T12:00:00'));
  assert.ok(prog.dayPct >= 45 && prog.dayPct <= 55);
  assert.ok(prog.yearPct >= 40 && prog.yearPct <= 50);

  const dateKeys = [
    { key: '2026-11-06', label: 'F', isToday: false },
    { key: '2026-11-07', label: 'S', isToday: false },
    { key: '2026-11-08', label: 'S', isToday: true }
  ];
  assert.equal(computeHabitStreak({ '2026-11-06': true, '2026-11-07': true }, dateKeys), 2);
  assert.equal(computeHabitStreak({ '2026-11-06': true, '2026-11-07': true, '2026-11-08': true }, dateKeys), 3);

  const cd = computeDaysRemaining('2026-11-18', new Date('2026-11-08T09:00:00'));
  assert.equal(cd.past, false);
  assert.ok(cd.days >= 10 && cd.days <= 11);
});

test('Android Widgets: all 10 widgets hide when disabled and mount cards when enabled', () => {
  const renderers = [
    ['glance', renderGlanceWidget, 'widget-glance'],
    ['habits', renderHabitsWidget, 'widget-habits'],
    ['worldclock', renderWorldClockWidget, 'widget-worldclock'],
    ['countdown', renderCountdownWidget, 'widget-countdown'],
    ['soundscapes', renderSoundscapesWidget, 'widget-soundscapes'],
    ['voicememo', renderVoiceMemoWidget, 'widget-voicememo'],
    ['pulse', renderPulseWidget, 'widget-pulse'],
    ['clipboard', renderClipboardWidget, 'widget-clipboard'],
    ['calculator', renderCalculatorWidget, 'widget-calculator'],
    ['readlater', renderReadLaterWidget, 'widget-readlater']
  ];

  for (const [key, renderFn, expectedClass] of renderers) {
    const state = createDefaultDashboardData();
    const c = makeContainer();

    // Hidden by default
    renderFn(c, state);
    assert.equal(c.hidden, true, `${key} should be hidden by default`);

    // Enabled + unhidden
    state.settings.widgets[key] = true;
    state.settings.hero.widgets[key].hidden = false;
    renderFn(c, state);
    assert.equal(c.hidden, false, `${key} should be visible when enabled`);
    assert.equal(c.children.length, 1);
    assert.ok(c.children[0].className.includes(expectedClass), `Expected ${expectedClass} for ${key}`);
  }
});

test('Android Widgets: applyWidgetPositions positions all 10 new hero slots', () => {
  const slots = {};
  for (const key of ANDROID_WIDGET_KEYS) {
    slots[`#hero-${key}-slot`] = { style: {}, dataset: {} };
  }
  const heroPanel = {
    querySelector: (sel) => slots[sel] || null
  };
  const config = {};
  for (const key of ANDROID_WIDGET_KEYS) {
    config[key] = { x: 45, y: 55, w: 360, h: 180, hidden: false };
  }
  applyWidgetPositions(heroPanel, config);
  for (const key of ANDROID_WIDGET_KEYS) {
    const el = slots[`#hero-${key}-slot`];
    assert.equal(el.style.left, '45%');
    assert.equal(el.style.top, '55%');
    assert.equal(el.style.width, '360px');
    assert.equal(el.style.height, '180px');
  }
});
