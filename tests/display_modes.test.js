import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultSettings } from '../extension/js/core/schema.js';
import { repairSettings, repairCategories } from '../extension/js/core/migrate.js';
import { resolveCategoryDisplayMode, applyDisplaySettings } from '../extension/js/features/display.js';
import { renderCategoryCard, renderBookmarkItem } from '../extension/js/ui/components.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('4.3 Display modes: repairSettings and repairCategories validate display properties', () => {
  const defaults = createDefaultSettings();
  assert.equal(defaults.display.defaultMode, 'list');
  assert.equal(defaults.display.tileShape, 'rounded');
  assert.equal(defaults.display.density, 'comfortable');
  assert.equal(defaults.display.showDomains, true);
  assert.equal(defaults.display.iconSize, 20);

  // Valid display settings
  for (const mode of ['list', 'grid', 'icons']) {
    assert.equal(repairSettings({ display: { defaultMode: mode } }).display.defaultMode, mode);
  }
  for (const shape of ['rounded', 'square', 'circle']) {
    assert.equal(repairSettings({ display: { tileShape: shape } }).display.tileShape, shape);
  }
  for (const density of ['comfortable', 'compact']) {
    assert.equal(repairSettings({ display: { density } }).display.density, density);
  }

  // Clamping icon size
  assert.equal(repairSettings({ display: { iconSize: 24 } }).display.iconSize, 24);
  assert.equal(repairSettings({ display: { iconSize: 10 } }).display.iconSize, defaults.display.iconSize);
  assert.equal(repairSettings({ display: { iconSize: 100 } }).display.iconSize, defaults.display.iconSize);

  // Category displayMode per-collection override
  const cats = repairCategories([
    { id: 'c1', name: 'List Col', displayMode: 'list', bookmarks: [] },
    { id: 'c2', name: 'Grid Col', displayMode: 'grid', bookmarks: [] },
    { id: 'c3', name: 'Icons Col', displayMode: 'icons', bookmarks: [] },
    { id: 'c4', name: 'Default Col', displayMode: null, bookmarks: [] },
    { id: 'c5', name: 'Invalid Col', displayMode: '3d-floating', bookmarks: [] }
  ]);

  assert.equal(cats[0].displayMode, 'list');
  assert.equal(cats[1].displayMode, 'grid');
  assert.equal(cats[2].displayMode, 'icons');
  assert.equal(cats[3].displayMode, null);
  assert.equal(cats[4].displayMode, null);
});

test('4.3 Display modes: resolveCategoryDisplayMode resolves collection override or global fallback', () => {
  const settings = {
    display: { defaultMode: 'grid' }
  };

  // With category override
  assert.equal(resolveCategoryDisplayMode({ displayMode: 'icons' }, settings), 'icons');
  assert.equal(resolveCategoryDisplayMode({ displayMode: 'list' }, settings), 'list');

  // Fallback to settings.display.defaultMode
  assert.equal(resolveCategoryDisplayMode({ displayMode: null }, settings), 'grid');
  assert.equal(resolveCategoryDisplayMode({}, settings), 'grid');

  // Fallback to 'list' when settings is missing
  assert.equal(resolveCategoryDisplayMode({ displayMode: null }, null), 'list');
});

test('4.3 Display modes: applyDisplaySettings sets root attributes and icon size CSS variable', () => {
  const attributes = {};
  const styles = {};

  const mockRoot = {
    style: {
      setProperty(k, v) { styles[k] = String(v); }
    },
    setAttribute(k, v) { attributes[k] = String(v); }
  };

  applyDisplaySettings({
    display: {
      defaultMode: 'grid',
      tileShape: 'circle',
      density: 'compact',
      showDomains: false,
      iconSize: 28
    }
  }, mockRoot);

  assert.equal(attributes['data-tile-shape'], 'circle');
  assert.equal(attributes['data-density'], 'compact');
  assert.equal(attributes['data-show-domains'], 'false');
  assert.equal(styles['--icon-size'], '28px');
});

test('4.3 Display modes: renderCategoryCard applies data-display-mode to bookmarks list', () => {
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
        appendChild(c) { if (c) { c.parentNode = el; el.children.push(c); } return c; },
        querySelector: (sel) => {
          for (const c of el.children) {
            if (sel.startsWith('.') && (c.className || '').includes(sel.slice(1))) return c;
            const sub = c.querySelector?.(sel);
            if (sub) return sub;
          }
          return null;
        }
      };
      return el;
    },
    createTextNode: (t) => ({ textContent: t, nodeType: 3 })
  };

  // Global setting fallback
  const cardGrid = renderCategoryCard({
    id: 'test-cat',
    name: 'My Grid',
    displayMode: 'grid',
    bookmarks: [
      { id: 'b1', name: 'GitHub', url: 'https://github.com', order: 0 }
    ]
  }, 0, 1);

  const listEl = cardGrid.querySelector('.bookmarks-list');
  assert.ok(listEl);
  assert.equal(listEl.getAttribute('data-display-mode'), 'grid');

  // Icons only mode preserves accessible names and tooltips
  const bmEl = renderBookmarkItem({
    id: 'b2',
    name: 'MDN Web Docs',
    url: 'https://developer.mozilla.org',
    order: 0
  }, 'test-cat', 0, 1);

  const link = bmEl.querySelector('.bookmark-link');
  assert.ok(link);
  assert.ok(link.getAttribute('aria-label').includes('MDN Web Docs'));
  assert.equal(link.getAttribute('title'), 'https://developer.mozilla.org');
  assert.equal(link.getAttribute('data-tooltip'), 'https://developer.mozilla.org');
});

test('4.3 Display modes: stylesheet defines styles for grid, icons, tileShape and density', () => {
  const cardsCss = fs.readFileSync(path.join(__dirname, '../extension/css/components/cards.css'), 'utf8');
  const baseCss = fs.readFileSync(path.join(__dirname, '../extension/css/base.css'), 'utf8');
  const combined = cardsCss + '\n' + baseCss;

  assert.match(combined, /\[data-display-mode="list"\]/);
  assert.match(combined, /\[data-display-mode="grid"\]/);
  assert.match(combined, /\[data-display-mode="icons"\]/);
  assert.match(combined, /\[data-tile-shape="rounded"\]/);
  assert.match(combined, /\[data-tile-shape="square"\]/);
  assert.match(combined, /\[data-tile-shape="circle"\]/);
  assert.match(combined, /\[data-density="compact"\]/);
  assert.match(combined, /\[data-show-domains="false"\]/);
});
