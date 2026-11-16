// @ts-check
import { el, clearChildren } from './utils/dom.js';
import { store } from './core/state.js';
import { createDefaultSettings } from './core/schema.js';
import { renderCategoriesGrid } from './ui/components.js';
import { openCategoryDialog } from './ui/dialogs.js';
import { showToast } from './ui/toasts.js';
import { applySearchEngine, initSearchShortcuts } from './features/search.js';
import { renderClockAndGreeting, startClockTicker } from './features/clock.js';
import { applyBackground, applyThemeAndAccent, applyTypography, applyGlassSettings } from './features/theme.js';
import { initEditMode } from './features/edit-mode.js';
import { initDropAndPaste } from './features/drag-paste.js';
import { renderPinnedStrip } from './features/pinned.js';
import { initKeyboardNavigation } from './features/keyboard.js';
import { renderSpaceSwitcher } from './features/spaces.js';
import { initBulkOperations } from './features/bulk-ops.js';
import { shouldShowFirstRun, openFirstRunDialog } from './features/first-run.js';
import { applyCardSettings } from './features/cards.js';
import { applyLayoutSettings } from './features/layout.js';
import { applyDisplaySettings } from './features/display.js';
import { startThemeScheduleTicker } from './features/schedule.js';
import { resolveRotatedWallpaperId } from './features/wallpaper.js';
import { initAutoHide } from './features/auto-hide.js';
import { applyAccessibilitySettings } from './features/accessibility.js';
import { renderNotesWidget } from './features/notes.js';
import { renderTodoWidget } from './features/todo.js';
import { renderTimerWidget } from './features/timer.js';
import { renderSpeedDialWidget } from './features/speeddial.js';
import { renderQuoteWidget } from './features/quote.js';
import { renderAndroidWidgets, ANDROID_WIDGET_KEYS } from './features/android-widgets.js';
import { applyPageMode, applyLanding, initPageShell, scrollToHero } from './features/page-shell.js';
import { applyHeroLayout, initHero } from './features/hero.js';
import { renderDock, initDock } from './features/dock.js';
import { filterHubCollections, renderTabbedHub, initHubToolbar } from './features/hub.js';
import { saveCurrentTabs } from './features/tab-groups.js';
import { fetchWeatherData, renderWeatherWidget, getCachedWeather } from './features/weather.js';

/**
 * Updates DOM root attributes and dynamic UI based on current settings.
 * @param {import('./core/schema.js').DashboardData['settings']} settings
 */
function applySettings(settings) {
  const root = document.documentElement;

  // 7.1 Accessibility settings (motion preference & large touch targets)
  try { applyAccessibilitySettings(settings, root); } catch (e) { console.error('[NTD] Accessibility error:', e); }

  // 4.4 Theme, Palette & Accent
  try { applyThemeAndAccent(settings, root); } catch (e) { console.error('[NTD] Theme error:', e); }

  // Glass settings (opacity & blur)
  try { applyGlassSettings(settings, root); } catch (e) { console.error('[NTD] Glass settings error:', e); }

  // 6.2 Typography
  try { applyTypography(settings, root); } catch (e) { console.error('[NTD] Typography error:', e); }

  // Layout mode
  try { root.setAttribute('data-layout', settings?.layout || 'grid'); } catch (e) { console.error('[NTD] Layout error:', e); }

  // 4.1 Card Styles & Options
  try { applyCardSettings(settings, root); } catch (e) { console.error('[NTD] Card settings error:', e); }

  // 4.2 Layout Controls (columns, width, gap, align, vertical center)
  try { applyLayoutSettings(settings, root); } catch (e) { console.error('[NTD] Layout controls error:', e); }

  // 4.3 Display Modes & Appearance (tile shape, density, icon size, show domains)
  try { applyDisplaySettings(settings, root); } catch (e) { console.error('[NTD] Display settings error:', e); }

  // Search Engine
  try { applySearchEngine(settings?.searchEngine || 'google'); } catch (e) { console.error('[NTD] Search engine error:', e); }

  // Background
  try { applyBackground(settings?.background || { type: 'none', value: null, dim: 0.35 }); } catch (e) { console.error('[NTD] Background error:', e); }

  // 6.5 Auto-Hide Mode
  try { initAutoHide(settings); } catch (e) { console.error('[NTD] Auto-hide error:', e); }

  // 9.1 Page Shell
  try { applyPageMode(settings, document.body); } catch (e) { console.error('[NTD] Page mode error:', e); }

  // 10.1 Hero Layout
  try { applyHeroLayout(settings?.hero); } catch (e) { console.error('[NTD] Hero layout error:', e); }

  // 14.1 Weather Capsule
  try { loadAndRenderWeather(settings?.weather); } catch (e) { console.error('[NTD] Weather load error:', e); }
}

