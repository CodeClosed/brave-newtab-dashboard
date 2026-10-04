// @ts-check
import { store } from './core/state.js';
import { renderCategoriesGrid } from './ui/components.js';
import { openCategoryDialog } from './ui/dialogs.js';
import { showToast } from './ui/toasts.js';
import { applySearchEngine, initSearchShortcuts } from './features/search.js';
import { renderClockAndGreeting, startClockTicker } from './features/clock.js';
import { applyBackground } from './features/theme.js';
import { initEditMode } from './features/edit-mode.js';
import { initDropAndPaste } from './features/drag-paste.js';
import { renderPinnedStrip } from './features/pinned.js';
import { initKeyboardNavigation } from './features/keyboard.js';
import { renderSpaceSwitcher } from './features/spaces.js';
import { initBulkOperations } from './features/bulk-ops.js';
import { shouldShowFirstRun, openFirstRunDialog } from './features/first-run.js';
import { applyCardSettings } from './features/cards.js';

/**
 * Updates DOM root attributes and dynamic UI based on current settings.
 * @param {import('./core/schema.js').DashboardData['settings']} settings
 */
function applySettings(settings) {
  const root = document.documentElement;

  // Theme
  let isDark = false;
  if (settings.theme === 'dark') {
    isDark = true;
  } else if (settings.theme === 'light') {
    isDark = false;
  } else {
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }

  // Accent & Layout
  root.setAttribute('data-accent', settings.accent || 'slate');
  root.setAttribute('data-layout', settings.layout || 'grid');

  // 4.1 Card Styles & Options
  applyCardSettings(settings, root);

  // Search Engine
  applySearchEngine(settings.searchEngine || 'google');

  // Background
  applyBackground(settings.background || { type: 'none', value: null, dim: 0.35 });
}

/**
 * Application bootstrapper.
 */
async function initApp() {
  const data = await store.init();
  const gridContainer = document.getElementById('categories-grid');

  if (!gridContainer) {
    console.error('Missing #categories-grid element in DOM');
    return;
  }

  const pinnedStripContainer = document.getElementById('pinned-strip');
  const spaceSwitcherContainer = document.getElementById('space-switcher');

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
    renderCategoriesGrid(getVisibleCategories(state), gridContainer);
  });
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
