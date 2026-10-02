// @ts-check
import { normalizeUrl } from '../utils/url.js';

export const CURRENT_SCHEMA_VERSION = 2;

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
 * Default settings for schema v2.
 */
export function createDefaultSettings() {
  return {
    theme: 'system',
    accent: 'slate',
    accentCustom: null,
    layout: 'grid',
    showClock: true,
    showDate: true,
    showGreeting: true,
    timeFormat: '12h',
    searchEngine: 'google',
    palette: 'default',
    userName: '',
    themeSchedule: { enabled: false, lightFrom: '07:00', darkFrom: '19:00' },
    cards: {
      style: 'filled',
      translucent: false,
      columns: 'auto',
      width: 340,
      gap: 16,
      align: 'center',
      equalHeight: true,
      verticalCenter: false
    },
    display: {
      defaultMode: 'list',
      iconSize: 20,
      tileShape: 'rounded',
      showDomains: true,
      density: 'comfortable'
    },
    clock: {
      style: 'large',
      showSeconds: false,
      secondTimezone: null,
      dateFormat: 'weekday-short'
    },
    font: { family: 'system', scale: 1 },
    countdown: { label: '', date: null },
    behavior: {
      openIn: 'same',
      autoHide: false,
      search: {
        filterBookmarks: true,
        calculator: true,
        shortcuts: [
          { key: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' }
        ]
      }
    },
    motion: 'system',
    largeTargets: false,
    background: {
      type: 'none',
      value: null,
      dim: 0.35,
      autoReadability: true,
      blur: 0,
      fit: 'cover',
      focal: { x: 0.5, y: 0.5 },
      wallpapers: [],
      activeId: null,
      dayId: null,
      nightId: null,
      rotation: 'off'
    },
    widgets: { notes: false, todo: false },
    firstRunDone: false
  };
}

/**
 * Default spaces for schema v2.
 */
export function createDefaultSpaces() {
  const homeSpaceId = generateId();
  return {
    activeSpaceId: homeSpaceId,
    spaces: [
      { id: homeSpaceId, name: 'Home', icon: '🏠', order: 0, pinned: [] }
    ]
  };
}

/**
 * Initial seed data for first launch (schema v2).
 * @returns {import('./schema.js').DashboardData}
 */
export function createDefaultDashboardData() {
  const { activeSpaceId, spaces } = createDefaultSpaces();
  return {
    version: CURRENT_SCHEMA_VERSION,
    activeSpaceId,
    spaces,
    settings: createDefaultSettings(),
    categories: [
      {
        id: generateId(),
        spaceId: activeSpaceId,
        name: 'Development',
        icon: '💻',
        order: 0,
        collapsed: false,
        displayMode: null,
        accent: null,
        bookmarks: [
          { id: generateId(), name: 'GitHub', url: 'https://github.com', order: 0, icon: null },
          { id: generateId(), name: 'Stack Overflow', url: 'https://stackoverflow.com', order: 1, icon: null },
          { id: generateId(), name: 'MDN Web Docs', url: 'https://developer.mozilla.org', order: 2, icon: null },
          { id: generateId(), name: 'Hacker News', url: 'https://news.ycombinator.com', order: 3, icon: null }
        ]
      },
      {
        id: generateId(),
        spaceId: activeSpaceId,
        name: 'Professional',
        icon: '💼',
        order: 1,
        collapsed: false,
        displayMode: null,
        accent: null,
        bookmarks: [
          { id: generateId(), name: 'LinkedIn', url: 'https://linkedin.com', order: 0, icon: null },
          { id: generateId(), name: 'Gmail', url: 'https://mail.google.com', order: 1, icon: null },
          { id: generateId(), name: 'Google Calendar', url: 'https://calendar.google.com', order: 2, icon: null },
          { id: generateId(), name: 'Google Drive', url: 'https://drive.google.com', order: 3, icon: null }
        ]
      },
      {
        id: generateId(),
        spaceId: activeSpaceId,
        name: 'Media & Reading',
        icon: '📚',
        order: 2,
        collapsed: false,
        displayMode: null,
        accent: null,
        bookmarks: [
          { id: generateId(), name: 'YouTube', url: 'https://youtube.com', order: 0, icon: null },
          { id: generateId(), name: 'Reddit', url: 'https://reddit.com', order: 1, icon: null },
          { id: generateId(), name: 'Spotify', url: 'https://open.spotify.com', order: 2, icon: null },
          { id: generateId(), name: 'Wikipedia', url: 'https://wikipedia.org', order: 3, icon: null }
        ]
      },
      {
        id: generateId(),
        spaceId: activeSpaceId,
        name: 'Reference & Tools',
        icon: '🎓',
        order: 3,
        collapsed: false,
        displayMode: null,
        accent: null,
        bookmarks: [
          { id: generateId(), name: 'Khan Academy', url: 'https://khanacademy.org', order: 0, icon: null },
          { id: generateId(), name: 'Notion', url: 'https://notion.so', order: 1, icon: null },
          { id: generateId(), name: 'Wolfram Alpha', url: 'https://wolframalpha.com', order: 2, icon: null }
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

  // Validate spaces (schema v2)
  const seenSpaceIds = new Set();
  if (input.spaces != null) {
    if (!Array.isArray(input.spaces) || input.spaces.length === 0) {
      errors.push('spaces property must be a non-empty array');
    } else {
      input.spaces.forEach((s, sIdx) => {
        if (!s || typeof s !== 'object') {
          errors.push(`Space at index ${sIdx} is not an object`);
          return;
        }
        if (!s.id || typeof s.id !== 'string') {
          errors.push(`Space at index ${sIdx} must have a valid string id`);
        } else if (seenSpaceIds.has(s.id)) {
          errors.push(`Duplicate space id "${s.id}" found`);
        } else {
          seenSpaceIds.add(s.id);
        }
        if (!s.name || typeof s.name !== 'string' || s.name.trim().length === 0) {
          errors.push(`Space at index ${sIdx} must have a non-empty name`);
        }
        if (!Array.isArray(s.pinned)) {
          errors.push(`Space at index ${sIdx} must have a pinned array`);
        }
      });
    }

    if (input.activeSpaceId != null) {
      if (typeof input.activeSpaceId !== 'string' || !seenSpaceIds.has(input.activeSpaceId)) {
        errors.push(`activeSpaceId "${input.activeSpaceId}" does not match any existing space`);
      }
    }
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

    if (settings.palette != null) {
      const validPalettes = ['default', 'amoled', 'paper', 'contrast'];
      if (!validPalettes.includes(settings.palette)) {
        errors.push(`Invalid palette: "${settings.palette}". Must be one of: ${validPalettes.join(', ')}`);
      }
    }

    const validAccents = ['slate', 'blue', 'emerald', 'amber', 'rose', 'custom'];
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

    if (settings.background && typeof settings.background === 'object') {
      const bg = settings.background;
      const validBgTypes = ['none', 'solid', 'gradient', 'image'];
      if (!validBgTypes.includes(bg.type)) {
        errors.push(`Invalid background type: "${bg.type}". Must be one of: ${validBgTypes.join(', ')}`);
      }
      if (bg.value != null) {
        if (typeof bg.value === 'string' && bg.value.toLowerCase().includes('url(')) {
          errors.push('Background value must not contain url()');
        } else if (bg.type === 'solid' && typeof bg.value === 'string') {
          if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bg.value)) {
            errors.push(`Invalid solid background color: "${bg.value}". Must be a valid hex code`);
          }
        } else if (bg.type === 'gradient' && typeof bg.value === 'object') {
          if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bg.value.from) ||
              !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bg.value.to)) {
            errors.push('Invalid gradient background: from and to must be valid hex codes');
          }
        }
      }
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

      if (seenSpaceIds.size > 0 && cat.spaceId && !seenSpaceIds.has(cat.spaceId)) {
        errors.push(`Category "${cat.name || cIdx}" has invalid spaceId "${cat.spaceId}"`);
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
