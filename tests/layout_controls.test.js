import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultSettings } from '../extension/js/core/schema.js';
import { repairSettings } from '../extension/js/core/migrate.js';
import { applyLayoutSettings } from '../extension/js/features/layout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('4.2 Layout controls: repairSettings validates columns, width, gap, align and verticalCenter', () => {
  const defaults = createDefaultSettings();
  assert.equal(defaults.cards.columns, 'auto');
  assert.equal(defaults.cards.width, 340);
  assert.equal(defaults.cards.gap, 16);
  assert.equal(defaults.cards.align, 'center');
  assert.equal(defaults.cards.verticalCenter, false);

  // Valid columns: auto and 1 through 6
  for (const cols of ['auto', 1, 2, 3, 4, 5, 6]) {
    const repaired = repairSettings({ cards: { columns: cols } });
    assert.equal(repaired.cards.columns, cols);
  }

  // String numbers are parsed to number
  assert.equal(repairSettings({ cards: { columns: '3' } }).cards.columns, 3);

  // Invalid columns fallback to auto
  assert.equal(repairSettings({ cards: { columns: 99 } }).cards.columns, 'auto');
  assert.equal(repairSettings({ cards: { columns: 'custom' } }).cards.columns, 'auto');

  // Width clamped within 200..600
  assert.equal(repairSettings({ cards: { width: 400 } }).cards.width, 400);
  assert.equal(repairSettings({ cards: { width: 100 } }).cards.width, defaults.cards.width);
  assert.equal(repairSettings({ cards: { width: 999 } }).cards.width, defaults.cards.width);

  // Gap clamped within 0..48
  assert.equal(repairSettings({ cards: { gap: 24 } }).cards.gap, 24);
  assert.equal(repairSettings({ cards: { gap: -5 } }).cards.gap, defaults.cards.gap);
  assert.equal(repairSettings({ cards: { gap: 100 } }).cards.gap, defaults.cards.gap);

  // Alignment: left and center
  assert.equal(repairSettings({ cards: { align: 'left' } }).cards.align, 'left');
  assert.equal(repairSettings({ cards: { align: 'center' } }).cards.align, 'center');
  assert.equal(repairSettings({ cards: { align: 'right' } }).cards.align, 'center');

  // Vertical centering boolean
  assert.equal(repairSettings({ cards: { verticalCenter: true } }).cards.verticalCenter, true);
  assert.equal(repairSettings({ cards: { verticalCenter: false } }).cards.verticalCenter, false);
});

test('4.2 Layout controls: applyLayoutSettings applies attributes and CSS variables', () => {
  const styles = {};
  const attributes = {};

  const mockRoot = {
    style: {
      setProperty(k, v) { styles[k] = String(v); },
      removeProperty(k) { delete styles[k]; }
    },
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return attributes[k]; }
  };

  applyLayoutSettings({
    cards: {
      columns: 4,
      width: 360,
      gap: 20,
      align: 'left',
      verticalCenter: true
    }
  }, mockRoot);

  assert.equal(attributes['data-columns'], '4');
  assert.equal(attributes['data-layout-align'], 'left');
  assert.equal(attributes['data-vertical-center'], 'true');
  assert.equal(styles['--card-width'], '360px');
  assert.equal(styles['--card-gap'], '20px');
  assert.equal(styles['--layout-columns'], '4');
});

test('4.2 Layout controls: stylesheet defines responsive rules for layout controls', () => {
  const baseCss = fs.readFileSync(path.join(__dirname, '../extension/css/base.css'), 'utf8');

  assert.match(baseCss, /--card-width/);
  assert.match(baseCss, /--card-gap/);
  assert.match(baseCss, /\[data-columns="auto"\]/);
  assert.match(baseCss, /\[data-columns="1"\]/);
  assert.match(baseCss, /\[data-columns="4"\]/);
  assert.match(baseCss, /\[data-layout-align="left"\]/);
  assert.match(baseCss, /\[data-layout-align="center"\]/);
  assert.match(baseCss, /\[data-vertical-center="true"\]/);
});
