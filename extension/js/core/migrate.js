// @ts-check
import { CURRENT_SCHEMA_VERSION, createDefaultDashboardData, generateId } from './schema.js';
import { normalizeUrl } from '../utils/url.js';

/**
 * Merges defaults and clamps enum fields to valid choices.
 * Settings are repaired, never grounds for discarding user data.
 *
 * @param {any} settings
 * @returns {import('./schema.js').DashboardData['settings']}
 */
export function repairSettings(settings) {
  const defaults = createDefaultDashboardData().settings;
  const s = (settings && typeof settings === 'object') ? Object.assign({}, settings) : {};

  const validThemes = ['system', 'light', 'dark'];
  s.theme = validThemes.includes(s.theme) ? s.theme : defaults.theme;

  const validAccents = ['slate', 'blue', 'emerald', 'amber', 'rose'];
  s.accent = validAccents.includes(s.accent) ? s.accent : defaults.accent;

  const validLayouts = ['grid', 'compact'];
  s.layout = validLayouts.includes(s.layout) ? s.layout : defaults.layout;

  const validEngines = ['google', 'brave', 'duckduckgo', 'bing'];
  s.searchEngine = validEngines.includes(s.searchEngine) ? s.searchEngine : defaults.searchEngine;

  const validTimeFormats = ['12h', '24h'];
  s.timeFormat = validTimeFormats.includes(s.timeFormat) ? s.timeFormat : defaults.timeFormat;

  s.showClock = typeof s.showClock === 'boolean' ? s.showClock : defaults.showClock;
  s.showDate = typeof s.showDate === 'boolean' ? s.showDate : defaults.showDate;
  s.showGreeting = typeof s.showGreeting === 'boolean' ? s.showGreeting : defaults.showGreeting;

  const bg = (s.background && typeof s.background === 'object') ? s.background : {};
  const validBgTypes = ['none', 'solid', 'gradient', 'image'];
  const bgType = validBgTypes.includes(bg.type) ? bg.type : defaults.background.type;
  const bgDim = (typeof bg.dim === 'number' && bg.dim >= 0 && bg.dim <= 1) ? bg.dim : defaults.background.dim;
  s.background = {
    type: bgType,
    value: typeof bg.value === 'string' ? bg.value : null,
    dim: bgDim
  };

  return s;
}

/**
 * Repairs categories and bookmarks item-by-item, dropping only individual invalid items.
 *
 * @param {any[]} rawCategories
 * @returns {import('./schema.js').Category[]}
 */
export function repairCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) return [];
  const seenCatIds = new Set();
  const seenBmIds = new Set();
  const repaired = [];

  rawCategories.forEach((cat, cIdx) => {
    if (!cat || typeof cat !== 'object') return;
    let catId = (typeof cat.id === 'string' && cat.id.trim()) ? cat.id.trim() : generateId();
    if (seenCatIds.has(catId)) catId = generateId();
    seenCatIds.add(catId);

    const catName = (typeof cat.name === 'string' && cat.name.trim()) ? cat.name.trim() : 'Collection';
    const catIcon = (typeof cat.icon === 'string' && cat.icon.trim()) ? cat.icon.trim() : '📁';
    const catOrder = typeof cat.order === 'number' ? cat.order : cIdx;
    const catCollapsed = Boolean(cat.collapsed);

    const validBookmarks = [];
    if (Array.isArray(cat.bookmarks)) {
      cat.bookmarks.forEach((bm, bIdx) => {
        if (!bm || typeof bm !== 'object') return;
        const norm = normalizeUrl(bm.url || '');
        if (!norm.valid) return; // Drop invalid bookmark

        let bmId = (typeof bm.id === 'string' && bm.id.trim()) ? bm.id.trim() : generateId();
        if (seenBmIds.has(bmId)) bmId = generateId();
        seenBmIds.add(bmId);

        const bmName = (typeof bm.name === 'string' && bm.name.trim()) ? bm.name.trim() : norm.domain;
        const bmOrder = typeof bm.order === 'number' ? bm.order : bIdx;

        validBookmarks.push({
          id: bmId,
          name: bmName,
          url: norm.url,
          order: bmOrder
        });
      });
    }

    repaired.push({
      id: catId,
      name: catName,
      icon: catIcon,
      order: catOrder,
      collapsed: catCollapsed,
      bookmarks: validBookmarks
    });
  });

  return repaired;
}

/**
 * Migration runner that upgrades older document structures to CURRENT_SCHEMA_VERSION.
 * Never replaces user data wholesale because of bad settings or single invalid items.
 *
 * @param {any} rawData
 * @returns {import('./schema.js').DashboardData}
 */
export function migrate(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return createDefaultDashboardData();
  }

  const doc = JSON.parse(JSON.stringify(rawData));
  const rawVersion = typeof doc.version === 'number' ? doc.version : 0;

  // Preserve future version tag without downgrading, or upgrade older versions
  const targetVersion = rawVersion > CURRENT_SCHEMA_VERSION ? rawVersion : CURRENT_SCHEMA_VERSION;

  const repairedSettings = repairSettings(doc.settings);
  const repairedCats = repairCategories(doc.categories);

  return {
    version: targetVersion,
    settings: repairedSettings,
    categories: repairedCats
  };
}
