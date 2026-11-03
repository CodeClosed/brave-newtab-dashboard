// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BUNDLED_WALLPAPERS,
  calculateAdaptiveGlassOpacity,
  calculateAutoReadabilityDim
} from '../extension/js/features/wallpaper.js';
import { THEME_PRESETS, GLASS_PRESETS, applyThemePreset } from '../extension/js/features/presets.js';
import { applyBackground } from '../extension/js/features/theme.js';
import { toggleWallpaperTuner, closeWallpaperTuner } from '../extension/js/features/wallpaper-tuner.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';

let origDocument;
let origWindow;

beforeEach(() => {
  origDocument = globalThis.document;
  origWindow = globalThis.window;

  globalThis.document = {
    getElementById: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {
      appendChild: (c) => c,
      removeChild: (c) => c
    },
    documentElement: {
      style: {
        setProperty: () => {},
        removeProperty: () => {}
      },
      setAttribute: () => {},
      getAttribute: () => null
    },
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
        },
        querySelectorAll: (sel) => {
          const found = [];
          function search(node) {
            for (const child of node.children || []) {
              if (sel.startsWith('.') && child.classList?.contains(sel.slice(1))) found.push(child);
              else if (child.tagName?.toLowerCase() === sel.toLowerCase()) found.push(child);
              search(child);
            }
          }
          search(el);
          return found;
        },
        getBoundingClientRect: () => ({ top: 600, bottom: 640, left: 24, right: 64, width: 40, height: 40 })
      };
      return el;
    }
  };

  globalThis.window = {
    innerHeight: 800,
    innerWidth: 1200
  };
});

afterEach(() => {
  globalThis.document = origDocument;
  globalThis.window = origWindow;
  closeWallpaperTuner();
});

test('15.1 Bundled Wallpapers exist and are under 300KB each', () => {
  assert.equal(BUNDLED_WALLPAPERS.length, 6, 'Must have 6 bundled wallpapers');

  for (const wp of BUNDLED_WALLPAPERS) {
    assert.ok(wp.id.startsWith('bundled:'), `id must start with bundled: for ${wp.id}`);
    assert.ok(wp.name, 'name must be non-empty');
    assert.ok(wp.luminanceData, 'luminanceData must be defined');

    const filePath = path.join(process.cwd(), 'extension', 'assets', 'wallpapers', wp.file);
    assert.ok(fs.existsSync(filePath), `File must exist on disk: ${filePath}`);

    const stat = fs.statSync(filePath);
    assert.ok(stat.size < 300 * 1024, `Wallpaper file size must be under 300KB, got ${stat.size} bytes`);
  }
});

test('15.2 calculateAdaptiveGlassOpacity calculates adaptive opacity within [0.60, 0.90]', () => {
  const lowDimOpacity = calculateAdaptiveGlassOpacity(0.15, true);
  const highDimOpacity = calculateAdaptiveGlassOpacity(0.80, true);

  assert.ok(lowDimOpacity >= 0.60 && lowDimOpacity <= 0.65, `Expected base opacity around 0.62, got ${lowDimOpacity}`);
  assert.ok(highDimOpacity >= 0.80 && highDimOpacity <= 0.90, `Expected elevated opacity around 0.85, got ${highDimOpacity}`);
  assert.ok(highDimOpacity > lowDimOpacity, 'Higher dim (brighter background) must yield higher glass opacity');
});

test('15.1 & 15.2 applyBackground applies bundled wallpaper and adaptive glass opacity', async () => {
  const overlay = { style: {} };
  globalThis.document.getElementById = (id) => id === 'bg-overlay' ? overlay : null;

  let setPropKey = null;
  let setPropVal = null;

  globalThis.document.documentElement.style = {
    setProperty: (k, v) => {
      setPropKey = k;
      setPropVal = v;
    }
  };

  const bgConfig = {
    type: 'image',
    activeId: 'bundled:warm-fluid-wave',
    dim: 0.35,
    autoReadability: true
  };

  await applyBackground(bgConfig, true);

  assert.ok(overlay.style.backgroundImage.includes('assets/wallpapers/warm-fluid-wave.svg'));
  assert.equal(setPropKey, '--glass-opacity');
  assert.ok(Number(setPropVal) >= 0.60 && Number(setPropVal) <= 0.90);
});

