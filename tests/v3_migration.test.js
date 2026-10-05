import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultDashboardData,
  createDefaultSettings,
  validateDashboardData,
  CURRENT_SCHEMA_VERSION,
  VALID_TAB_GROUP_COLORS,
  VALID_DOCK_POSITIONS,
  VALID_PAGE_MODES,
  VALID_LANDING_MODES,
  VALID_HERO_LAYOUTS,
  VALID_HUB_VIEWS
} from '../extension/js/core/schema.js';
import { migrate, repairSettings, repairCategories } from '../extension/js/core/migrate.js';

test('8.1 Schema v3: CURRENT_SCHEMA_VERSION is 3 and defaults satisfy v3 specification', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 3);

  const doc = createDefaultDashboardData();
  assert.equal(doc.version, 3);
  assert.ok(Array.isArray(doc.spaces));
  assert.equal(doc.settings.page, 'classic');
  assert.equal(doc.settings.landing, 'hero');
  assert.equal(doc.settings.hero.layout, 'studio');
  assert.deepEqual(doc.settings.hero.zones, {
    clock: 'left',
    weather: 'right',
    search: 'right',
    quote: 'left',
    tasks: 'off'
  });
  assert.equal(doc.settings.dock.position, 'top');
  assert.equal(doc.settings.dock.autoHide, false);
  assert.equal(doc.settings.dock.maxItems, 12);
  assert.equal(doc.settings.glass.blur, 16);
  assert.equal(doc.settings.glass.opacity, 0.62);
  assert.equal(doc.settings.weather.enabled, false);
  assert.equal(doc.settings.weather.unit, 'c');
  assert.equal(doc.settings.quote.enabled, true);
  assert.equal(doc.settings.tabs.closeAfterSave, false);
  assert.equal(doc.settings.tabs.openAsGroup, true);
  assert.equal(doc.settings.hub.view, 'columns');

  for (const cat of doc.categories) {
    assert.equal(cat.color, null);
    assert.equal(cat.source, null);
    assert.equal(cat.savedAt, null);
  }

  const validation = validateDashboardData(doc);
  assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
});

test('8.1 Migration: migrates legacy v2 document to v3 preserving existing fields and injecting v3 defaults', () => {
  const v2Doc = {
    version: 2,
    activeSpaceId: 'sp-1',
    spaces: [{ id: 'sp-1', name: 'Home', icon: '🏠', order: 0, pinned: [], note: '', todos: [] }],
    settings: {
      theme: 'dark',
      accent: 'emerald',
      palette: 'amoled',
      layout: 'compact',
      showClock: true,
      showDate: true,
      showGreeting: true,
      timeFormat: '24h',
      searchEngine: 'duckduckgo',
      cards: { style: 'frosted', translucent: true, columns: 3, width: 320, gap: 12, align: 'left', equalHeight: true, verticalCenter: false },
      background: { type: 'solid', value: '#0f172a', dim: 0.4 }
    },
    categories: [
      {
        id: 'cat-work',
        spaceId: 'sp-1',
        name: 'Work',
        icon: '💼',
        order: 0,
        collapsed: false,
        displayMode: 'grid',
        accent: '#10b981',
        bookmarks: [
          { id: 'bm-1', name: 'Repo', url: 'https://github.com', order: 0, icon: null }
        ]
      }
    ]
  };

  const migrated = migrate(v2Doc);
  assert.equal(migrated.version, 3);
  // Preserved v2 data
  assert.equal(migrated.settings.theme, 'dark');
  assert.equal(migrated.settings.accent, 'emerald');
  assert.equal(migrated.settings.palette, 'amoled');
  assert.equal(migrated.settings.cards.style, 'frosted');
  assert.equal(migrated.categories[0].id, 'cat-work');
  assert.equal(migrated.categories[0].displayMode, 'grid');
  assert.equal(migrated.categories[0].accent, '#10b981');

  // Injected v3 defaults
  assert.equal(migrated.settings.page, 'classic');
  assert.equal(migrated.settings.landing, 'hero');
  assert.equal(migrated.settings.hero.layout, 'studio');
  assert.equal(migrated.settings.dock.position, 'top');
  assert.equal(migrated.settings.dock.maxItems, 12);
  assert.equal(migrated.settings.glass.blur, 16);
  assert.equal(migrated.settings.glass.opacity, 0.62);
  assert.equal(migrated.settings.weather.enabled, false);
  assert.equal(migrated.settings.hub.view, 'columns');

  // Repaired category fields
  assert.equal(migrated.categories[0].color, null);
  assert.equal(migrated.categories[0].source, null);
  assert.equal(migrated.categories[0].savedAt, null);

  const val = validateDashboardData(migrated);
  assert.equal(val.valid, true);
});

