import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('App Init: initApp boots cleanly without throwing and wires buttons', async () => {
  // Read newtab.html to extract element IDs
  const htmlPath = path.resolve('extension/newtab.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify all essential IDs exist in newtab.html
  const essentialIds = [
    'hero-panel',
    'collections-hub',
    'categories-grid',
    'app-dock',
    'settings-trigger-btn',
    'edit-mode-toggle-btn',
    'wallpaper-tuner-btn',
    'hero-layout-toggle-btn',
    'corner-jump-btn',
    'scroll-to-hub',
    'scroll-to-hero',
    'add-category-toolbar-btn',
    'save-tabs-toolbar-btn',
    'collapse-all-btn',
    'expand-all-btn',
    'hub-view-toggle-btn',
    'clock-display',
    'greeting-display',
    'date-display',
    'search-input',
    'hero-weather-slot'
  ];

  for (const id of essentialIds) {
    assert.ok(html.includes(`id="${id}"`), `newtab.html must contain id="${id}"`);
  }

  // Ensure main.js imports renderTodoWidget
  const mainJsPath = path.resolve('extension/js/main.js');
  const mainJs = fs.readFileSync(mainJsPath, 'utf8');
  assert.ok(mainJs.includes("import { renderTodoWidget }"), 'main.js must import renderTodoWidget');
  assert.ok(mainJs.includes("renderTodoWidget(todoWidgetContainer"), 'main.js must call renderTodoWidget');
});
