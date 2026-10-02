// @ts-check
import { CURRENT_SCHEMA_VERSION, validateDashboardData, createDefaultDashboardData, generateId } from './schema.js';
import { normalizeUrl } from '../utils/url.js';

/**
 * Migration runner that upgrades older document structures to CURRENT_SCHEMA_VERSION.
 *
 * @param {any} rawData
 * @returns {import('./schema.js').DashboardData}
 */
export function migrate(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return createDefaultDashboardData();
  }

  let doc = JSON.parse(JSON.stringify(rawData));
  let version = typeof doc.version === 'number' ? doc.version : 0;

  // Migration from unversioned (v0) to v1
  if (version < 1) {
    doc.version = 1;
    doc.settings = Object.assign({
      theme: 'system',
      accent: 'slate',
      layout: 'grid',
      showClock: true,
      showDate: true,
      showGreeting: true,
      timeFormat: '12h',
      searchEngine: 'google',
      background: { type: 'none', value: null, dim: 0.35 }
    }, doc.settings || {});

    if (!Array.isArray(doc.categories)) {
      doc.categories = [];
    } else {
      doc.categories = doc.categories.map((cat, cIdx) => {
        const catId = typeof cat.id === 'string' ? cat.id : generateId();
        const bookmarks = Array.isArray(cat.bookmarks)
          ? cat.bookmarks.map((bm, bIdx) => {
              const bmId = typeof bm.id === 'string' ? bm.id : generateId();
              const norm = normalizeUrl(bm.url || '');
              return {
                id: bmId,
                name: String(bm.name || 'Untitled').trim(),
                url: norm.valid ? norm.url : 'https://example.com',
                order: typeof bm.order === 'number' ? bm.order : bIdx
              };
            })
          : [];

        return {
          id: catId,
          name: String(cat.name || 'Collection').trim(),
          icon: String(cat.icon || '📁'),
          order: typeof cat.order === 'number' ? cat.order : cIdx,
          collapsed: Boolean(cat.collapsed),
          bookmarks
        };
      });
    }
  }

  // Verify against validator
  const validation = validateDashboardData(doc);
  if (!validation.valid) {
    console.warn('Migrated document encountered validation issues, falling back to defaults:', validation.errors);
    return createDefaultDashboardData();
  }

  return doc;
}