test('8.1 Category Tab Group fields: preserves valid color, source, savedAt and clamps invalid values', () => {
  const rawCats = [
    {
      id: 'cat-tabs',
      name: 'Research Session',
      color: 'cyan',
      source: 'tabs',
      savedAt: '2026-10-05T12:00:00.000Z',
      bookmarks: [{ id: 'b1', name: 'Doc', url: 'https://example.com' }]
    },
    {
      id: 'cat-invalid',
      name: 'Bad Fields',
      color: 'not-a-real-color',
      source: 'invalid-source',
      savedAt: 'not-a-valid-date',
      bookmarks: [{ id: 'b2', name: 'Doc 2', url: 'https://example.org' }]
    }
  ];

  const repaired = repairCategories(rawCats, 'space-home');
  assert.equal(repaired[0].color, 'cyan');
  assert.equal(repaired[0].source, 'tabs');
  assert.equal(repaired[0].savedAt, '2026-10-05T12:00:00.000Z');

  // Invalid clamped to null
  assert.equal(repaired[1].color, null);
  assert.equal(repaired[1].source, null);
  assert.equal(repaired[1].savedAt, null);
});

test('8.1 Settings repair & clamp: clamps glass blur, glass opacity, dock maxItems, and lat/lon', () => {
  const custom = {
    page: 'unsupported-page',
    landing: 'unsupported-landing',
    cards: { style: 'glass' },
    dock: { position: 'invalid-pos', autoHide: true, maxItems: 999 },
    glass: { blur: 100, opacity: 0.1 },
    weather: { enabled: true, city: 'London', lat: 150, lon: -200, unit: 'kelvin' },
    hub: { view: 'grid' }
  };

  const repaired = repairSettings(custom);
  assert.equal(repaired.page, 'classic');
  assert.equal(repaired.landing, 'hero');
  assert.equal(repaired.cards.style, 'glass');
  assert.equal(repaired.dock.position, 'top');
  assert.equal(repaired.dock.autoHide, true);
  assert.equal(repaired.dock.maxItems, 24); // clamped to max 24
  assert.equal(repaired.glass.blur, 20); // clamped to max 20
  assert.equal(repaired.glass.opacity, 0.45); // clamped to min 0.45
  assert.equal(repaired.weather.lat, null); // out of range -> null
  assert.equal(repaired.weather.lon, null); // out of range -> null
  assert.equal(repaired.weather.unit, 'c');
  assert.equal(repaired.hub.view, 'columns');
});

test('8.1 Validation: validates all enum lists and detects malformed values', () => {
  assert.deepEqual(VALID_TAB_GROUP_COLORS, ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']);
  assert.deepEqual(VALID_DOCK_POSITIONS, ['top', 'left', 'bottom', 'right', 'off']);
  assert.deepEqual(VALID_PAGE_MODES, ['two-stage', 'classic']);
  assert.deepEqual(VALID_LANDING_MODES, ['hero', 'remember']);
  assert.deepEqual(VALID_HERO_LAYOUTS, ['studio', 'centered']);
  assert.deepEqual(VALID_HUB_VIEWS, ['columns', 'tabs']);

  const validDoc = createDefaultDashboardData();
  validDoc.settings.page = 'two-stage';
  validDoc.settings.cards.style = 'glass';
  validDoc.settings.dock.position = 'bottom';
  validDoc.categories[0].color = 'purple';
  validDoc.categories[0].source = 'tabs';
  validDoc.categories[0].savedAt = '2026-10-05T12:00:00.000Z';
  assert.equal(validateDashboardData(validDoc).valid, true);

  const invalidDoc = JSON.parse(JSON.stringify(validDoc));
  invalidDoc.settings.dock.position = 'middle';
  invalidDoc.categories[0].color = 'neon-pink';
  const val = validateDashboardData(invalidDoc);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some(e => e.includes('dock position')));
  assert.ok(val.errors.some(e => e.includes('invalid color')));
});