/**
 * Loads weather data respecting opt-in and renders into hero slot.
 * @param {import('./core/schema.js').DashboardData['settings']['weather']} weatherSettings
 * @param {boolean} [bypassCache=false]
 */
async function loadAndRenderWeather(weatherSettings, bypassCache = false) {
  const weatherSlot = document.getElementById('hero-weather-slot');
  if (!weatherSlot) return;

  if (!weatherSettings?.enabled) {
    weatherSlot.hidden = true;
    weatherSlot.innerHTML = '';
    return;
  }

  // Instant render of cached or default weather preview so hero looks immediately complete
  const cached = getCachedWeather();
  if (cached && cached.data) {
    renderWeatherWidget(cached.data, weatherSlot, () => {
      loadAndRenderWeather(weatherSettings, true);
    });
  } else {
    renderWeatherWidget({
      temp: 22,
      feelsLike: 20,
      humidity: 32,
      code: 3,
      conditionLabel: 'Overcast',
      icon: 'cloud',
      unit: weatherSettings.unit === 'f' ? '°F' : '°C',
      city: weatherSettings.city || 'London',
      isCached: true,
      isOffline: false
    }, weatherSlot, () => {
      loadAndRenderWeather(weatherSettings, true);
    });
  }

  const data = await fetchWeatherData(weatherSettings, { bypassCache });
  if (data) {
    renderWeatherWidget(data, weatherSlot, () => {
      loadAndRenderWeather(weatherSettings, true);
    });
  }
}

const DEFAULT_SEED_CATEGORY_NAMES = new Set([
  'Development',
  'Professional',
  'Media & Reading',
  'Reference & Tools'
]);

/**
 * Checks whether categories are empty or match only the initial default seed categories.
 * @param {import('./core/schema.js').Category[] | undefined} categories
 * @returns {boolean}
 */
function isDefaultOrEmptyCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return true;
  }
  return categories.every((cat) => DEFAULT_SEED_CATEGORY_NAMES.has(cat?.name));
}

/**
 * Builds the restored user dashboard document (collections, bookmarks, dock pins, and settings).
 * @param {Partial<import('./core/schema.js').DashboardData['settings']>} [baseSettings]
 * @returns {import('./core/schema.js').DashboardData}
 */
