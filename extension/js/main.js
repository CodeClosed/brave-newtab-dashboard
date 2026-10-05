// @ts-check
import { store } from './core/state.js';
import { renderCategoriesGrid } from './ui/components.js';
import { openCategoryDialog } from './ui/dialogs.js';
import { showToast } from './ui/toasts.js';
import { applySearchEngine, initSearchShortcuts } from './features/search.js';
import { renderClockAndGreeting, startClockTicker } from './features/clock.js';
import { applyBackground, applyThemeAndAccent, applyTypography } from './features/theme.js';
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

  // 9.1 Two-Stage / Classic Page Shell
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
      icon: '☁️',
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

/**
 * Application bootstrapper.
 */
async function initApp() {
  const data = await store.init();

  // Glass v2: Seamless upgrade for existing installs so they immediately experience the overhaul
  const upgrades = {};
  if (data.settings?.page === 'classic' && !data.settings?.optedInClassic) {
    upgrades.page = 'two-stage';
    data.settings.page = 'two-stage';
  }
  if (!data.settings?.background || data.settings?.background?.type === 'none') {
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
    data.settings.background = upgrades.background;
  }
  if (!data.settings?.cards?.style || data.settings?.cards?.style === 'filled') {
    upgrades.cards = { ...(data.settings?.cards || {}), style: 'glass', translucent: true };
    data.settings.cards = upgrades.cards;
  }
  if (!data.settings?.dockMigrated) {
    if (!data.settings?.dock?.position || data.settings?.dock?.position === 'top') {
      upgrades.dock = { ...(data.settings?.dock || {}), position: 'bottom' };
      data.settings.dock = upgrades.dock;
    }
    upgrades.dockMigrated = true;
    data.settings.dockMigrated = true;
  }
  if (!data.settings?.clock?.style || data.settings?.clock?.style === 'large') {
    upgrades.clock = { ...(data.settings?.clock || {}), style: 'hero' };
    data.settings.clock = upgrades.clock;
  }
  if (data.settings?.hero?.layout !== 'studio') {
    upgrades.hero = { ...(data.settings?.hero || {}), layout: 'studio' };
    data.settings.hero = upgrades.hero;
  }
  if (!data.settings?.weather?.enabled) {
    upgrades.weather = {
      enabled: true,
      city: 'London',
      lat: 51.5074,
      lon: -0.1278,
      unit: 'c'
    };
    data.settings.weather = upgrades.weather;
  }
  if (Object.keys(upgrades).length > 0) {
    store.updateSettings(upgrades);
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
        activeSpace.pinned = initialPinned;
        store.updateSpace(activeSpace.id, { pinned: initialPinned });
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
      bg.activeId = nextWpId;
      store.updateSettings({
        background: { ...bg, activeId: nextWpId }
      });
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
  const notesWidgetContainer = document.getElementById('notes-widget-container') || widgetsContainer;
  const todoWidgetContainer = document.getElementById('todo-widget-container') || widgetsContainer;

  function updateWidgetsVisibility(s) {
    if (widgetsContainer) {
      const hasAny = Boolean(s?.widgets?.notes || s?.widgets?.todo);
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

  // React to store mutations
  store.subscribe((state) => {
    try { applySettings(state.settings); } catch (e) { console.error('[NTD] Sub applySettings error:', e); }
    try { renderClockAndGreeting(state.settings); } catch (e) { console.error('[NTD] Sub clock error:', e); }
    try { renderSpaceSwitcher(spaceSwitcherContainer); } catch (e) { console.error('[NTD] Sub spaces error:', e); }
    try { renderPinnedStrip(pinnedStripContainer); } catch (e) { console.error('[NTD] Sub pinned error:', e); }
    try {
      if (appDockEl) {
        renderDock(appDockEl, state);
      }
    } catch (e) { console.error('[NTD] Sub dock error:', e); }
    try { updateWidgetsVisibility(state.settings); } catch (e) { console.error('[NTD] Sub widgets error:', e); }
    try { renderNotesWidget(notesWidgetContainer, state, (note) => store.updateSpaceNote(state.activeSpaceId, note, true)); } catch (e) { console.error('[NTD] Sub notes error:', e); }
    try { renderTodoWidget(todoWidgetContainer, state); } catch (e) { console.error('[NTD] Sub todo error:', e); }
    try { renderHubCollections(state); } catch (e) { console.error('[NTD] Sub hub error:', e); }
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
