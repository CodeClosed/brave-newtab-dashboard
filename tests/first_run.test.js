import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import { migrate } from '../extension/js/core/migrate.js';
import {
  STARTER_TEMPLATES,
  getStarterTemplate,
  shouldShowFirstRun,
  applyStarterTemplate
} from '../extension/js/features/first-run.js';
import { TOUR_STEPS, completeTour, skipTour } from '../extension/js/features/tour.js';

test('3.6 First-run templates: templates contain valid generic bookmarks and empty template produces empty array', () => {
  const templateKeys = ['student', 'developer', 'creator', 'empty'];
  assert.deepEqual(Object.keys(STARTER_TEMPLATES).sort(), templateKeys.sort());

  // Empty template
  const emptyCats = getStarterTemplate('empty');
  assert.equal(emptyCats.length, 0);

  // Student, developer, creator
  for (const key of ['student', 'developer', 'creator']) {
    const cats = getStarterTemplate(key, 'space-test');
    assert.ok(cats.length >= 2, `${key} should have at least 2 collections`);
    for (const cat of cats) {
      assert.equal(cat.spaceId, 'space-test');
      assert.ok(cat.id && typeof cat.id === 'string');
      assert.ok(cat.name && cat.name.length <= 80);
      assert.ok(cat.icon && cat.icon.length <= 8);
      assert.ok(Array.isArray(cat.bookmarks) && cat.bookmarks.length > 0);
      for (const bm of cat.bookmarks) {
        assert.ok(bm.id && typeof bm.id === 'string');
        assert.ok(bm.name && bm.name.length <= 80);
        assert.ok(bm.url && bm.url.startsWith('https://'));
      }
    }
  }
});

test('3.6 First-run templates: upgrading an existing install never shows first-run', () => {
  // 1. Legacy v0/v1 without settings.firstRunDone
  const legacyV1 = {
    version: 1,
    settings: {
      theme: 'dark',
      accent: 'blue',
      layout: 'grid',
      searchEngine: 'duckduckgo'
    },
    categories: [
      {
        id: 'cat-legacy',
        name: 'Work',
        icon: '💼',
        bookmarks: [{ id: 'bm-1', name: 'GitHub', url: 'https://github.com' }]
      }
    ]
  };

  const migrated = migrate(legacyV1);
  assert.equal(migrated.settings.firstRunDone, true, 'Upgrading from v1 must set firstRunDone: true');
  assert.equal(shouldShowFirstRun(migrated), false, 'Upgraded install must never show first-run');

  // 2. Existing v2 document with firstRunDone explicitly true
  const existingV2 = createDefaultDashboardData();
  existingV2.settings.firstRunDone = true;
  assert.equal(shouldShowFirstRun(existingV2), false);

  // 3. Document with pre-existing categories but undefined firstRunDone
  const existingWithoutFlag = {
    version: 2,
    activeSpaceId: 'space-home',
    spaces: [{ id: 'space-home', name: 'Home', icon: '🏠', order: 0, pinned: [] }],
    settings: { theme: 'system' }, // firstRunDone undefined
    categories: [
      {
        id: 'cat-custom',
        spaceId: 'space-home',
        name: 'My Links',
        icon: '🔗',
        bookmarks: [{ id: 'bm-custom', name: 'Site', url: 'https://example.com' }]
      }
    ]
  };
  const migratedExisting = migrate(existingWithoutFlag);
  assert.equal(migratedExisting.settings.firstRunDone, true);
  assert.equal(shouldShowFirstRun(migratedExisting), false);
});

test('3.6 First-run templates: fresh install shows first-run and applying template updates state', async () => {
  const freshData = createDefaultDashboardData();
  assert.equal(freshData.settings.firstRunDone, false);
  assert.equal(shouldShowFirstRun(freshData), true);

  // Initialize store with fresh data
  await store.replaceData(freshData);
  assert.equal(shouldShowFirstRun(store.get()), true);

  // Apply student starter template
  await applyStarterTemplate('student');
  const studentState = store.get();
  assert.equal(studentState.settings.firstRunDone, true);
  assert.equal(shouldShowFirstRun(studentState), false);
  assert.ok(studentState.categories.length >= 2);
  assert.ok(studentState.categories.some(c => c.name.toLowerCase().includes('study') || c.name.toLowerCase().includes('research') || c.name.toLowerCase().includes('tools')));

  // Apply empty template
  await applyStarterTemplate('empty');
  const emptyState = store.get();
  assert.equal(emptyState.settings.firstRunDone, true);
  assert.equal(emptyState.categories.length, 0);
  assert.equal(shouldShowFirstRun(emptyState), false);
});

test('3.6 Tour: skippable 3-4 step tour records firstRunDone', async () => {
  assert.ok(TOUR_STEPS.length >= 3 && TOUR_STEPS.length <= 4, 'Tour must have 3 to 4 steps');
  for (const step of TOUR_STEPS) {
    assert.ok(step.targetSelector, 'Step must have targetSelector');
    assert.ok(step.title, 'Step must have title');
    assert.ok(step.description, 'Step must have description');
  }

  // Reset firstRunDone to false
  await store.updateSettings({ firstRunDone: false });
  assert.equal(store.get().settings.firstRunDone, false);

  // Skip tour
  await skipTour();
  assert.equal(store.get().settings.firstRunDone, true);

  // Reset and complete tour
  await store.updateSettings({ firstRunDone: false });
  assert.equal(store.get().settings.firstRunDone, false);

  await completeTour();
  assert.equal(store.get().settings.firstRunDone, true);
});
