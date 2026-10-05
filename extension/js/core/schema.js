// @ts-check
import { normalizeUrl } from '../utils/url.js';

export const CURRENT_SCHEMA_VERSION = 3;

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

export const VALID_TAB_GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
export const VALID_HERO_LAYOUTS = ['studio', 'centered'];
export const VALID_DOCK_POSITIONS = ['top', 'left', 'bottom', 'right', 'off'];
export const VALID_PAGE_MODES = ['two-stage', 'classic'];
export const VALID_LANDING_MODES = ['hero', 'remember'];
export const VALID_HUB_VIEWS = ['columns', 'tabs'];

/**
 * Default settings for schema v3.
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
    page: 'two-stage',
    landing: 'hero',
    hero: {
      layout: 'studio',
      zones: { clock: 'left', weather: 'right', search: 'right', quote: 'left', tasks: 'off' },
      widgets: {
        clock:   { x: null, y: null, w: null, hidden: false },
        weather: { x: null, y: null, w: null, hidden: false },
        search:  { x: null, y: null, w: null, hidden: false },
        quote:   { x: null, y: null, w: null, hidden: false },
        tasks:   { x: null, y: null, w: null, hidden: true }
      }
    },
    dock: {
      position: 'top',
      autoHide: false,
      maxItems: 12
    },
    glass: {
      blur: 16,
      opacity: 0.62
    },
    weather: {
      enabled: false,
      city: '',
      lat: null,
      lon: null,
      unit: 'c'
    },
    quote: {
      enabled: true
    },
    tabs: {
      closeAfterSave: false,
      openAsGroup: true
    },
    hub: {
      view: 'columns'
    },
    themeSchedule: { enabled: false, mode: 'hours', lightFrom: '07:00', darkFrom: '19:00' },
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
      { id: homeSpaceId, name: 'Home', icon: '🏠', order: 0, pinned: [], note: '', todos: [] }
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
        color: null,
        source: null,
        savedAt: null,
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
        color: null,
        source: null,
        savedAt: null,
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
        color: null,
        source: null,
        savedAt: null,
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
        color: null,
        source: null,
        savedAt: null,
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

    if (settings.page != null && !VALID_PAGE_MODES.includes(settings.page)) {
      errors.push(`Invalid page mode: "${settings.page}". Must be one of: ${VALID_PAGE_MODES.join(', ')}`);
    }

    if (settings.landing != null && !VALID_LANDING_MODES.includes(settings.landing)) {
      errors.push(`Invalid landing mode: "${settings.landing}". Must be one of: ${VALID_LANDING_MODES.join(', ')}`);
    }

    if (settings.cards && typeof settings.cards === 'object') {
      const validCardStyles = ['filled', 'frosted', 'outline', 'minimal', 'glass'];
      if (settings.cards.style != null && !validCardStyles.includes(settings.cards.style)) {
        errors.push(`Invalid card style: "${settings.cards.style}". Must be one of: ${validCardStyles.join(', ')}`);
      }
    }

    if (settings.hero && typeof settings.hero === 'object') {
      if (settings.hero.layout != null && !VALID_HERO_LAYOUTS.includes(settings.hero.layout)) {
        errors.push(`Invalid hero layout: "${settings.hero.layout}". Must be one of: ${VALID_HERO_LAYOUTS.join(', ')}`);
      }
    }

    if (settings.dock && typeof settings.dock === 'object') {
      if (settings.dock.position != null && !VALID_DOCK_POSITIONS.includes(settings.dock.position)) {
        errors.push(`Invalid dock position: "${settings.dock.position}". Must be one of: ${VALID_DOCK_POSITIONS.join(', ')}`);
      }
      if (settings.dock.maxItems != null && (typeof settings.dock.maxItems !== 'number' || settings.dock.maxItems < 1 || settings.dock.maxItems > 24)) {
        errors.push('Invalid dock maxItems: must be between 1 and 24');
      }
    }

    if (settings.glass && typeof settings.glass === 'object') {
      if (settings.glass.blur != null && (typeof settings.glass.blur !== 'number' || settings.glass.blur < 0 || settings.glass.blur > 20)) {
        errors.push('Invalid glass blur: must be between 0 and 20');
      }
      if (settings.glass.opacity != null && (typeof settings.glass.opacity !== 'number' || settings.glass.opacity < 0.45 || settings.glass.opacity > 0.90)) {
        errors.push('Invalid glass opacity: must be between 0.45 and 0.90');
      }
    }

    if (settings.weather && typeof settings.weather === 'object') {
      if (settings.weather.lat != null && (typeof settings.weather.lat !== 'number' || settings.weather.lat < -90 || settings.weather.lat > 90)) {
        errors.push('Invalid weather lat: must be between -90 and 90');
      }
      if (settings.weather.lon != null && (typeof settings.weather.lon !== 'number' || settings.weather.lon < -180 || settings.weather.lon > 180)) {
        errors.push('Invalid weather lon: must be between -180 and 180');
      }
      if (settings.weather.unit != null && !['c', 'f'].includes(settings.weather.unit)) {
        errors.push('Invalid weather unit: must be "c" or "f"');
      }
    }

    if (settings.hub && typeof settings.hub === 'object') {
      if (settings.hub.view != null && !VALID_HUB_VIEWS.includes(settings.hub.view)) {
        errors.push(`Invalid hub view: "${settings.hub.view}". Must be one of: ${VALID_HUB_VIEWS.join(', ')}`);
      }
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

      if (cat.color != null && !VALID_TAB_GROUP_COLORS.includes(cat.color)) {
        errors.push(`Category "${cat.name || cIdx}" has invalid color "${cat.color}". Must be one of: ${VALID_TAB_GROUP_COLORS.join(', ')}`);
      }

      if (cat.source != null && cat.source !== 'tabs') {
        errors.push(`Category "${cat.name || cIdx}" has invalid source "${cat.source}". Must be "tabs" or null`);
      }

      if (cat.savedAt != null && (typeof cat.savedAt !== 'string' || isNaN(new Date(cat.savedAt).getTime()))) {
        errors.push(`Category "${cat.name || cIdx}" has invalid savedAt timestamp "${cat.savedAt}"`);
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
