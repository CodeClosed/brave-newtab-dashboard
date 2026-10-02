import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDashboardData, validateDashboardData, generateId } from '../extension/js/core/schema.js';

test('createDefaultDashboardData - produces valid schema document', () => {
  const defaults = createDefaultDashboardData();
  const validation = validateDashboardData(defaults);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);
  assert.equal(defaults.version, 1);
  assert.equal(defaults.categories.length > 0, true);
});

test('validateDashboardData - rejects duplicate category ids', () => {
  const data = createDefaultDashboardData();
  const dupId = data.categories[0].id;
  data.categories.push({
    id: dupId,
    name: 'Duplicate Category',
    icon: '📁',
    order: 99,
    collapsed: false,
    bookmarks: []
  });

  const validation = validateDashboardData(data);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(','), /Duplicate category id/);
});

test('validateDashboardData - rejects duplicate bookmark ids within category', () => {
  const data = createDefaultDashboardData();
  const cat = data.categories[0];
  const dupId = cat.bookmarks[0].id;
  cat.bookmarks.push({
    id: dupId,
    name: 'Duplicate Bookmark',
    url: 'https://example.com',
    order: 99
  });

  const validation = validateDashboardData(data);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(','), /Duplicate bookmark id/);
});

test('validateDashboardData - rejects invalid theme and search engines', () => {
  const data = createDefaultDashboardData();
  // @ts-ignore
  data.settings.theme = 'neon-cyberpunk';
  // @ts-ignore
  data.settings.searchEngine = 'yahoo';

  const validation = validateDashboardData(data);
  assert.equal(validation.valid, false);
  assert.equal(validation.errors.length >= 2, true);
});
