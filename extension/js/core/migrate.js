// @ts-check
import { CURRENT_SCHEMA_VERSION, createDefaultDashboardData, createDefaultSettings, generateId } from './schema.js';
import { normalizeUrl } from '../utils/url.js';

/**
 * Repairs or creates spaces list and activeSpaceId.
 * @param {any[]} [rawSpaces]
 * @param {string} [rawActiveSpaceId]
 * @returns {{ spaces: import('./schema.js').Space[], activeSpaceId: string }}
 */
export function repairSpaces(rawSpaces, rawActiveSpaceId) {
  const seenSpaceIds = new Set();
  const spaces = [];

  if (Array.isArray(rawSpaces)) {
    rawSpaces.forEach((s, idx) => {
      if (!s || typeof s !== 'object') return;
      let id = (typeof s.id === 'string' && s.id.trim()) ? s.id.trim() : generateId();
      if (seenSpaceIds.has(id)) id = generateId();
      seenSpaceIds.add(id);

      const name = (typeof s.name === 'string' && s.name.trim()) ? s.name.trim().slice(0, 80) : 'Space';
      const icon = (typeof s.icon === 'string' && s.icon.trim()) ? s.icon.trim().slice(0, 8) : '🏠';
      const order = typeof s.order === 'number' ? s.order : idx;
      const pinned = Array.isArray(s.pinned)
        ? s.pinned.filter(p => typeof p === 'string' && p.trim().length > 0)
        : [];

      spaces.push({ id, name, icon, order, pinned });
    });
  }

  if (spaces.length === 0) {
    const homeId = generateId();
    spaces.push({ id: homeId, name: 'Home', icon: '🏠', order: 0, pinned: [] });
  }

  const activeSpaceId = typeof rawActiveSpaceId === 'string' && spaces.some(s => s.id === rawActiveSpaceId)
    ? rawActiveSpaceId
    : spaces[0].id;

  return { spaces, activeSpaceId };
}

/**
 * Merges defaults and clamps enum fields to valid choices.
 * Settings are repaired, never grounds for discarding user data.
 *
 * @param {any} settings
 * @returns {import('./schema.js').DashboardData['settings']}
 */
