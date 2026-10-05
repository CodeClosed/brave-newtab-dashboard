import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyHeroLayout, toggleHeroLayout } from '../extension/js/features/hero.js';
import { renderClockAndGreeting } from '../extension/js/features/clock.js';

test('10.1 Hero Layout: applyHeroLayout sets data-hero-layout attribute', () => {
  const attrs = {};
  const mockHero = {
    setAttribute: (k, v) => { attrs[k] = v; }
  };

  applyHeroLayout({ layout: 'studio' }, mockHero);
  assert.equal(attrs['data-hero-layout'], 'studio');

  applyHeroLayout({ layout: 'centered' }, mockHero);
  assert.equal(attrs['data-hero-layout'], 'centered');

  // Fallback defaults to studio
  applyHeroLayout({}, mockHero);
  assert.equal(attrs['data-hero-layout'], 'studio');
});

test('10.1 Hero Layout Toggle: toggleHeroLayout flips between studio and centered in store', () => {
  let savedSettings = null;
  const mockStore = {
    state: { settings: { hero: { layout: 'studio' } } },
    get: () => mockStore.state,
    updateSettings: (s) => {
      savedSettings = s;
      mockStore.state.settings = { ...mockStore.state.settings, ...s };
    }
  };

  toggleHeroLayout(mockStore);
  assert.equal(savedSettings.hero.layout, 'centered');

  toggleHeroLayout(mockStore);
  assert.equal(savedSettings.hero.layout, 'studio');
});

test('10.2 Clock Hero Style: renderClockAndGreeting supports hero clock size and class', () => {
  const headerClasses = new Set();
  const clockClasses = new Set();

  const mockHeader = {
    classList: {
      toggle: (cls, active) => {
        if (active) headerClasses.add(cls);
        else headerClasses.delete(cls);
      }
    }
  };

  const mockClock = {
    style: {},
    className: '',
    textContent: '',
    set classNameSetter(val) {
      this.className = val;
      val.split(' ').forEach(c => clockClasses.add(c));
    }
  };

  // Define property setter for className
  Object.defineProperty(mockClock, 'className', {
    set(v) {
      this._className = v;
      clockClasses.clear();
      v.split(' ').forEach(c => clockClasses.add(c));
    },
    get() {
      return this._className;
    }
  });

  globalThis.document = {
    getElementById: (id) => {
      if (id === 'clock-display') return mockClock;
      return null;
    },
    querySelector: (sel) => {
      if (sel === '.dashboard-header') return mockHeader;
      return null;
    }
  };

  try {
    renderClockAndGreeting({
      showClock: true,
      clock: { style: 'hero', showSeconds: false }
    });

    assert.ok(headerClasses.has('clock-style-hero'), 'Must toggle clock-style-hero on header');
    assert.ok(clockClasses.has('clock-hero'), 'Must apply clock-hero class to clock element');
  } finally {
    delete globalThis.document;
  }
});

test('10.3 & 10.4 DOM Elements: newtab.html includes corner anchors, hero zones, search pill, and tasks slot', () => {
  const html = fs.readFileSync('extension/newtab.html', 'utf-8');

  // Corner buttons
  assert.ok(html.includes('id="corner-jump-btn"'), 'Must contain #corner-jump-btn');
  assert.ok(html.includes('id="hero-layout-toggle-btn"'), 'Must contain #hero-layout-toggle-btn');
  assert.ok(html.includes('id="edit-mode-toggle-btn"'), 'Must contain #edit-mode-toggle-btn');
  assert.ok(html.includes('id="wallpaper-tuner-btn"'), 'Must contain #wallpaper-tuner-btn');
  assert.ok(html.includes('id="settings-trigger-btn"'), 'Must contain #settings-trigger-btn');

  // Hero zones & quote
  assert.ok(html.includes('class="hero-zone hero-zone-left"'), 'Must contain hero-zone-left');
  assert.ok(html.includes('class="hero-zone hero-zone-right"'), 'Must contain hero-zone-right');
  assert.ok(html.includes('id="quote-display"'), 'Must contain #quote-display');
  assert.ok(html.includes('id="hero-tasks-slot"'), 'Must contain #hero-tasks-slot');
});

test('10.1 & 10.3 CSS: base.css defines studio grid, centered flex, search pill, and corner positioning', () => {
  const css = fs.readFileSync('extension/css/base.css', 'utf-8');

  assert.ok(css.includes('.hero-panel[data-hero-layout="studio"]'), 'Must define studio hero layout');
  assert.ok(css.includes('.hero-panel[data-hero-layout="centered"]'), 'Must define centered hero layout');
  assert.ok(css.includes('.corner-tl'), 'Must position top-left corner');
  assert.ok(css.includes('.corner-tr'), 'Must position top-right corner');
  assert.ok(css.includes('.corner-bl'), 'Must position bottom-left corner');
  assert.ok(css.includes('.corner-br'), 'Must position bottom-right corner');
  assert.ok(css.includes('clock-hero'), 'Must define clock-hero styles');
  assert.ok(css.includes('.quote-display'), 'Must style quote-display');
});
