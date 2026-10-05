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
import { applyPageMode, applyLanding, initPageShell } from './features/page-shell.js';
import { applyHeroLayout, initHero } from './features/hero.js';
import { renderDailyQuote } from './features/quote.js';

/**
 * Updates DOM root attributes and dynamic UI based on current settings.
 * @param {import('./core/schema.js').DashboardData['settings']} settings
 */
function applySettings(settings) {
  const root = document.documentElement;

  // 7.1 Accessibility settings (motion preference & large touch targets)
  applyAccessibilitySettings(settings, root);

  // 4.4 Theme, Palette & Accent
  applyThemeAndAccent(settings, root);

  // 6.2 Typography
  applyTypography(settings, root);

  // Layout mode
  root.setAttribute('data-layout', settings.layout || 'grid');

  // 4.1 Card Styles & Options
  applyCardSettings(settings, root);

  // 4.2 Layout Controls (columns, width, gap, align, vertical center)
  applyLayoutSettings(settings, root);

  // 4.3 Display Modes & Appearance (tile shape, density, icon size, show domains)
  applyDisplaySettings(settings, root);

  // Search Engine
  applySearchEngine(settings.searchEngine || 'google');

  // Background
  applyBackground(settings.background || { type: 'none', value: null, dim: 0.35 });

  // 6.5 Auto-Hide Mode
  initAutoHide(settings);

  // 9.1 Two-Stage / Classic Page Shell
  applyPageMode(settings, document.body);

  // 10.1 Hero Layout & 10.2 Daily Quote
  applyHeroLayout(settings.hero);
  renderDailyQuote(settings.quote, document.getElementById('quote-display'));
}

/**
 * Application bootstrapper.
 */
async function initApp() {
  const data = await store.init();

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

  // Initial render
  applySettings(data.settings);
  renderClockAndGreeting(data.settings);
  renderSpaceSwitcher(spaceSwitcherContainer);
  renderPinnedStrip(pinnedStripContainer);
  updateWidgetsVisibility(data.settings);
  renderNotesWidget(notesWidgetContainer, data, (note) => store.updateSpaceNote(data.activeSpaceId, note, true));
  renderTodoWidget(todoWidgetContainer, data);
  renderCategoriesGrid(getVisibleCategories(data), gridContainer);

  if (typeof window !== 'undefined' && /** @type {any} */ (window).__ntd_data_unreadable_warning) {
    showToast("Your saved data couldn't be read. A backup copy was kept.");
    delete /** @type {any} */ (window).__ntd_data_unreadable_warning;
  }

  // 3.6 First-run template picker on fresh install
  if (shouldShowFirstRun(data)) {
    openFirstRunDialog();
  }

  // Bind Toolbar "New Collection" button
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

  // Bind Toolbar Collapse All / Expand All buttons
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

  // Bind Settings Cog Trigger
  const settingsBtn = document.getElementById('settings-trigger-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
      const { openDrawer } = await import('./ui/drawer.js');
      openDrawer('appearance');
    });
  }

  // Start Clock Ticker & Keyboard Shortcuts
  startClockTicker();
  startThemeScheduleTicker(store);
  initSearchShortcuts();
  initKeyboardNavigation();
  initEditMode();
  initDropAndPaste();
  initBulkOperations();

  // React to store mutations
  store.subscribe((state) => {
    applySettings(state.settings);
    renderClockAndGreeting(state.settings);
    renderSpaceSwitcher(spaceSwitcherContainer);
    renderPinnedStrip(pinnedStripContainer);
    updateWidgetsVisibility(state.settings);
    renderNotesWidget(notesWidgetContainer, state, (note) => store.updateSpaceNote(state.activeSpaceId, note, true));
    renderTodoWidget(todoWidgetContainer, state);
    renderCategoriesGrid(getVisibleCategories(state), gridContainer);
  });
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