export function createRestoredUserDashboardData(baseSettings = {}) {
  const defaults = createDefaultSettings();
  return {
    version: 3,
    activeSpaceId: 'space_home',
    spaces: [
      {
        id: 'space_home',
        name: 'Home',
        icon: 'home',
        order: 0,
        pinned: [
          'bm_reddit',
          'bm_reanime',
          'bm_chatgpt',
          'bm_vtop',
          'bm_pyq',
          'bm_calendar',
          'bm_youtube'
        ],
        note: '',
        todos: []
      }
    ],
    settings: {
      ...defaults,
      ...(baseSettings || {}),
      hero: {
        ...defaults.hero,
        ...(baseSettings?.hero || {}),
        layout: 'studio',
        widgets: {
          ...defaults.hero.widgets,
          ...(baseSettings?.hero?.widgets || {}),
          timer: { ...(defaults.hero.widgets.timer || {}), ...(baseSettings?.hero?.widgets?.timer || {}), hidden: false },
          speeddial: { ...(defaults.hero.widgets.speeddial || {}), ...(baseSettings?.hero?.widgets?.speeddial || {}), hidden: false },
          quote: { ...(defaults.hero.widgets.quote || {}), ...(baseSettings?.hero?.widgets?.quote || {}), hidden: false }
        }
      },
      dock: {
        ...defaults.dock,
        ...(baseSettings?.dock || {}),
        position: 'top',
        autoHide: false,
        maxItems: 12
      },
      dockMigrated: true,
      clock: {
        ...defaults.clock,
        ...(baseSettings?.clock || {}),
        style: 'hero',
        showSeconds: true
      },
      weather: {
        ...defaults.weather,
        enabled: true,
        city: 'Ghaziabad',
        lat: 28.6692,
        lon: 77.4538,
        unit: 'c'
      },
      background: {
        ...defaults.background,
        type: 'image',
        value: 'bundled:misty-forest',
        activeId: 'bundled:misty-forest',
        dim: 0.25,
        blur: 0,
        autoReadability: true,
        fit: 'cover',
        focal: { x: 0.5, y: 0.5 },
        wallpapers: Array.isArray(baseSettings?.background?.wallpapers) ? baseSettings.background.wallpapers : [],
        dayId: null,
        nightId: null,
        rotation: 'off'
      },
      cards: {
        ...defaults.cards,
        ...(baseSettings?.cards || {}),
        style: 'glass',
        translucent: true
      },
      firstRunDone: true,
      newWidgetsV2Activated: true,
      userBookmarksRestoredV1: true
    },
    categories: [
      {
        id: 'cat_social',
        spaceId: 'space_home',
        name: 'Social',
        icon: 'bulb',
        order: 0,
        collapsed: false,
        displayMode: null,
        accent: null,
        color: null,
        source: null,
        savedAt: null,
        bookmarks: [
          { id: 'bm_reddit', name: 'Reddit', url: 'https://www.reddit.com', order: 0, icon: null },
          { id: 'bm_gmail_personal', name: 'Personal', url: 'https://mail.google.com/mail/u/0/', order: 1, icon: null },
          { id: 'bm_gmail_college', name: 'College', url: 'https://mail.google.com/mail/u/1/', order: 2, icon: null },
          { id: 'bm_whatsapp', name: 'Whatsapp', url: 'https://web.whatsapp.com', order: 3, icon: null },
          { id: 'bm_twitter', name: 'Twitter', url: 'https://x.com', order: 4, icon: null },
          { id: 'bm_linkedin', name: 'Linkedin', url: 'https://www.linkedin.com', order: 5, icon: null }
        ]
      },
      {
        id: 'cat_ai',
        spaceId: 'space_home',
        name: 'AI',
        icon: 'code',
        order: 1,
        collapsed: false,
        displayMode: null,
        accent: null,
        color: 'orange',
        source: null,
        savedAt: null,
        bookmarks: [
          { id: 'bm_claude', name: 'Claude', url: 'https://claude.ai', order: 0, icon: null },
          { id: 'bm_chatgpt', name: 'chatgpt', url: 'https://chatgpt.com', order: 1, icon: null },
          { id: 'bm_gemini', name: 'gemini', url: 'https://gemini.google.com', order: 2, icon: null },
          { id: 'bm_deepseek', name: 'deepseek', url: 'https://chat.deepseek.com', order: 3, icon: null }
        ]
      },
      {
        id: 'cat_work',
        spaceId: 'space_home',
        name: 'Work',
        icon: 'layers',
        order: 2,
        collapsed: false,
        displayMode: null,
        accent: null,
        color: null,
        source: null,
        savedAt: null,
        bookmarks: [
          { id: 'bm_calendar', name: 'calendar', url: 'https://calendar.google.com', order: 0, icon: null },
          { id: 'bm_pyq', name: 'PYQ', url: 'https://papers.codechefvit.com', order: 1, icon: null },
          { id: 'bm_mysite', name: 'MySite', url: 'https://vit.ac.in', order: 2, icon: null },
          { id: 'bm_github', name: 'github', url: 'https://github.com', order: 3, icon: null },
          { id: 'bm_udemy', name: 'udemy', url: 'https://www.udemy.com', order: 4, icon: null },
          { id: 'bm_vtop', name: 'vtop', url: 'https://vtop.vit.ac.in', order: 5, icon: null }
        ]
      },
      {
        id: 'cat_fun',
        spaceId: 'space_home',
        name: 'Fun',
        icon: 'game',
        order: 3,
        collapsed: false,
        displayMode: null,
        accent: null,
        color: 'green',
        source: null,
        savedAt: null,
        bookmarks: [
          { id: 'bm_rivestream', name: 'rivestream', url: 'https://rivestream.live', order: 0, icon: null },
          { id: 'bm_reanime', name: 'reanime', url: 'https://reanime.art', order: 1, icon: null },
          { id: 'bm_fluxtv', name: 'Fluxtv', url: 'https://fluxtv.live', order: 2, icon: null },
          { id: 'bm_crazygames', name: 'crazygames', url: 'https://www.crazygames.com', order: 3, icon: null },
          { id: 'bm_youtube_fun', name: 'Youtube', url: 'https://www.youtube.com', order: 4, icon: null }
        ]
      },
      {
        id: 'quick-apps-category',
        spaceId: 'space_home',
        name: 'Quick Apps',
        icon: 'zap',
        order: 4,
        collapsed: false,
        displayMode: null,
        accent: null,
        color: null,
        source: null,
        savedAt: null,
        bookmarks: [
          { id: 'bm_youtube', name: 'Youtube', url: 'https://www.youtube.com', order: 0, icon: null }
        ]
      }
    ]
  };
}

