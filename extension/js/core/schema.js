// @ts-check
import { normalizeUrl } from '../utils/url.js';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Generates a unique identifier.
 * Uses crypto.randomUUID where supported, falling back to a time+random string.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

/**
 * Initial seed data for first launch.
 * @returns {import('./schema.js').DashboardData}
 */
export function createDefaultDashboardData() {
  return {
    version: CURRENT_SCHEMA_VERSION,
    settings: {
      theme: 'system',
      accent: 'slate',
      layout: 'grid',
      showClock: true,
      showDate: true,
      showGreeting: true,
      timeFormat: '12h',
      searchEngine: 'google',
      background: {
        type: 'none',
        value: null,
        dim: 0.35
      }
    },
    categories: [
      {
        id: generateId(),
        name: 'Development',
        icon: '💻',
        order: 0,
        collapsed: false,
        bookmarks: [
          { id: generateId(), name: 'GitHub', url: 'https://github.com', order: 0 },
          { id: generateId(), name: 'Stack Overflow', url: 'https://stackoverflow.com', order: 1 },
          { id: generateId(), name: 'MDN Web Docs', url: 'https://developer.mozilla.org', order: 2 },
          { id: generateId(), name: 'Hacker News', url: 'https://news.ycombinator.com', order: 3 }
        ]
      },
      {
        id: generateId(),
        name: 'Professional',
        icon: '💼',
        order: 1,
        collapsed: false,
        bookmarks: [
          { id: generateId(), name: 'LinkedIn', url: 'https://linkedin.com', order: 0 },
          { id: generateId(), name: 'Gmail', url: 'https://mail.google.com', order: 1 },
          { id: generateId(), name: 'Google Calendar', url: 'https://calendar.google.com', order: 2 },
          { id: generateId(), name: 'Google Drive', url: 'https://drive.google.com', order: 3 }
        ]
      },
      {
        id: generateId(),
        name: 'Media & Reading',
        icon: '📚',
        order: 2,
        collapsed: false,
        bookmarks: [
          { id: generateId(), name: 'YouTube', url: 'https://youtube.com', order: 0 },
          { id: generateId(), name: 'Reddit', url: 'https://reddit.com', order: 1 },
          { id: generateId(), name: 'Spotify', url: 'https://open.spotify.com', order: 2 },
          { id: generateId(), name: 'Wikipedia', url: 'https://wikipedia.org', order: 3 }
        ]
      },
      {
        id: generateId(),
        name: 'College & Tools',
        icon: '🎓',
        order: 3,
        collapsed: false,
        bookmarks: [
          { id: generateId(), name: 'College Portal', url: 'https://vtop.vit.ac.in', order: 0 },
          { id: generateId(), name: 'Notion', url: 'https://notion.so', order: 1 },
          { id: generateId(), name: 'Wolfram Alpha', url: 'https://wolframalpha.com', order: 2 }
        ]
      }
    ]
  };
}

/**
 * Validates arbitrary input data to ensure conformance with DashboardData schema.
 * @param {any} input
 * @returns {{ valid: boolean, errors: string[], data?: any }}
 */
export function validateDashboardData(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be a valid JSON object'] };
  }

  if (typeof input.version !== 'number') {
    errors.push('Missing or invalid schema version number');
  }

  // Validate settings
  const settings = input.settings;
  if (!settings || typeof settings !== 'object') {
    errors.push('Missing settings object');
  } else {
    const validThemes = ['system', 'light', 'dark'];
    if (!validThemes.includes(settings.theme)) {
      errors.push(`Invalid theme: "${settings.theme}". Must be one of: ${validThemes.join(', ')}`);
    }

    const validAccents = ['slate', 'blue', 'emerald', 'amber', 'rose'];
    if (!validAccents.includes(settings.accent)) {
      errors.push(`Invalid accent: "${settings.accent}". Must be one of: ${validAccents.join(', ')}`);
    }

    const validLayouts = ['grid', 'compact'];
    if (!validLayouts.includes(settings.layout)) {
      errors.push(`Invalid layout: "${settings.layout}". Must be one of: ${validLayouts.join(', ')}`);
    }

    const validEngines = ['google', 'brave', 'duckduckgo', 'bing'];
    if (!validEngines.includes(settings.searchEngine)) {
      errors.push(`Invalid searchEngine: "${settings.searchEngine}". Must be one of: ${validEngines.join(', ')}`);
    }
  }

  // Validate categories
  if (!Array.isArray(input.categories)) {
    errors.push('categories property must be an array');
  } else {
    const seenCatIds = new Set();
    input.categories.forEach((cat, cIdx) => {
      if (!cat || typeof cat !== 'object') {
        errors.push(`Category at index ${cIdx} is not an object`);
        return;
      }
      if (!cat.id || typeof cat.id !== 'string') {
        errors.push(`Category at index ${cIdx} must have a valid string id`);
      } else if (seenCatIds.has(cat.id)) {
        errors.push(`Duplicate category id "${cat.id}" found`);
      } else {
        seenCatIds.add(cat.id);
      }

      if (!cat.name || typeof cat.name !== 'string' || cat.name.trim().length === 0) {
        errors.push(`Category at index ${cIdx} must have a non-empty name`);
      }

      if (!Array.isArray(cat.bookmarks)) {
        errors.push(`Category "${cat.name || cIdx}" bookmarks must be an array`);
      } else {
        const seenBmIds = new Set();
        cat.bookmarks.forEach((bm, bIdx) => {
          if (!bm || typeof bm !== 'object') {
            errors.push(`Bookmark at index ${bIdx} in category "${cat.name}" is not an object`);
            return;
          }
          if (!bm.id || typeof bm.id !== 'string') {
            errors.push(`Bookmark at index ${bIdx} in category "${cat.name}" must have a valid string id`);
          } else if (seenBmIds.has(bm.id)) {
            errors.push(`Duplicate bookmark id "${bm.id}" in category "${cat.name}"`);
          } else {
            seenBmIds.add(bm.id);
          }

          if (!bm.name || typeof bm.name !== 'string' || bm.name.trim().length === 0) {
            errors.push(`Bookmark at index ${bIdx} in category "${cat.name}" must have a non-empty name`);
          }

          const norm = normalizeUrl(bm.url);
          if (!norm.valid) {
            errors.push(`Bookmark "${bm.name || bIdx}" has invalid URL: ${bm.url} (${norm.error})`);
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? input : undefined
  };
}
