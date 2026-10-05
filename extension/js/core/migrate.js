// @ts-check
import { CURRENT_SCHEMA_VERSION, createDefaultDashboardData, createDefaultSettings, generateId, VALID_TAB_GROUP_COLORS } from './schema.js';
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
      const note = typeof s.note === 'string' ? s.note.slice(0, 10000) : '';
      const todos = Array.isArray(s.todos)
        ? s.todos
            .filter(t => t && typeof t === 'object' && typeof t.text === 'string' && t.text.trim().length > 0)
            .map(t => ({
              id: (typeof t.id === 'string' && t.id.trim()) ? t.id.trim() : generateId(),
              text: t.text.trim().slice(0, 200),
              done: Boolean(t.done)
            }))
        : [];

      spaces.push({ id, name, icon, order, pinned, note, todos });
    });
  }

  if (spaces.length === 0) {
    const homeId = generateId();
    spaces.push({ id: homeId, name: 'Home', icon: '🏠', order: 0, pinned: [], note: '', todos: [] });
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

  const validPages = ['two-stage', 'classic'];
  s.page = validPages.includes(s.page) ? s.page : defaults.page;

  const validLandings = ['hero', 'remember'];
  s.landing = validLandings.includes(s.landing) ? s.landing : defaults.landing;

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
    mode: ['hours', 'solar'].includes(ts.mode) ? ts.mode : (defaults.themeSchedule?.mode || 'hours'),
    lightFrom: typeof ts.lightFrom === 'string' ? ts.lightFrom : defaults.themeSchedule.lightFrom,
    darkFrom: typeof ts.darkFrom === 'string' ? ts.darkFrom : defaults.themeSchedule.darkFrom
  };

  // cards
  const c = (s.cards && typeof s.cards === 'object') ? s.cards : {};
  let cardStyle = c.style;
  if (cardStyle === 'outlined') cardStyle = 'outline';
  if (cardStyle === 'subtle') cardStyle = 'minimal';
  const validCardStyles = ['filled', 'frosted', 'outline', 'minimal', 'glass'];
  const validAligns = ['center', 'left'];

  let colVal = c.columns;
  if (typeof colVal === 'string' && colVal !== 'auto') {
    const parsed = parseInt(colVal, 10);
    if (!isNaN(parsed)) colVal = parsed;
  }

  s.cards = {
    style: validCardStyles.includes(cardStyle) ? cardStyle : defaults.cards.style,
    translucent: Boolean(c.translucent),
    columns: (colVal === 'auto' || [1, 2, 3, 4, 5, 6].includes(colVal)) ? colVal : defaults.cards.columns,
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
  let clkStyle = clk.style;
  if (clkStyle === 'left-aligned') clkStyle = 'left';
  if (clkStyle === 'minimal') clkStyle = 'small';
  const validClockStyles = ['large', 'small', 'left', 'analog', 'off', 'hero'];
  const validDateFormats = ['weekday-short', 'weekday-full', 'full', 'short', 'iso', 'day-first', 'off'];

  const isTzValid = (tz) => {
    if (!tz || typeof tz !== 'string') return false;
    if (tz === 'UTC' || tz === 'GMT') return true;
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      try {
        return Intl.supportedValuesOf('timeZone').includes(tz);
      } catch {
        // fallback
      }
    }
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  };

  s.clock = {
    style: validClockStyles.includes(clkStyle) ? clkStyle : defaults.clock.style,
    showSeconds: typeof clk.showSeconds === 'boolean' ? clk.showSeconds : defaults.clock.showSeconds,
    secondTimezone: (typeof clk.secondTimezone === 'string' && isTzValid(clk.secondTimezone)) ? clk.secondTimezone : null,
    dateFormat: validDateFormats.includes(clk.dateFormat) ? clk.dateFormat : defaults.clock.dateFormat
  };

  // font
  const f = (s.font && typeof s.font === 'object') ? s.font : {};
  let fam = f.family;
  if (fam === 'sans') fam = 'system';
  const validFontFamilies = ['system', 'serif', 'mono'];
  let scale = typeof f.scale === 'number' && !isNaN(f.scale) ? f.scale : defaults.font.scale;
  scale = Math.min(1.3, Math.max(0.9, scale));
  s.font = {
    family: validFontFamilies.includes(fam) ? fam : defaults.font.family,
    scale: Math.round(scale * 100) / 100
  };

  // countdown
  const cd = (s.countdown && typeof s.countdown === 'object') ? s.countdown : {};
  const isDateValid = typeof cd.date === 'string' && cd.date.trim().length > 0 && !isNaN(new Date(cd.date).getTime());
  s.countdown = {
    label: typeof cd.label === 'string' ? cd.label.slice(0, 80) : '',
    date: isDateValid ? cd.date : null
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

  // hero
  const h = (s.hero && typeof s.hero === 'object') ? s.hero : {};
  const validHeroLayouts = ['studio', 'centered'];
  const validZoneSlots = ['left', 'right', 'off'];
  const hz = (h.zones && typeof h.zones === 'object') ? h.zones : {};
  const hw = (h.widgets && typeof h.widgets === 'object') ? h.widgets : {};

  const repairWidgetSlot = (rawW, defaultHidden = false) => {
    if (!rawW || typeof rawW !== 'object') {
      return { x: null, y: null, w: null, hidden: defaultHidden };
    }
    const x = (typeof rawW.x === 'number' && rawW.x >= 0 && rawW.x <= 100) ? Math.round(rawW.x * 10) / 10 : null;
    const y = (typeof rawW.y === 'number' && rawW.y >= 0 && rawW.y <= 100) ? Math.round(rawW.y * 10) / 10 : null;
    const w = (typeof rawW.w === 'number' && rawW.w >= 160 && rawW.w <= 900) ? Math.round(rawW.w) : null;
    return {
      x,
      y,
      w,
      hidden: typeof rawW.hidden === 'boolean' ? rawW.hidden : defaultHidden
    };
  };

  s.hero = {
    layout: validHeroLayouts.includes(h.layout) ? h.layout : defaults.hero.layout,
    zones: {
      clock: validZoneSlots.includes(hz.clock) ? hz.clock : defaults.hero.zones.clock,
      weather: validZoneSlots.includes(hz.weather) ? hz.weather : defaults.hero.zones.weather,
      search: validZoneSlots.includes(hz.search) ? hz.search : defaults.hero.zones.search,
      tasks: validZoneSlots.includes(hz.tasks) ? hz.tasks : defaults.hero.zones.tasks
    },
    widgets: {
      clock: repairWidgetSlot(hw.clock, false),
      weather: repairWidgetSlot(hw.weather, false),
      search: repairWidgetSlot(hw.search, false),
      tasks: repairWidgetSlot(hw.tasks, true)
    }
  };

  // dock
  const dock = (s.dock && typeof s.dock === 'object') ? s.dock : {};
  const validDockPositions = ['top', 'left', 'bottom', 'right', 'off'];
  s.dock = {
    position: validDockPositions.includes(dock.position) ? dock.position : defaults.dock.position,
    autoHide: Boolean(dock.autoHide),
    maxItems: typeof dock.maxItems === 'number'
      ? Math.max(1, Math.min(24, Math.round(dock.maxItems)))
      : defaults.dock.maxItems
  };

  // glass
  const gl = (s.glass && typeof s.glass === 'object') ? s.glass : {};
  s.glass = {
    blur: typeof gl.blur === 'number'
      ? Math.max(0, Math.min(20, Math.round(gl.blur)))
      : defaults.glass.blur,
    opacity: typeof gl.opacity === 'number'
      ? Math.max(0.45, Math.min(0.90, Math.round(gl.opacity * 100) / 100))
      : defaults.glass.opacity
  };

  // weather
  const wth = (s.weather && typeof s.weather === 'object') ? s.weather : {};
  s.weather = {
    enabled: Boolean(wth.enabled),
    city: typeof wth.city === 'string' ? wth.city.slice(0, 100) : defaults.weather.city,
    lat: (typeof wth.lat === 'number' && wth.lat >= -90 && wth.lat <= 90) ? wth.lat : null,
    lon: (typeof wth.lon === 'number' && wth.lon >= -180 && wth.lon <= 180) ? wth.lon : null,
    unit: ['c', 'f'].includes(wth.unit) ? wth.unit : defaults.weather.unit
  };
  delete s.quote;

  // tabs
  const tb = (s.tabs && typeof s.tabs === 'object') ? s.tabs : {};
  s.tabs = {
    closeAfterSave: Boolean(tb.closeAfterSave),
    openAsGroup: typeof tb.openAsGroup === 'boolean' ? tb.openAsGroup : defaults.tabs.openAsGroup
  };

  // hub
  const hb = (s.hub && typeof s.hub === 'object') ? s.hub : {};
  s.hub = {
    view: ['columns', 'tabs'].includes(hb.view) ? hb.view : defaults.hub.view
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
    } else if (typeof bgVal === 'string' && !bgVal.toLowerCase().includes('url(')) {
      const hexMatches = bgVal.match(/#[0-9a-fA-F]{3,6}/g);
      const angleMatch = bgVal.match(/([0-9]+)deg/);
      if (hexMatches && hexMatches.length >= 2) {
        bgVal = {
          from: hexMatches[0],
          to: hexMatches[1],
          angle: angleMatch ? parseInt(angleMatch[1], 10) : 135
        };
      } else {
        bgVal = { from: '#0f172a', to: '#1e293b', angle: 135 };
      }
    } else {
      bgVal = { from: '#0f172a', to: '#1e293b', angle: 135 };
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
    const color = VALID_TAB_GROUP_COLORS.includes(cat.color) ? cat.color : null;
    const source = cat.source === 'tabs' ? 'tabs' : null;
    const savedAt = (typeof cat.savedAt === 'string' && !isNaN(new Date(cat.savedAt).getTime())) ? cat.savedAt : null;

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
      color,
      source,
      savedAt,
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