/**
 * Application bootstrapper.
 */
async function initApp() {
  let data = await store.init();

  const isNodeRuntime = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (
    !isNodeRuntime &&
    !data.settings?.userBookmarksRestoredV1 &&
    isDefaultOrEmptyCategories(data.categories)
  ) {
    await store.replaceData(createRestoredUserDashboardData(data.settings), true);
    data = store.get();
  }

  // Glass v2: Seamless upgrade for existing installs so they immediately experience the overhaul
  const upgrades = {};
  if (data.settings?.page !== 'two-stage') {
    upgrades.page = 'two-stage';
  }
  if (!data.settings?.background) {
    upgrades.background = {
      type: 'image',
      value: 'bundled:misty-forest',
      activeId: 'bundled:misty-forest',
      dim: 0.25,
      blur: 0,
      autoReadability: true,
      fit: 'cover',
      focal: { x: 0.5, y: 0.5 },
      wallpapers: [],
      rotation: 'off'
    };
  }
  if (!data.settings?.dockMigrated) {
    if (!data.settings?.dock?.position || data.settings?.dock?.position === 'top') {
      upgrades.dock = { ...(data.settings?.dock || {}), position: 'bottom' };
    }
    upgrades.dockMigrated = true;
  }
  if (!data.settings?.clock?.style || data.settings?.clock?.style === 'large') {
    upgrades.clock = { ...(data.settings?.clock || {}), style: 'hero' };
  }
  if (data.settings?.hero?.layout !== 'studio') {
    upgrades.hero = { ...(data.settings?.hero || {}), layout: 'studio' };
  }
  if (!data.settings?.weather) {
    upgrades.weather = {
      enabled: false,
      city: '',
      lat: null,
      lon: null,
      unit: 'c'
    };
  }
  if (!data.settings?.newWidgetsV2Activated) {
    const curWidgets = data.settings?.widgets || {};
    const curHeroWidgets = data.settings?.hero?.widgets || {};
    upgrades.widgets = {
      ...curWidgets,
      timer: curWidgets.timer !== false,
      speeddial: curWidgets.speeddial !== false,
      quote: curWidgets.quote !== false
    };

    const heroWidgets = {
      ...curHeroWidgets,
      timer: { ...(curHeroWidgets.timer || {}), hidden: false },
      speeddial: { ...(curHeroWidgets.speeddial || {}), hidden: false },
      quote: { ...(curHeroWidgets.quote || {}), hidden: false }
    };
    upgrades.hero = { ...(upgrades.hero || data.settings?.hero || {}), widgets: heroWidgets };
    upgrades.newWidgetsV2Activated = true;
  }
  if (Object.keys(upgrades).length > 0) {
    store.updateSettings(upgrades);
    data = store.get();
  }

  // Glass v2: Auto-populate pinned items for dock if active space has none
  try {
    const activeSpace = data.spaces?.find(s => s.id === data.activeSpaceId) || data.spaces?.[0];
    if (activeSpace && (!Array.isArray(activeSpace.pinned) || activeSpace.pinned.length === 0)) {
      const initialPinned = [];
      for (const cat of data.categories || []) {
        for (const bm of cat.bookmarks || []) {
          initialPinned.push(bm.id);
          if (initialPinned.length >= 5) break;
        }
        if (initialPinned.length >= 5) break;
      }
      if (initialPinned.length > 0) {
        store.updateSpace(activeSpace.id, { pinned: initialPinned });
        data = store.get();
      }
    }
  } catch (err) {
    console.error('[NTD] Auto-pin error:', err);
  }

  // 9.3 Landing guarantee
  applyLanding(data.settings, window);

  // 9.1 & 9.2 Two-Stage Page Shell Interactions
  initPageShell();

  // 10.1 - 10.4 Hero Composition & Corners
  initHero(store);

  // 5.5 Wallpaper rotation check at load time
  const bg = data.settings?.background;
  if (bg && bg.type === 'image' && bg.rotation && bg.rotation !== 'off') {
    const nextWpId = resolveRotatedWallpaperId(bg, bg.activeId);
    if (nextWpId && nextWpId !== bg.activeId) {
      store.updateSettings({
        background: { ...bg, activeId: nextWpId }
      });
      data = store.get();
    }
  }

  const gridContainer = document.getElementById('categories-grid');

  if (!gridContainer) {
    console.error('Missing #categories-grid element in DOM');
    return;
  }

  const appDockEl = document.getElementById('app-dock');
  const pinnedStripContainer = document.getElementById('pinned-strip');
  const spaceSwitcherContainer = document.getElementById('space-switcher');
  const widgetsContainer = document.getElementById('widgets-container');
  const notesWidgetContainer = document.getElementById('hero-notes-slot') || document.getElementById('notes-widget-container') || widgetsContainer;
  const todoWidgetContainer = document.getElementById('hero-tasks-slot') || document.getElementById('todo-widget-container') || widgetsContainer;
  const timerWidgetContainer = document.getElementById('hero-timer-slot');
  const speedDialWidgetContainer = document.getElementById('hero-speeddial-slot');
  const quoteWidgetContainer = document.getElementById('hero-quote-slot');

  function updateWidgetsVisibility(s) {
    if (widgetsContainer) {
      const hasAny = Boolean(s?.widgets?.notes || s?.widgets?.todo || s?.widgets?.timer || s?.widgets?.speeddial || s?.widgets?.quote);
      widgetsContainer.hidden = !hasAny;
    }
  }

  /**
   * Returns categories belonging to the active space.
   * @param {import('./core/schema.js').DashboardData} s
   */
  function getVisibleCategories(s) {
    const activeSpaceId = s.activeSpaceId || s.spaces?.[0]?.id;
    return (s.categories || []).filter(c => !c.spaceId || c.spaceId === activeSpaceId);
  }

  let currentHubFilter = '';

  /**
   * Renders collections hub with filtering and columns vs tabs layout.
   * @param {import('./core/schema.js').DashboardData} s
   */
  function renderHubCollections(s) {
    const rawCategories = getVisibleCategories(s);
    const visibleCategories = filterHubCollections(rawCategories, currentHubFilter);
    const hubView = s.settings?.hub?.view || 'columns';

    const hubEl = document.getElementById('collections-hub');
    if (hubEl) {
      hubEl.dataset.hubView = hubView;
    }

    const viewToggleBtn = document.getElementById('hub-view-toggle-btn');
    if (viewToggleBtn) {
      const label = viewToggleBtn.querySelector('.view-mode-label');
      if (label) label.textContent = hubView === 'tabs' ? 'Tabs' : 'Columns';
    }

    if (currentHubFilter && visibleCategories.length === 0) {
      clearChildren(gridContainer);
      const emptyDiv = el('div', { className: 'dashboard-empty hub-filter-empty' },
        el('h2', { text: 'No matching collections or bookmarks' }),
        el('p', { text: `No results matching "${currentHubFilter}". Try a different keyword.` }),
        el('button', {
          className: 'btn-secondary',
          type: 'button',
          text: 'Clear filter',
          onclick: () => {
            const filterInput = /** @type {HTMLInputElement | null} */ (document.getElementById('hub-filter-input'));
            if (filterInput) filterInput.value = '';
            currentHubFilter = '';
            const freshState = store.getState ? store.getState() : store.get();
            renderHubCollections(freshState);
          }
        })
      );
      gridContainer.appendChild(emptyDiv);
      return;
    }

    if (hubView === 'tabs') {
      renderTabbedHub(visibleCategories, gridContainer, { spaceId: s.activeSpaceId });
    } else {
      renderCategoriesGrid(visibleCategories, gridContainer);
    }
  }

  // Initial render with safe boundaries
  try { applySettings(data.settings); } catch (e) { console.error('[NTD] applySettings error:', e); }
  try { renderClockAndGreeting(data.settings); } catch (e) { console.error('[NTD] clock render error:', e); }
  try { renderSpaceSwitcher(spaceSwitcherContainer); } catch (e) { console.error('[NTD] spaces render error:', e); }
  try { renderPinnedStrip(pinnedStripContainer); } catch (e) { console.error('[NTD] pinned render error:', e); }
  try {
    if (appDockEl) {
      initDock(appDockEl);
      renderDock(appDockEl, data);
    }
  } catch (e) { console.error('[NTD] dock render error:', e); }
  try { updateWidgetsVisibility(data.settings); } catch (e) { console.error('[NTD] widgets visibility error:', e); }
  try { renderNotesWidget(notesWidgetContainer, data, (note) => store.updateSpaceNote(data.activeSpaceId, note, true)); } catch (e) { console.error('[NTD] notes error:', e); }
  try { renderTodoWidget(todoWidgetContainer, data); } catch (e) { console.error('[NTD] todo error:', e); }
  try { renderTimerWidget(timerWidgetContainer, data); } catch (e) { console.error('[NTD] timer error:', e); }
  try { renderSpeedDialWidget(speedDialWidgetContainer, data); } catch (e) { console.error('[NTD] speeddial error:', e); }
  try { renderQuoteWidget(quoteWidgetContainer, data); } catch (e) { console.error('[NTD] quote error:', e); }
  try { renderAndroidWidgets(data); } catch (e) { console.error('[NTD] android widgets error:', e); }
  try { renderHubCollections(data); } catch (e) { console.error('[NTD] hub error:', e); }

  if (typeof window !== 'undefined' && /** @type {any} */ (window).__ntd_data_unreadable_warning) {
    try { showToast("Your saved data couldn't be read. A backup copy was kept."); } catch (_) {}
    delete /** @type {any} */ (window).__ntd_data_unreadable_warning;
  }

  // 3.6 First-run template picker on fresh install
  try {
    if (shouldShowFirstRun(data)) {
      openFirstRunDialog();
    }
  } catch (e) {
    console.error('[NTD] First run error:', e);
  }

  // Bind Toolbar "New Collection" button
  try {
    const addCategoryBtn = document.getElementById('add-category-toolbar-btn');
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', () => {
        openCategoryDialog({
          mode: 'add',
          onSave: (catData) => {
            store.addCategory(catData);
            showToast(`Created collection "${catData.name}"`);
          }
        });
      });
    }
  } catch (e) {
    console.error('[NTD] Add category btn error:', e);
  }

  // Bind Toolbar Collapse All / Expand All buttons
  try {
    const collapseAllBtn = document.getElementById('collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        store.setAllCategoriesCollapsed(true);
      });
    }
    const expandAllBtn = document.getElementById('expand-all-btn');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        store.setAllCategoriesCollapsed(false);
      });
    }
  } catch (e) {
    console.error('[NTD] Collapse/expand btns error:', e);
  }

  // 12.4 Initialize Hub Toolbar (filter, view toggle, top jump)
  try {
    initHubToolbar({
      store,
      scrollToHero,
      onFilterChange: (query) => {
        currentHubFilter = query;
        const s = store.getState ? store.getState() : store.get();
        renderHubCollections(s);
      },
      onViewToggle: () => {
        const s = store.getState ? store.getState() : store.get();
        renderHubCollections(s);
      }
    });
  } catch (e) {
    console.error('[NTD] Hub toolbar error:', e);
  }

  try {
    const saveTabsBtn = document.getElementById('save-tabs-toolbar-btn');
    if (saveTabsBtn) {
      saveTabsBtn.addEventListener('click', () => {
        saveCurrentTabs();
      });
    }
  } catch (e) {
    console.error('[NTD] Save tabs btn error:', e);
  }

  // Bind Settings Cog Trigger
  try {
    const settingsBtn = document.getElementById('settings-trigger-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', async () => {
        try {
          const { openDrawer } = await import('./ui/drawer.js');
          openDrawer('appearance');
        } catch (err) {
          console.error('[NTD] Open drawer error:', err);
        }
      });
    }
  } catch (e) {
    console.error('[NTD] Settings btn error:', e);
  }

  // Start Clock Ticker & Keyboard Shortcuts
  try { startClockTicker(); } catch (e) { console.error('[NTD] startClockTicker error:', e); }
  try { startThemeScheduleTicker(store); } catch (e) { console.error('[NTD] startThemeScheduleTicker error:', e); }
  try { initSearchShortcuts(); } catch (e) { console.error('[NTD] initSearchShortcuts error:', e); }
  try { initKeyboardNavigation(); } catch (e) { console.error('[NTD] initKeyboardNavigation error:', e); }
  try { initEditMode(); } catch (e) { console.error('[NTD] initEditMode error:', e); }
  try { initDropAndPaste(); } catch (e) { console.error('[NTD] initDropAndPaste error:', e); }
  try { initBulkOperations(); } catch (e) { console.error('[NTD] initBulkOperations error:', e); }

  let lastSettingsKey = '';
  let lastClockKey = '';
  let lastSpacesKey = '';
  let lastPinnedStripKey = '';
  let lastPinnedKey = '';
  let lastDockSettingsKey = '';
  let lastSpaceId = '';
  let lastWidgetsVisKey = '';
  let lastNotesKey = '';
  let lastTodoKey = '';
  let lastTimerKey = '';
  let lastSpeedDialKey = '';
  let lastQuoteKey = '';
  let lastHubKey = '';

  const shouldRenderSettings = (settings) => {
    const key = JSON.stringify({
      theme: settings?.theme,
      accent: settings?.accent,
      background: settings?.background,
      glass: settings?.glass,
      typography: settings?.typography,
      cards: settings?.cards,
      display: settings?.display,
      layout: settings?.layout,
      page: settings?.page,
      hero: settings?.hero
    });
    if (key !== lastSettingsKey) {
      lastSettingsKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderClock = (settings) => {
    const key = JSON.stringify({
      clock: settings?.clock,
      greeting: settings?.greeting
    });
    if (key !== lastClockKey) {
      lastClockKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderSpaces = (state) => {
    const key = (state.activeSpaceId || '') + ':' + (state.spaces || []).map(s => s.id + s.name).join('|');
    if (key !== lastSpacesKey) {
      lastSpacesKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderPinnedStrip = (state) => {
    const activeSpace = state.spaces?.find(s => s.id === state.activeSpaceId) || state.spaces?.[0];
    const key = (state.activeSpaceId || '') + ':' + (activeSpace?.pinned || []).join(',');
    if (key !== lastPinnedStripKey) {
      lastPinnedStripKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderDock = (state) => {
    const activeSpace = state.spaces?.find(s => s.id === state.activeSpaceId) || state.spaces?.[0];
    const pinnedKey = (activeSpace?.pinned || []).join(',');
    const dockKey = JSON.stringify(state.settings?.dock || {});
    const spaceId = state.activeSpaceId || '';

    if (pinnedKey !== lastPinnedKey || dockKey !== lastDockSettingsKey || spaceId !== lastSpaceId) {
      lastPinnedKey = pinnedKey;
      lastDockSettingsKey = dockKey;
      lastSpaceId = spaceId;
      return true;
    }
    return false;
  };

  const shouldUpdateWidgetsVis = (settings) => {
    const key = JSON.stringify(settings?.widgets || {});
    if (key !== lastWidgetsVisKey) {
      lastWidgetsVisKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderNotes = (state) => {
    const activeSpace = state.spaces?.find(s => s.id === state.activeSpaceId) || state.spaces?.[0];
    const enabled = Boolean(state.settings?.widgets?.notes);
    const hidden = Boolean(state.settings?.hero?.widgets?.notes?.hidden);
    const key = (state.activeSpaceId || '') + ':' + (activeSpace?.note || '') + ':' + enabled + ':' + hidden;
    if (key !== lastNotesKey) {
      lastNotesKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderTodo = (state) => {
    const activeSpace = state.spaces?.find(s => s.id === state.activeSpaceId) || state.spaces?.[0];
    const todos = activeSpace?.todos || [];
    const enabled = Boolean(state.settings?.widgets?.todo);
    const hidden = Boolean(state.settings?.hero?.widgets?.tasks?.hidden);
    const key = (state.activeSpaceId || '') + ':' + enabled + ':' + hidden + ':' + todos.map(t => t.id + ':' + t.done + ':' + t.text).join('|');
    if (key !== lastTodoKey) {
      lastTodoKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderTimer = (state) => {
    const key = JSON.stringify({
      enabled: state.settings?.widgets?.timer,
      hidden: state.settings?.hero?.widgets?.timer?.hidden
    });
    if (key !== lastTimerKey) {
      lastTimerKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderSpeedDial = (state) => {
    const activeSpace = state.spaces?.find(s => s.id === state.activeSpaceId) || state.spaces?.[0];
    const key = JSON.stringify({
      enabled: state.settings?.widgets?.speeddial,
      hidden: state.settings?.hero?.widgets?.speeddial?.hidden,
      pinned: activeSpace?.pinned || [],
      cats: (activeSpace?.categoryIds || []).length
    });
    if (key !== lastSpeedDialKey) {
      lastSpeedDialKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderQuote = (state) => {
    const key = JSON.stringify({
      enabled: state.settings?.widgets?.quote,
      hidden: state.settings?.hero?.widgets?.quote?.hidden
    });
    if (key !== lastQuoteKey) {
      lastQuoteKey = key;
      return true;
    }
    return false;
  };

  const shouldRenderHub = (state) => {
    const activeSpace = state.spaces?.find(s => s.id === state.activeSpaceId) || state.spaces?.[0];
    const catIds = activeSpace?.categoryIds || [];
    const catsSummary = (state.categories || [])
      .filter(c => catIds.includes(c.id))
      .map(c => c.id + ':' + c.title + ':' + (c.bookmarks || []).length + ':' + (c.color || ''))
      .join('|');
    const key = (state.activeSpaceId || '') + ':' + (state.settings?.hub?.view || '') + ':' + JSON.stringify(state.settings?.cards || {}) + ':' + catsSummary;
    if (key !== lastHubKey) {
      lastHubKey = key;
      return true;
    }
    return false;
  };

  // React to store mutations with selective dirty checks
  store.subscribe((state) => {
    if (shouldRenderSettings(state.settings)) {
      try { applySettings(state.settings); } catch (e) { console.error('[NTD] Sub applySettings error:', e); }
      try { applyHeroLayout(state.settings?.hero); } catch (e) { console.error('[NTD] Sub hero error:', e); }
    }
    if (shouldRenderClock(state.settings)) {
      try { renderClockAndGreeting(state.settings); } catch (e) { console.error('[NTD] Sub clock error:', e); }
    }
    if (shouldRenderSpaces(state)) {
      try { renderSpaceSwitcher(spaceSwitcherContainer); } catch (e) { console.error('[NTD] Sub spaces error:', e); }
    }
    if (shouldRenderPinnedStrip(state)) {
      try { renderPinnedStrip(pinnedStripContainer); } catch (e) { console.error('[NTD] Sub pinned error:', e); }
    }
    if (appDockEl && shouldRenderDock(state)) {
      try { renderDock(appDockEl, state); } catch (e) { console.error('[NTD] Sub dock error:', e); }
    }
    if (shouldUpdateWidgetsVis(state.settings)) {
      try { updateWidgetsVisibility(state.settings); } catch (e) { console.error('[NTD] Sub widgets error:', e); }
    }
    if (shouldRenderNotes(state)) {
      try { renderNotesWidget(notesWidgetContainer, state, (note) => store.updateSpaceNote(state.activeSpaceId, note, true)); } catch (e) { console.error('[NTD] Sub notes error:', e); }
    }
    if (shouldRenderTodo(state)) {
      try { renderTodoWidget(todoWidgetContainer, state); } catch (e) { console.error('[NTD] Sub todo error:', e); }
    }
    if (shouldRenderTimer(state)) {
      try { renderTimerWidget(timerWidgetContainer, state); } catch (e) { console.error('[NTD] Sub timer error:', e); }
    }
    if (shouldRenderSpeedDial(state)) {
      try { renderSpeedDialWidget(speedDialWidgetContainer, state); } catch (e) { console.error('[NTD] Sub speeddial error:', e); }
    }
    if (shouldRenderQuote(state)) {
      try { renderQuoteWidget(quoteWidgetContainer, state); } catch (e) { console.error('[NTD] Sub quote error:', e); }
    }
    try { renderAndroidWidgets(state); } catch (e) { console.error('[NTD] Sub android widgets error:', e); }
    if (shouldRenderHub(state)) {
      try { renderHubCollections(state); } catch (e) { console.error('[NTD] Sub hub error:', e); }
    }
  });
}

// Global error logger
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[NTD Global Error]', event.error || event.message);
  });
}

// Start app once DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

export { initApp, applySettings };
