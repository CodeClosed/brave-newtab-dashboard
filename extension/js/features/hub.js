// @ts-check
import { clearChildren, el } from '../utils/dom.js';
import { renderCategoryCard } from '../ui/components.js';

let rememberedTabs = {};

/**
 * Pure function: filters categories and their bookmarks by search query.
 * @param {import('../core/schema.js').Category[]} categories
 * @param {string} query
 * @returns {import('../core/schema.js').Category[]}
 */
export function filterHubCollections(categories, query) {
  if (!Array.isArray(categories)) return [];
  const q = (query || '').trim().toLowerCase();
  if (!q) return categories;

  const results = [];
  for (const cat of categories) {
    if (!cat) continue;
    const catNameMatch = (cat.name || '').toLowerCase().includes(q);
    const catIconMatch = (cat.icon || '').toLowerCase().includes(q);

    if (catNameMatch || catIconMatch) {
      results.push(cat);
      continue;
    }

    const matchingBookmarks = (cat.bookmarks || []).filter((bm) => {
      if (!bm) return false;
      const nameMatch = (bm.name || '').toLowerCase().includes(q);
      const urlMatch = (bm.url || '').toLowerCase().includes(q);
      return nameMatch || urlMatch;
    });

    if (matchingBookmarks.length > 0) {
      results.push({
        ...cat,
        bookmarks: matchingBookmarks
      });
    }
  }

  return results;
}

/**
 * Toggles the hub view between 'columns' and 'tabs'.
 * @param {any} store
 * @returns {'columns' | 'tabs'}
 */
export function toggleHubView(store) {
  const state = store.getState ? store.getState() : store.get();
  const currentView = state.settings?.hub?.view === 'tabs' ? 'tabs' : 'columns';
  const nextView = currentView === 'tabs' ? 'columns' : 'tabs';

  store.updateSettings({
    hub: {
      ...(state.settings?.hub || {}),
      view: nextView
    }
  });

  return nextView;
}

/**
 * Gets the remembered active tab category ID for a space.
 * @param {string} spaceId
 * @param {import('../core/schema.js').Category[]} categories
 * @returns {string | null}
 */
export function getRememberedTab(spaceId, categories) {
  if (!categories || categories.length === 0) return null;
  const remId = rememberedTabs[spaceId];
  if (remId && categories.some((c) => c.id === remId)) {
    return remId;
  }
  return categories[0].id;
}

/**
 * Sets the remembered active tab category ID for a space.
 * @param {string} spaceId
 * @param {string} categoryId
 */
export function setRememberedTab(spaceId, categoryId) {
  if (spaceId && categoryId) {
    rememberedTabs[spaceId] = categoryId;
  }
}

/**
 * Renders the Collections Hub in Tabbed Stack View.
 * Shows every collection as a pill tab along the top of a single glass window.
 *
 * @param {import('../core/schema.js').Category[]} categories
 * @param {HTMLElement} container
 * @param {object} options
 * @param {string} [options.spaceId]
 * @param {string} [options.activeCatId]
 * @param {(catId: string) => void} [options.onSelectTab]
 */
export function renderTabbedHub(categories, container, options = {}) {
  if (!container) return;
  clearChildren(container);

  if (!categories || categories.length === 0) {
    return;
  }

  const spaceId = options.spaceId || 'default';
  const activeId = options.activeCatId || getRememberedTab(spaceId, categories) || categories[0].id;
  const activeCategory = categories.find((c) => c.id === activeId) || categories[0];

  const tabbedWindow = el('div', { className: 'hub-tabbed-window' });
  const tabsNav = el('div', { className: 'hub-tabs-nav', role: 'tablist', 'aria-label': 'Collections' });

  categories.forEach((cat) => {
    const isActive = cat.id === activeCategory.id;
    const bmCount = Array.isArray(cat.bookmarks) ? cat.bookmarks.length : 0;

    let colorDot = null;
    if (cat.color) {
      colorDot = el('span', {
        className: `category-color-dot color-${cat.color}`,
        'aria-hidden': 'true'
      });
    }

    const tabBtn = el(
      'button',
      {
        className: `hub-tab-btn${isActive ? ' active' : ''}`,
        type: 'button',
        role: 'tab',
        'aria-selected': isActive ? 'true' : 'false',
        'aria-controls': `hub-panel-${cat.id}`,
        id: `hub-tab-${cat.id}`,
        dataset: { id: cat.id, color: cat.color || undefined },
        onclick: () => {
          setRememberedTab(spaceId, cat.id);
          if (options.onSelectTab) {
            options.onSelectTab(cat.id);
          } else {
            renderTabbedHub(categories, container, { ...options, activeCatId: cat.id });
          }
        }
      },
      el('span', { className: 'tab-icon', text: cat.icon || '📁' }),
      el('span', { className: 'tab-name', text: cat.name }),
      colorDot,
      el('span', { className: 'tab-count', text: `(${bmCount})` })
    );

    // Keyboard navigation: ArrowLeft / ArrowRight across tabs
    tabBtn.addEventListener('keydown', (e) => {
      const allTabs = Array.from(tabsNav.querySelectorAll('.hub-tab-btn'));
      const idx = allTabs.indexOf(tabBtn);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = allTabs[(idx + 1) % allTabs.length];
        /** @type {HTMLElement} */ (next)?.click();
        /** @type {HTMLElement} */ (next)?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = allTabs[(idx - 1 + allTabs.length) % allTabs.length];
        /** @type {HTMLElement} */ (prev)?.click();
        /** @type {HTMLElement} */ (prev)?.focus();
      }
    });

    tabsNav.appendChild(tabBtn);
  });

  // Render active collection's full card inside panel
  const panel = el('div', {
    className: 'hub-tab-panel',
    id: `hub-panel-${activeCategory.id}`,
    role: 'tabpanel',
    'aria-labelledby': `hub-tab-${activeCategory.id}`
  });

  const card = renderCategoryCard(activeCategory, 0, 1);
  panel.appendChild(card);

  tabbedWindow.appendChild(tabsNav);
  tabbedWindow.appendChild(panel);
  container.appendChild(tabbedWindow);
}

/**
 * Initializes the Collections Hub Toolbar actions.
 * @param {object} params
 * @param {any} params.store
 * @param {() => void} [params.scrollToHero]
 * @param {(query: string) => void} [params.onFilterChange]
 * @param {() => void} [params.onViewToggle]
 */
export function initHubToolbar({ store, scrollToHero, onFilterChange, onViewToggle }) {
  const topBtn = document.getElementById('scroll-to-hero');
  if (topBtn && scrollToHero) {
    topBtn.addEventListener('click', () => scrollToHero());
  }

  const filterInput = /** @type {HTMLInputElement} */ (document.getElementById('hub-filter-input'));
  if (filterInput && onFilterChange) {
    filterInput.addEventListener('input', () => {
      onFilterChange(filterInput.value);
    });
  }

  const viewToggleBtn = document.getElementById('hub-view-toggle-btn');
  if (viewToggleBtn) {
    viewToggleBtn.addEventListener('click', () => {
      const nextView = toggleHubView(store);
      const label = viewToggleBtn.querySelector('.view-mode-label');
      if (label) {
        label.textContent = nextView === 'tabs' ? 'Tabs' : 'Columns';
      }
      if (onViewToggle) onViewToggle();
    });
  }
}