test('15.4 Three Glass Theme Presets exist and apply bundled wallpapers, hero, and dock', () => {
  const ember = GLASS_PRESETS.find(p => p.id === 'glass-ember');
  const dusk = GLASS_PRESETS.find(p => p.id === 'glass-dusk');
  const forest = GLASS_PRESETS.find(p => p.id === 'glass-forest');

  assert.ok(ember, 'glass-ember must exist in GLASS_PRESETS');
  assert.ok(dusk, 'glass-dusk must exist in GLASS_PRESETS');
  assert.ok(forest, 'glass-forest must exist in GLASS_PRESETS');

  assert.equal(ember.settings.cards.style, 'glass');
  assert.equal(ember.settings.background.activeId, 'bundled:warm-fluid-wave');
  assert.equal(ember.settings.hero.layout, 'studio');
  assert.equal(ember.settings.dock.position, 'top');

  // Test applyThemePreset and undo
  const initial = createDefaultDashboardData();
  initial.settings.dock.position = 'off';
  initial.settings.hero.layout = 'centered';
  store.replaceData(initial);

  const res = applyThemePreset('glass-ember', store);
  assert.equal(res.success, true);
  assert.equal(store.get().settings.dock.position, 'top');
  assert.equal(store.get().settings.hero.layout, 'studio');
  assert.equal(store.get().settings.background.activeId, 'bundled:warm-fluid-wave');

  // Undo restores
  res.undo();
  assert.equal(store.get().settings.dock.position, 'off');
  assert.equal(store.get().settings.hero.layout, 'centered');
});

test('15.3 Wallpaper Tuner popover opens, renders thumbnails and sliders, and supports undo', () => {
  const initial = createDefaultDashboardData();
  initial.settings.background.dim = 0.35;
  initial.settings.background.dayId = 'wp_day';
  initial.settings.background.nightId = 'wp_night';
  initial.settings.background.rotation = 'hourly';
  initial.settings.glass.opacity = 0.62;
  store.replaceData(initial);

  const anchorBtn = document.createElement('button');
  const popover = toggleWallpaperTuner(anchorBtn, store);
  assert.ok(popover, 'Tuner popover must be rendered on open');

  const thumbs = popover.querySelectorAll('.wallpaper-thumb-card');
  assert.equal(thumbs.length, 6, 'Must render 6 bundled wallpaper thumbnail buttons');

  // Click second thumbnail (violet-dusk)
  thumbs[1].dispatchEvent({ type: 'click' });
  assert.equal(store.get().settings.background.activeId, 'bundled:violet-dusk');
  assert.equal(store.get().settings.background.dayId, null, 'Must clear dayId on preset select');
  assert.equal(store.get().settings.background.nightId, null, 'Must clear nightId on preset select');
  assert.equal(store.get().settings.background.rotation, 'off', 'Must turn rotation off on preset select');

  // Test sliders
  const sliders = popover.querySelectorAll('.wallpaper-tuner-slider');
  assert.equal(sliders.length, 3, 'Must render 3 sliders (dim, blur, glass)');

  const dimSlider = sliders[0];
  dimSlider.value = '25';
  dimSlider.dispatchEvent({ type: 'input' });
  assert.equal(store.get().settings.background.dim, 0.25);
  assert.equal(store.get().settings.background.autoReadability, false, 'Manual dim must disable autoReadability');

  const blurSlider = sliders[1];
  blurSlider.value = '8';
  blurSlider.dispatchEvent({ type: 'input' });
  assert.equal(store.get().settings.background.blur, 8);

  const glassSlider = sliders[2];
  glassSlider.value = '85';
  glassSlider.dispatchEvent({ type: 'input' });
  assert.equal(store.get().settings.glass.opacity, 0.85);
  assert.equal(store.get().settings.background.autoReadability, false, 'Manual glass opacity must disable autoReadability');

  // Close tuner
  closeWallpaperTuner();
});

test('15.5 applyGlassSettings applies --glass-opacity and --glass-blur-px to root element', async () => {
  const { applyGlassSettings } = await import('../extension/js/features/theme.js');

  const props = {};
  const mockRoot = {
    style: {
      setProperty: (k, v) => { props[k] = v; },
      removeProperty: (k) => { delete props[k]; }
    }
  };

  applyGlassSettings({
    glass: { opacity: 0.78, blur: 12 },
    background: { autoReadability: false }
  }, mockRoot);

  assert.equal(props['--glass-opacity'], '0.78');
  assert.equal(props['--glass-blur-px'], '12px');
});