export function repairSettings(settings) {
  const defaults = createDefaultSettings();
  const s = (settings && typeof settings === 'object') ? Object.assign({}, settings) : {};

  const validThemes = ['system', 'light', 'dark'];
  s.theme = validThemes.includes(s.theme) ? s.theme : defaults.theme;

  const validPalettes = ['default', 'amoled', 'paper', 'contrast'];
  s.palette = validPalettes.includes(s.palette) ? s.palette : defaults.palette;

  const validAccents = ['slate', 'blue', 'emerald', 'amber', 'rose', 'custom'];
  s.accent = validAccents.includes(s.accent) ? s.accent : defaults.accent;

  if (s.accent === 'custom' && typeof s.accentCustom === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.accentCustom)) {
    // Keep valid custom hex
  } else {
    s.accentCustom = null;
    if (s.accent === 'custom') s.accent = defaults.accent;
  }

  const validLayouts = ['grid', 'compact'];
  s.layout = validLayouts.includes(s.layout) ? s.layout : defaults.layout;

  const validEngines = ['google', 'brave', 'duckduckgo', 'bing'];
  s.searchEngine = validEngines.includes(s.searchEngine) ? s.searchEngine : defaults.searchEngine;

  const validTimeFormats = ['12h', '24h'];
  s.timeFormat = validTimeFormats.includes(s.timeFormat) ? s.timeFormat : defaults.timeFormat;

  s.userName = (typeof s.userName === 'string') ? s.userName.slice(0, 80) : defaults.userName;
  s.showClock = typeof s.showClock === 'boolean' ? s.showClock : defaults.showClock;
  s.showDate = typeof s.showDate === 'boolean' ? s.showDate : defaults.showDate;
  s.showGreeting = typeof s.showGreeting === 'boolean' ? s.showGreeting : defaults.showGreeting;
  s.largeTargets = typeof s.largeTargets === 'boolean' ? s.largeTargets : defaults.largeTargets;
  s.firstRunDone = typeof s.firstRunDone === 'boolean' ? s.firstRunDone : defaults.firstRunDone;

  const validMotions = ['system', 'reduce'];
  s.motion = validMotions.includes(s.motion) ? s.motion : defaults.motion;

  // themeSchedule
  const ts = (s.themeSchedule && typeof s.themeSchedule === 'object') ? s.themeSchedule : {};
  s.themeSchedule = {
    enabled: Boolean(ts.enabled),
    lightFrom: typeof ts.lightFrom === 'string' ? ts.lightFrom : defaults.themeSchedule.lightFrom,
    darkFrom: typeof ts.darkFrom === 'string' ? ts.darkFrom : defaults.themeSchedule.darkFrom
  };

  // cards
  const c = (s.cards && typeof s.cards === 'object') ? s.cards : {};
  const validCardStyles = ['filled', 'outlined', 'subtle'];
  const validAligns = ['center', 'left'];
  s.cards = {
    style: validCardStyles.includes(c.style) ? c.style : defaults.cards.style,
    translucent: Boolean(c.translucent),
    columns: (c.columns === 'auto' || [1, 2, 3, 4, 5, 6].includes(c.columns)) ? c.columns : defaults.cards.columns,
    width: (typeof c.width === 'number' && c.width >= 200 && c.width <= 600) ? c.width : defaults.cards.width,
    gap: (typeof c.gap === 'number' && c.gap >= 0 && c.gap <= 48) ? c.gap : defaults.cards.gap,
    align: validAligns.includes(c.align) ? c.align : defaults.cards.align,
    equalHeight: typeof c.equalHeight === 'boolean' ? c.equalHeight : defaults.cards.equalHeight,
    verticalCenter: Boolean(c.verticalCenter)
  };

  // display
  const d = (s.display && typeof s.display === 'object') ? s.display : {};
  const validModes = ['list', 'grid', 'icons'];
  const validShapes = ['rounded', 'circle', 'square'];
  const validDensities = ['compact', 'comfortable', 'spacious'];
  s.display = {
    defaultMode: validModes.includes(d.defaultMode) ? d.defaultMode : defaults.display.defaultMode,
    iconSize: (typeof d.iconSize === 'number' && d.iconSize >= 14 && d.iconSize <= 48) ? d.iconSize : defaults.display.iconSize,
    tileShape: validShapes.includes(d.tileShape) ? d.tileShape : defaults.display.tileShape,
    showDomains: typeof d.showDomains === 'boolean' ? d.showDomains : defaults.display.showDomains,
    density: validDensities.includes(d.density) ? d.density : defaults.display.density
  };

  // clock
  const clk = (s.clock && typeof s.clock === 'object') ? s.clock : {};
  const validClockStyles = ['large', 'minimal', 'analog', 'off'];
  const validDateFormats = ['weekday-short', 'full', 'short', 'off'];
  s.clock = {
    style: validClockStyles.includes(clk.style) ? clk.style : defaults.clock.style,
    showSeconds: Boolean(clk.showSeconds),
    secondTimezone: typeof clk.secondTimezone === 'string' ? clk.secondTimezone : null,
    dateFormat: validDateFormats.includes(clk.dateFormat) ? clk.dateFormat : defaults.clock.dateFormat
  };

  // font
  const f = (s.font && typeof s.font === 'object') ? s.font : {};
  const validFontFamilies = ['system', 'sans', 'serif', 'mono'];
  s.font = {
    family: validFontFamilies.includes(f.family) ? f.family : defaults.font.family,
    scale: (typeof f.scale === 'number' && f.scale >= 0.8 && f.scale <= 1.4) ? f.scale : defaults.font.scale
  };

  // countdown
  const cd = (s.countdown && typeof s.countdown === 'object') ? s.countdown : {};
  s.countdown = {
    label: typeof cd.label === 'string' ? cd.label.slice(0, 80) : '',
    date: typeof cd.date === 'string' ? cd.date : null
  };

  // behavior
  const b = (s.behavior && typeof s.behavior === 'object') ? s.behavior : {};
  const bSearch = (b.search && typeof b.search === 'object') ? b.search : {};
  const validOpenIn = ['same', 'new'];
  const validShortcuts = Array.isArray(bSearch.shortcuts)
    ? bSearch.shortcuts.filter(sc => sc && typeof sc.key === 'string' && typeof sc.url === 'string')
        .map(sc => ({
          key: sc.key.slice(0, 12),
          name: (typeof sc.name === 'string' ? sc.name.slice(0, 80) : sc.key.slice(0, 12)),
          url: sc.url
        }))
    : defaults.behavior.search.shortcuts;

  s.behavior = {
    openIn: validOpenIn.includes(b.openIn) ? b.openIn : defaults.behavior.openIn,
    autoHide: Boolean(b.autoHide),
    search: {
      filterBookmarks: typeof bSearch.filterBookmarks === 'boolean' ? bSearch.filterBookmarks : defaults.behavior.search.filterBookmarks,
      calculator: typeof bSearch.calculator === 'boolean' ? bSearch.calculator : defaults.behavior.search.calculator,
      shortcuts: validShortcuts
    }
  };

  // widgets
  const w = (s.widgets && typeof s.widgets === 'object') ? s.widgets : {};
  s.widgets = {
    notes: Boolean(w.notes),
    todo: Boolean(w.todo)
  };

  // background
  const bg = (s.background && typeof s.background === 'object') ? s.background : {};
  const validBgTypes = ['none', 'solid', 'gradient', 'image'];
  let bgType = validBgTypes.includes(bg.type) ? bg.type : defaults.background.type;
  const bgDim = (typeof bg.dim === 'number' && bg.dim >= 0 && bg.dim <= 1) ? bg.dim : defaults.background.dim;
  let bgVal = bg.value;

  if (bgType === 'solid') {
    if (typeof bgVal !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bgVal)) {
      bgVal = null;
      bgType = 'none';
    }
  } else if (bgType === 'gradient') {
    if (bgVal && typeof bgVal === 'object' &&
        typeof bgVal.from === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bgVal.from) &&
        typeof bgVal.to === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bgVal.to)) {
      bgVal = {
        from: bgVal.from,
        to: bgVal.to,
        angle: (typeof bgVal.angle === 'number' && bgVal.angle >= 0 && bgVal.angle <= 360) ? bgVal.angle : 135
      };
    } else {
      bgVal = null;
      bgType = 'none';
    }
  } else if (bgType === 'image') {
    if (typeof bgVal === 'string' && bgVal.toLowerCase().includes('url(')) {
      bgVal = null;
      bgType = 'none';
    }
  } else {
    bgVal = null;
  }

  const validRotations = ['off', 'tab', 'hourly', 'daily'];
  s.background = {
    type: bgType,
    value: bgVal,
    dim: bgDim,
    autoReadability: typeof bg.autoReadability === 'boolean' ? bg.autoReadability : defaults.background.autoReadability,
    blur: (typeof bg.blur === 'number' && bg.blur >= 0 && bg.blur <= 20) ? bg.blur : 0,
    fit: ['cover', 'contain', 'fill'].includes(bg.fit) ? bg.fit : 'cover',
    focal: (bg.focal && typeof bg.focal.x === 'number' && typeof bg.focal.y === 'number')
      ? { x: Math.max(0, Math.min(1, bg.focal.x)), y: Math.max(0, Math.min(1, bg.focal.y)) }
      : { x: 0.5, y: 0.5 },
    wallpapers: Array.isArray(bg.wallpapers) ? bg.wallpapers : [],
    activeId: typeof bg.activeId === 'string' ? bg.activeId : null,
    dayId: typeof bg.dayId === 'string' ? bg.dayId : null,
    nightId: typeof bg.nightId === 'string' ? bg.nightId : null,
    rotation: validRotations.includes(bg.rotation) ? bg.rotation : 'off'
  };

  return s;
}

/**
 * Repairs categories and bookmarks item-by-item, dropping only individual invalid items.
 *
 * @param {any[]} rawCategories
 * @param {string} [fallbackSpaceId]
 * @returns {import('./schema.js').Category[]}
 */
export function repairCategories(rawCategories, fallbackSpaceId = null) {
  if (!Array.isArray(rawCategories)) return [];
  const seenCatIds = new Set();
  const seenBmIds = new Set();
  const repaired = [];

  rawCategories.forEach((cat, cIdx) => {
    if (!cat || typeof cat !== 'object') return;
    let catId = (typeof cat.id === 'string' && cat.id.trim()) ? cat.id.trim() : generateId();
    if (seenCatIds.has(catId)) catId = generateId();
    seenCatIds.add(catId);

    const spaceId = (typeof cat.spaceId === 'string' && cat.spaceId.trim()) ? cat.spaceId.trim() : fallbackSpaceId;
    const rawCatName = (typeof cat.name === 'string' && cat.name.trim()) ? cat.name.trim() : 'Collection';
    const catName = rawCatName.slice(0, 80);
    const rawCatIcon = (typeof cat.icon === 'string' && cat.icon.trim()) ? cat.icon.trim() : '📁';
    const catIcon = rawCatIcon.slice(0, 8);
    const catOrder = typeof cat.order === 'number' ? cat.order : cIdx;
    const catCollapsed = Boolean(cat.collapsed);

    const validDisplayModes = ['list', 'grid', 'icons'];
    const displayMode = validDisplayModes.includes(cat.displayMode) ? cat.displayMode : null;
    const accent = (typeof cat.accent === 'string' && cat.accent.length <= 40) ? cat.accent : null;

    const validBookmarks = [];
    if (Array.isArray(cat.bookmarks)) {
      cat.bookmarks.forEach((bm, bIdx) => {
        if (!bm || typeof bm !== 'object') return;
        const norm = normalizeUrl(bm.url || '');
        if (!norm.valid) return; // Drop invalid bookmark

        let bmId = (typeof bm.id === 'string' && bm.id.trim()) ? bm.id.trim() : generateId();
        if (seenBmIds.has(bmId)) bmId = generateId();
        seenBmIds.add(bmId);

        const rawBmName = (typeof bm.name === 'string' && bm.name.trim()) ? bm.name.trim() : norm.domain;
        const bmName = rawBmName.slice(0, 80);
        const bmOrder = typeof bm.order === 'number' ? bm.order : bIdx;

        let bmIcon = null;
        if (bm.icon && typeof bm.icon === 'object') {
          if (bm.icon.type === 'emoji' && typeof bm.icon.value === 'string') {
            bmIcon = { type: 'emoji', value: bm.icon.value.slice(0, 8) };
          } else if (bm.icon.type === 'image' && typeof bm.icon.value === 'string' && bm.icon.value.length <= 12288 && !bm.icon.value.toLowerCase().includes('url(')) {
            bmIcon = { type: 'image', value: bm.icon.value };
          }
        }

        validBookmarks.push({
          id: bmId,
          name: bmName,
          url: norm.url,
          order: bmOrder,
          icon: bmIcon
        });
      });
    }

    repaired.push({
      id: catId,
      spaceId,
      name: catName,
      icon: catIcon,
      order: catOrder,
      collapsed: catCollapsed,
      displayMode,
      accent,
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

  const { spaces, activeSpaceId } = repairSpaces(doc.spaces, doc.activeSpaceId);
  const repairedSettings = repairSettings(doc.settings);
  // Upgrading an existing install (e.g. legacy v0, v1, or document without firstRunDone flag)
  // must never show first-run templates/tour.
  if (typeof doc?.settings?.firstRunDone !== 'boolean') {
    repairedSettings.firstRunDone = true;
  }
  const repairedCats = repairCategories(doc.categories, activeSpaceId);
  const spaceIdSet = new Set(spaces.map(s => s.id));
  repairedCats.forEach(cat => {
    if (!cat.spaceId || !spaceIdSet.has(cat.spaceId)) {
      cat.spaceId = activeSpaceId;
    }
  });

  return {
    version: targetVersion,
    activeSpaceId,
    spaces,
    settings: repairedSettings,
    categories: repairedCats
  };
}
