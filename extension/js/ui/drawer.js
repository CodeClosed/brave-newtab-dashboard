// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { store } from '../core/state.js';
import { showToast } from './toasts.js';
import { exportDashboardToFile, parseAndValidateBookmarksImport } from '../features/data-io.js';
import { openCategoryDialog, openConfirmDialog, openImportPreviewDialog } from './dialogs.js';
import { createDefaultDashboardData, createDefaultSettings, validateDashboardData } from '../core/schema.js';
import { migrate } from '../core/migrate.js';
import { saveBackgroundImage, deleteBackgroundImage } from '../core/idb.js';
import { downscaleImage, validateAccentContrast, suggestAccessibleShade, validateSolidColor, validateGradientConfig, formatGradientCss } from '../features/theme.js';
import { createSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot } from '../core/snapshots.js';
import { openAddSpaceDialog, openRenameSpaceDialog, openDeleteSpaceDialog } from '../features/spaces.js';
import { THEME_PRESETS, applyThemePreset } from '../features/presets.js';
import { getSolarTimes } from '../features/schedule.js';
import { renderWallpaperLibrary, BUNDLED_WALLPAPERS } from '../features/wallpaper.js';
import { isValidTimezone, getSupportedTimezones } from '../features/clock.js';
import { renderAppearanceSection } from './drawer/appearance.js';
import { renderLayoutSection } from './drawer/layout.js';
import { renderWidgetsSection } from './drawer/widgets.js';
import { renderDataSection } from './drawer/data.js';
import { renderRadioCard, renderToggleRow } from './drawer/common.js';

import {
  ICON_PALETTE,
  ICON_LAYOUT,
  ICON_CLOCK,
  ICON_SEARCH,
  ICON_WIDGETS,
  ICON_SPACES,
  ICON_COLLECTIONS,
  ICON_ACCESSIBILITY,
  ICON_DATA,
  ICON_SETTINGS,
  ICON_REFRESH,
  ICON_CHECK,
  ICON_WARNING,
  ICON_SUN,
  ICON_MOON,
  ICON_ARROW_UP,
  ICON_ARROW_DOWN,
  ICON_EDIT,
  ICON_CLOSE,
  ICON_PLUS,
  getIconSvg
} from './icons.js';

let drawerElement = null;
let activeTab = 'appearance';
let lastActiveElement = null;
let openingSnapshot = null;
let searchQuery = '';
let lastRenderedTab = null;
let lastSearchQuery = '';

const TABS = [
  { id: 'appearance', label: 'Appearance', icon: ICON_PALETTE, group: 'Core' },
  { id: 'layout', label: 'Layout', icon: ICON_LAYOUT, group: 'Core' },
  { id: 'widgets', label: 'Widget Editor', icon: ICON_WIDGETS, group: 'Core' },
  { id: 'categories', label: 'Collections', icon: ICON_COLLECTIONS, group: 'Core' },
  { id: 'spaces', label: 'Spaces', icon: ICON_SPACES, group: 'Productivity' },
  { id: 'clock', label: 'Clock & Date', icon: ICON_CLOCK, group: 'Productivity' },
  { id: 'search', label: 'Search', icon: ICON_SEARCH, group: 'Productivity' },
  { id: 'accessibility', label: 'Accessibility', icon: ICON_ACCESSIBILITY, group: 'System' },
  { id: 'data', label: 'Backup & Data', icon: ICON_DATA, group: 'System' }
];

const ACCENTS = [
  { id: 'slate', color: '#64748b', name: 'Slate' },
  { id: 'blue', color: '#3b82f6', name: 'Blue' },
  { id: 'emerald', color: '#10b981', name: 'Emerald' },
  { id: 'amber', color: '#f59e0b', name: 'Amber' },
  { id: 'rose', color: '#f43f5e', name: 'Rose' }
];

const SOLID_PRESETS = [
  { name: 'Charcoal Slate', value: '#181e24' },
  { name: 'Midnight Navy', value: '#131d28' },
  { name: 'Deep Forest', value: '#142219' },
  { name: 'Dark Mocha', value: '#241c18' }
];

const GRADIENT_PRESETS = [
  { name: 'Slate Calm', value: { from: '#111827', to: '#1f2937', angle: 135 } },
  { name: 'Nordic Deep', value: { from: '#0f172a', to: '#1e293b', angle: 135 } },
  { name: 'Quiet Dusk', value: { from: '#1c1917', to: '#292524', angle: 135 } }
];

/**
 * For testing drawer element instance.
 */
export function _getDrawerElementForTests() {
  return drawerElement;
}

/**
 * For testing opening snapshot.
 */
export function _getOpeningSnapshotForTests() {
  return openingSnapshot;
}

const SETTINGS_CATALOG = [
  { id: 'theme', section: 'appearance', label: 'Theme (System, Light, Dark)', keywords: 'color mode dark light system appearance' },
  { id: 'themeSchedule', section: 'appearance', label: 'Theme Schedule (Auto Light/Dark)', keywords: 'schedule auto light dark switch time hours appearance' },
  { id: 'palette', section: 'appearance', label: 'Color Palette', keywords: 'palette default amoled paper contrast' },
  { id: 'accent', section: 'appearance', label: 'Accent Color', keywords: 'accent slate blue emerald amber rose custom color' },
  { id: 'background', section: 'appearance', label: 'Background & Wallpaper', keywords: 'wallpaper background solid gradient image' },
  { id: 'glass', section: 'appearance', label: 'Frosted Glass Surface (Blur & Opacity)', keywords: 'glass blur opacity frosted translucency transparency' },
  { id: 'layout', section: 'layout', label: 'Card Layout', keywords: 'grid compact layout card style' },
  { id: 'cards', section: 'layout', label: 'Card Columns & Width', keywords: 'columns gap width translucent cards filled' },
  { id: 'accessibility', section: 'accessibility', label: 'Accessibility & Reduced Motion', keywords: 'accessibility motion reduce animation transitions large targets touch contrast wcag aaa' },
  { id: 'clock', section: 'clock', label: 'Clock & Date Display', keywords: 'time clock greeting date format 12h 24h 24-hour seconds timezone' },
  { id: 'searchEngine', section: 'search', label: 'Search Engine', keywords: 'search engine google brave duckduckgo bing' },
  { id: 'searchShortcuts', section: 'search', label: 'Search Filter & Shortcuts', keywords: 'shortcuts filter bookmarks calculator math' },
  { id: 'widgets', section: 'widgets', label: 'Widget Editor & Sizes', keywords: 'widgets editor resize small big format clock weather search timer notes tasks quote speeddial size layout' },
  { id: 'spaces', section: 'spaces', label: 'Spaces & Dashboards', keywords: 'spaces dashboards add switch cycle move' },
  { id: 'categories', section: 'categories', label: 'Manage Collections', keywords: 'categories collections add reorder delete' },
  { id: 'snapshots', section: 'data', label: 'Snapshots & Backups', keywords: 'snapshots restore backup export import json database' }
];

/**
 * Searches the settings catalog by search query.
 * @param {string} query
 * @returns {Array<{ id: string, section: string, label: string, keywords: string }>}
 */
export function filterSettingsByQuery(query) {
  if (!query || typeof query !== 'string') return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return SETTINGS_CATALOG.filter(item => {
    return item.label.toLowerCase().includes(q) ||
           item.keywords.toLowerCase().includes(q) ||
           item.section.toLowerCase().includes(q);
  });
}

/**
 * Resets a specific settings section to defaults with undo toast.
 * @param {string} sectionId
 */
export function resetSettingsSection(sectionId) {
  const defaults = createDefaultSettings();
  const current = store.get().settings;
  const previous = JSON.parse(JSON.stringify(current));
  let patch = {};
  let label = 'Section';

  if (sectionId === 'appearance') {
    label = 'Appearance';
    patch = {
      theme: defaults.theme,
      palette: defaults.palette,
      accent: defaults.accent,
      accentCustom: defaults.accentCustom,
      glass: JSON.parse(JSON.stringify(defaults.glass)),
      font: JSON.parse(JSON.stringify(defaults.font)),
      themeSchedule: JSON.parse(JSON.stringify(defaults.themeSchedule)),
      background: JSON.parse(JSON.stringify(defaults.background))
    };
    if (current.background?.type === 'image') {
      deleteBackgroundImage().catch(() => {});
    }
  } else if (sectionId === 'layout') {
    label = 'Layout';
    patch = {
      layout: defaults.layout,
      cards: JSON.parse(JSON.stringify(defaults.cards)),
      display: JSON.parse(JSON.stringify(defaults.display)),
      dock: JSON.parse(JSON.stringify(defaults.dock)),
      hub: JSON.parse(JSON.stringify(defaults.hub))
    };
  } else if (sectionId === 'clock') {
    label = 'Clock';
    patch = {
      showClock: defaults.showClock,
      showDate: defaults.showDate,
      showGreeting: defaults.showGreeting,
      timeFormat: defaults.timeFormat,
      userName: defaults.userName,
      countdown: JSON.parse(JSON.stringify(defaults.countdown)),
      clock: JSON.parse(JSON.stringify(defaults.clock))
    };
  } else if (sectionId === 'accessibility') {
    label = 'Accessibility';
    patch = {
      motion: defaults.motion,
      largeTargets: defaults.largeTargets,
      palette: defaults.palette
    };
  } else if (sectionId === 'search') {
    label = 'Search';
    patch = {
      searchEngine: defaults.searchEngine,
      behavior: JSON.parse(JSON.stringify(defaults.behavior))
    };
  } else if (sectionId === 'widgets') {
    label = 'Widgets';
    const heroWidgets = { ...(store.get()?.settings?.hero?.widgets || {}) };
    heroWidgets.timer = { ...(heroWidgets.timer || {}), hidden: !defaults.widgets.timer };
    heroWidgets.speeddial = { ...(heroWidgets.speeddial || {}), hidden: !defaults.widgets.speeddial };
    heroWidgets.quote = { ...(heroWidgets.quote || {}), hidden: !defaults.widgets.quote };
    heroWidgets.tasks = { ...(heroWidgets.tasks || {}), hidden: !defaults.widgets.todo };
    heroWidgets.notes = { ...(heroWidgets.notes || {}), hidden: !defaults.widgets.notes };
    patch = {
      widgets: JSON.parse(JSON.stringify(defaults.widgets)),
      weather: JSON.parse(JSON.stringify(defaults.weather)),
      hero: { ...(store.get()?.settings?.hero || {}), widgets: heroWidgets }
    };
  }

  store.updateSettings(patch);
  if (drawerElement && drawerElement.open) {
    renderDrawerContent();
  }
  showToast(`${label} reset to defaults`, () => {
    store.updateSettings(previous);
    if (drawerElement && drawerElement.open) {
      renderDrawerContent();
    }
    showToast('Reset undone');
  });
}

/**
 * Initializes and mounts drawer DOM elements if not already present.
 */
function ensureDrawerDOM() {
  if (drawerElement && document.body.contains(drawerElement)) return;

  drawerElement = el('dialog', {
    className: 'settings-drawer',
    id: 'settings-drawer-dialog',
    'aria-labelledby': 'settings-drawer-title'
  });

  // Light dismiss on backdrop click
  drawerElement.addEventListener('click', (e) => {
    if (e.target === drawerElement) {
      const rect = drawerElement.getBoundingClientRect();
      const clickedInside = (
        rect.top <= e.clientY && e.clientY <= rect.bottom &&
        rect.left <= e.clientX && e.clientX <= rect.right
      );
      if (!clickedInside) {
        closeDrawer(false);
      }
    }
  });

  // Native Escape cancel handling -> reverts state
  drawerElement.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDrawer(true);
  });

  document.body.appendChild(drawerElement);
}

/**
 * Opens the settings drawer.
 * @param {string} [tab='appearance']
 */
export function openDrawer(tab = 'appearance') {
  ensureDrawerDOM();
  lastActiveElement = /** @type {HTMLElement} */ (document.activeElement);
  activeTab = tab;
  searchQuery = '';
  lastRenderedTab = null;
  lastSearchQuery = '';
  openingSnapshot = JSON.parse(JSON.stringify(store.get()));
  renderDrawerContent();

  if (!drawerElement.open && typeof drawerElement.showModal === 'function') {
    drawerElement.showModal();
  }
  drawerElement.classList.add('open');

  const closeBtn = drawerElement.querySelector('.drawer-cancel-btn') || drawerElement.querySelector('.drawer-close-btn');
  if (closeBtn && typeof closeBtn.focus === 'function') {
    closeBtn.focus();
  }
}

/**
 * Closes the settings drawer.
 * @param {boolean} [revert=false] If true, reverts state to the snapshot taken upon opening.
 */
export function closeDrawer(revert = false) {
  if (!drawerElement) return;

  if (revert && openingSnapshot) {
    store.replaceData(openingSnapshot, true);
    showToast('Changes reverted');
  }
  openingSnapshot = null;

  drawerElement.classList.remove('open');
  if (drawerElement.open && typeof drawerElement.close === 'function') {
    drawerElement.close();
  }

  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
    lastActiveElement = null;
  }
}

/**
 * Renders the internal structure of the settings drawer.
 */
function renderDrawerContent() {
  if (!drawerElement) return;

  const isSameView = (activeTab === lastRenderedTab) && (searchQuery === lastSearchQuery);
  const prevContent = drawerElement.querySelector('.drawer-content');
  const prevScrollTop = (prevContent && isSameView) ? prevContent.scrollTop : 0;
  const prevNav = drawerElement.querySelector('.drawer-nav');
  const prevNavScrollTop = prevNav ? prevNav.scrollTop : 0;

  clearChildren(drawerElement);

  const state = store.get();
  const settings = state.settings;
  const activeTabObj = TABS.find(t => t.id === activeTab) || TABS[0];

  // Header with stable ID for aria-labelledby, Cancel and Done buttons
  const header = el('header', { className: 'drawer-header' },
    el('div', { className: 'drawer-header-left' }, [
      el('span', { className: 'drawer-header-icon-badge', html: ICON_SETTINGS }),
      el('h2', { className: 'drawer-title', id: 'settings-drawer-title' }, [
        el('span', { text: 'Settings' }),
        el('span', { className: 'drawer-header-badge', text: activeTabObj.label })
      ])
    ]),
    el('div', { className: 'drawer-header-actions' }, [
      el('button', {
        className: 'btn-secondary btn-sm drawer-cancel-btn',
        type: 'button',
        text: 'Cancel',
        title: 'Revert changes made since opening',
        onclick: () => closeDrawer(true)
      }),
      el('button', {
        className: 'btn-primary btn-sm drawer-done-btn',
        type: 'button',
        text: 'Done',
        title: 'Keep changes and close',
        onclick: () => closeDrawer(false)
      }),
      el('button', {
        className: 'drawer-close-btn',
        type: 'button',
        'aria-label': 'Close settings',
        title: 'Close (Esc)',
        html: ICON_CLOSE,
        onclick: () => closeDrawer(false)
      })
    ])
  );

  // Search box
  const searchWrapper = el('div', { className: 'drawer-search-wrapper' });
  const searchIcon = el('span', { className: 'drawer-search-icon', html: ICON_SEARCH });
  const searchInput = el('input', {
    type: 'search',
    className: 'drawer-search-input',
    placeholder: 'Search settings...',
    'aria-label': 'Search settings',
    value: searchQuery
  });
  searchInput.addEventListener('input', (e) => {
    searchQuery = /** @type {HTMLInputElement} */ (e.target).value;
    renderDrawerContent();
    const nextInput = /** @type {HTMLInputElement} */ (drawerElement?.querySelector('.drawer-search-input'));
    if (nextInput && typeof nextInput.focus === 'function') {
      nextInput.focus();
    }
  });
  searchWrapper.appendChild(searchIcon);
  searchWrapper.appendChild(searchInput);

  // Tab Nav (hidden if actively searching)
  const nav = el('nav', { className: 'drawer-nav', 'aria-label': 'Settings sections' });
  let currentGroup = '';
  for (const tab of TABS) {
    if (tab.group && tab.group !== currentGroup) {
      currentGroup = tab.group;
      const groupHeader = el('div', {
        className: 'drawer-nav-group-header',
        style: {
          fontSize: '11px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted, #94a3b8)',
          padding: '12px 14px 4px',
          opacity: '0.75'
        },
        text: currentGroup
      });
      nav.appendChild(groupHeader);
    }
    const isSvg = typeof tab.icon === 'string' && tab.icon.includes('<svg');
    const tabBtn = el('button', {
      className: `drawer-tab-btn${activeTab === tab.id ? ' active' : ''}`,
      type: 'button',
      onclick: () => {
        activeTab = tab.id;
        searchQuery = '';
        renderDrawerContent();
      }
    }, [
      el('span', {
        className: 'drawer-tab-icon',
        ...(isSvg ? { html: tab.icon } : { text: tab.icon || '' })
      }),
      el('span', { className: 'drawer-tab-label', text: tab.label })
    ]);
    nav.appendChild(tabBtn);
  }

  // Content Container
  const content = el('div', { className: 'drawer-content' });

  if (searchQuery.trim().length > 0) {
    const matches = filterSettingsByQuery(searchQuery);
    const resultsContainer = el('div', { className: 'settings-section search-results-section' });
    resultsContainer.appendChild(el('span', {
      className: 'setting-label',
      text: `Search Results (${matches.length})`
    }));

    if (matches.length === 0) {
      resultsContainer.appendChild(el('div', {
        className: 'snapshot-empty-hint',
        text: `No settings matching "${searchQuery}"`
      }));
    } else {
      const resultsList = el('div', { className: 'search-results-list' });
      matches.forEach(m => {
        const item = el('div', { className: 'search-result-item' }, [
          el('div', { className: 'search-result-info' }, [
            el('span', { className: 'search-result-label', text: m.label }),
            el('span', { className: 'search-result-section-badge', text: m.section })
          ]),
          el('button', {
            className: 'btn-secondary btn-sm',
            type: 'button',
            text: 'Configure',
            onclick: () => {
              activeTab = m.section;
              searchQuery = '';
              renderDrawerContent();
            }
          })
        ]);
        resultsList.appendChild(item);
      });
      resultsContainer.appendChild(resultsList);
    }
    content.appendChild(resultsContainer);
  } else {
    if (activeTab === 'appearance') {
      content.appendChild(renderAppearanceSection(settings, { renderDrawerContent, resetSettingsSection }));
    } else if (activeTab === 'layout') {
      content.appendChild(renderLayoutSection(settings, { renderDrawerContent, resetSettingsSection }));
    } else if (activeTab === 'accessibility') {
      content.appendChild(renderAccessibilitySection(settings));
    } else if (activeTab === 'spaces') {
      content.appendChild(renderSpacesSection(state));
    } else if (activeTab === 'clock') {
      content.appendChild(renderClockSection(settings));
    } else if (activeTab === 'search') {
      content.appendChild(renderSearchSection(settings));
    } else if (activeTab === 'widgets') {
      content.appendChild(renderWidgetsSection(settings, { renderDrawerContent, resetSettingsSection, closeDrawer }));
    } else if (activeTab === 'categories') {
      content.appendChild(renderCategoriesSection(state.categories));
    } else if (activeTab === 'data') {
      content.appendChild(renderDataSection(closeDrawer));
    }
  }

  const sidebarFooter = el('div', { className: 'drawer-sidebar-footer' }, [
    el('div', { className: 'drawer-version-chip' }, [
      el('span', { className: 'drawer-pulse-dot' }),
      el('span', { text: 'v0.3.0 · Local-First' })
    ])
  ]);

  const modalBody = el('div', { className: 'settings-modal-body' }, [
    el('aside', { className: 'settings-sidebar' }, [searchWrapper, nav, sidebarFooter]),
    content
  ]);

  drawerElement.appendChild(header);
  drawerElement.appendChild(modalBody);

  const newContent = drawerElement.querySelector('.drawer-content');
  if (newContent && prevScrollTop > 0) {
    newContent.scrollTop = prevScrollTop;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (newContent) newContent.scrollTop = prevScrollTop;
      });
    }
  }
  const newNav = drawerElement.querySelector('.drawer-nav');
  if (newNav && prevNavScrollTop > 0) {
    newNav.scrollTop = prevNavScrollTop;
  }

  lastRenderedTab = activeTab;
  lastSearchQuery = searchQuery;
}

// --- Section Renderers ---

function renderClockSection(settings) {
  const section = el('div', { className: 'settings-section' });
  const clockConf = settings.clock || {};

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Clock, Date & Greeting' }),
      el('p', { className: 'settings-section-subtitle', text: 'Configure clock typography, seconds counter, secondary world clock, and countdown' })
    ]),
    el('button', {
      className: 'section-reset-btn',
      type: 'button',
      html: `${ICON_REFRESH}<span>Reset section</span>`,
      onclick: () => resetSettingsSection('clock')
    })
  ]);
  section.appendChild(secHeader);

  // Clock toggle
  section.appendChild(renderToggleRow('Show Clock', 'Display current time', settings.showClock, (val) => {
    store.updateSettings({ showClock: val });
  }));

  // Date toggle
  section.appendChild(renderToggleRow('Show Date', 'Display localized date', settings.showDate, (val) => {
    store.updateSettings({ showDate: val });
  }));

  // Greeting toggle
  section.appendChild(renderToggleRow('Show Greeting', 'Display time-of-day greeting', settings.showGreeting, (val) => {
    store.updateSettings({ showGreeting: val });
  }));

  // 6.3 Greeting Name
  const nameInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'Your name (e.g. Alex)',
    value: settings.userName || '',
    style: { marginTop: '4px' }
  }));
  nameInput.addEventListener('input', () => {
    store.updateSettings({ userName: nameInput.value });
  });

  const nameGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Greeting Name' }),
      el('span', { className: 'setting-desc', text: 'Personalizes greeting (e.g. Good evening, Alex)' })
    ),
    nameInput
  );
  section.appendChild(nameGroup);

  // 6.3 Countdown to Date
  const cdConf = settings.countdown || { label: '', date: null };
  const cdLabelInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'Event label (e.g. Vacation, Launch)',
    value: cdConf.label || '',
    style: { flex: '1' }
  }));

  const cdDateInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'date',
    className: 'form-input',
    value: cdConf.date || '',
    style: { width: '150px' }
  }));

  const updateCountdown = () => {
    const lbl = cdLabelInput.value.trim();
    const dt = cdDateInput.value;
    store.updateSettings({
      countdown: {
        label: lbl,
        date: dt || null
      }
    });
  };

  cdLabelInput.addEventListener('input', updateCountdown);
  cdDateInput.addEventListener('change', updateCountdown);

  const cdClearBtn = el('button', {
    className: 'btn-secondary btn-sm',
    type: 'button',
    text: 'Clear',
    onclick: () => {
      cdLabelInput.value = '';
      cdDateInput.value = '';
      store.updateSettings({ countdown: { label: '', date: null } });
      renderDrawerContent();
    }
  });

  const cdRow = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
    cdLabelInput,
    cdDateInput,
    cdClearBtn
  ]);

  const countdownGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Event Countdown' }),
      el('span', { className: 'setting-desc', text: 'Displays days remaining badge beneath clock' })
    ),
    cdRow
  );
  section.appendChild(countdownGroup);

  // 6.1 Clock Size & Style
  const currentClockSize = clockConf.size || (clockConf.style === 'small' ? 'small' : (clockConf.style === 'large' ? 'large' : (clockConf.style === 'medium' ? 'medium' : 'huge')));
  const clockStyleGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Clock Size' }),
      el('span', { className: 'setting-desc', text: 'Choose clock size (Small, Medium, Large, Huge)' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
      renderRadioCard('Small', currentClockSize === 'small', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.clock = { ...(curHero.clock || {}), w: 300, h: 80 };
        store.updateSettings({
          clock: { ...clockConf, style: 'small', size: 'small' },
          hero: { ...(settings.hero || {}), widgets: curHero }
        });
        renderDrawerContent();
      }),
      renderRadioCard('Medium', currentClockSize === 'medium', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.clock = { ...(curHero.clock || {}), w: 480, h: 120 };
        store.updateSettings({
          clock: { ...clockConf, style: 'large', size: 'medium' },
          hero: { ...(settings.hero || {}), widgets: curHero }
        });
        renderDrawerContent();
      }),
      renderRadioCard('Large', currentClockSize === 'large', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.clock = { ...(curHero.clock || {}), w: 680, h: 160 };
        store.updateSettings({
          clock: { ...clockConf, style: 'large', size: 'large' },
          hero: { ...(settings.hero || {}), widgets: curHero }
        });
        renderDrawerContent();
      }),
      renderRadioCard('Huge', currentClockSize === 'huge' || currentClockSize === 'hero', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.clock = { ...(curHero.clock || {}), w: null, h: null };
        store.updateSettings({
          clock: { ...clockConf, style: 'hero', size: 'huge' },
          hero: { ...(settings.hero || {}), widgets: curHero }
        });
        renderDrawerContent();
      })
    )
  );
  section.appendChild(clockStyleGroup);

  // 12h / 24h format
  const formatGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Time Format' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('12-Hour (AM/PM)', settings.timeFormat === '12h', () => {
        store.updateSettings({ timeFormat: '12h' });
        renderDrawerContent();
      }),
      renderRadioCard('24-Hour', settings.timeFormat === '24h', () => {
        store.updateSettings({ timeFormat: '24h' });
        renderDrawerContent();
      })
    )
  );
  section.appendChild(formatGroup);

  // 6.1 Show Seconds toggle
  section.appendChild(renderToggleRow('Show Seconds', 'Display running seconds counter', Boolean(clockConf.showSeconds), (val) => {
    store.updateSettings({ clock: { ...clockConf, showSeconds: val } });
  }));

  // 6.1 Date Format Picker
  const currentDateFmt = clockConf.dateFormat || 'weekday-short';
  const dateFmtSelect = /** @type {HTMLSelectElement} */ (el('select', { className: 'form-select' },
    el('option', { value: 'weekday-short', text: 'Weekday, Short (e.g. Monday, Oct 5)' }),
    el('option', { value: 'weekday-full', text: 'Weekday, Full (e.g. Monday, October 5, 2026)' }),
    el('option', { value: 'short', text: 'Short (e.g. Oct 5, 2026)' }),
    el('option', { value: 'iso', text: 'ISO 8601 (e.g. 2026-10-05)' }),
    el('option', { value: 'day-first', text: 'Day First (e.g. 5 Oct 2026)' })
  ));
  dateFmtSelect.value = currentDateFmt;
  dateFmtSelect.addEventListener('change', () => {
    store.updateSettings({ clock: { ...clockConf, dateFormat: dateFmtSelect.value } });
  });

  const dateFmtGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Date Display Format' })
    ),
    dateFmtSelect
  );
  section.appendChild(dateFmtGroup);

  // 6.1 Second Timezone Picker
  const currentTz = clockConf.secondTimezone || '';
  const tzInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'e.g. America/New_York, Asia/Tokyo, UTC',
    value: currentTz
  }));
  tzInput.setAttribute('list', 'supported-tz-list');

  const tzDatalist = el('datalist', { id: 'supported-tz-list' });
  const sampleTimezones = getSupportedTimezones();
  for (const tzName of sampleTimezones.slice(0, 50)) {
    tzDatalist.appendChild(el('option', { value: tzName }));
  }

  const tzStatus = el('span', {
    className: 'setting-desc',
    text: currentTz ? (isValidTimezone(currentTz) ? `Active: ${currentTz}` : 'Invalid timezone') : 'Optional secondary world clock'
  });

  const applyTz = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      store.updateSettings({ clock: { ...clockConf, secondTimezone: null } });
      tzStatus.textContent = 'Optional secondary world clock';
      tzStatus.style.color = '';
    } else if (isValidTimezone(trimmed)) {
      store.updateSettings({ clock: { ...clockConf, secondTimezone: trimmed } });
      tzStatus.textContent = `Active: ${trimmed}`;
      tzStatus.style.color = '';
    } else {
      tzStatus.textContent = 'Invalid timezone (e.g. America/New_York or UTC)';
      tzStatus.style.color = 'var(--text-danger, #ef4444)';
    }
  };

  tzInput.addEventListener('change', () => applyTz(tzInput.value));

  const tzClearBtn = el('button', {
    className: 'btn-secondary btn-sm',
    type: 'button',
    text: 'Clear',
    onclick: () => {
      tzInput.value = '';
      applyTz('');
    }
  });

  const tzInputRow = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
    tzInput,
    tzClearBtn
  ]);

  const tzGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Second Timezone' }),
      tzStatus
    ),
    tzInputRow,
    tzDatalist
  );
  section.appendChild(tzGroup);

  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Clock to Defaults',
    onclick: () => resetSettingsSection('clock')
  }));

  return section;
}

function renderAccessibilitySection(settings) {
  const section = el('div', { className: 'settings-section' });

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Accessibility & Motion' }),
      el('p', { className: 'settings-section-subtitle', text: 'Motion reduction preferences, enlarged touch targets, and high contrast mode' })
    ]),
    el('button', {
      className: 'section-reset-btn',
      type: 'button',
      html: `${ICON_REFRESH}<span>Reset section</span>`,
      onclick: () => resetSettingsSection('accessibility')
    })
  ]);
  section.appendChild(secHeader);

  // Motion Preference (System vs Reduce)
  const currentMotion = settings.motion === 'reduce' ? 'reduce' : 'system';
  const motionGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Motion & Animations' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('System Default', currentMotion === 'system', () => {
        store.updateSettings({ motion: 'system' });
        renderDrawerContent();
      }),
      renderRadioCard('Reduce Motion', currentMotion === 'reduce', () => {
        store.updateSettings({ motion: 'reduce' });
        renderDrawerContent();
      })
    ),
    el('div', { className: 'setting-hint', text: 'Reduce motion minimizes transitions and animations across the dashboard.' })
  );
  section.appendChild(motionGroup);

  // Large Touch Targets (min 44x44px)
  const isLargeTargets = Boolean(settings.largeTargets === true);
  const largeTargetsRow = renderToggleRow(
    'Large Touch Targets',
    'Expands interactive buttons and bookmarks to a minimum of 44×44px for easier clicking/tapping',
    isLargeTargets,
    (checked) => {
      store.updateSettings({ largeTargets: checked });
      renderDrawerContent();
    }
  );
  section.appendChild(largeTargetsRow);

  // High Contrast Palette (Standard vs WCAG AAA Contrast)
  const isHighContrast = settings.palette === 'contrast';
  const contrastGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Contrast Mode' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('Standard Palette', !isHighContrast, () => {
        store.updateSettings({ palette: 'default' });
        renderDrawerContent();
      }),
      renderRadioCard('WCAG AAA Contrast', isHighContrast, () => {
        store.updateSettings({ palette: 'contrast' });
        renderDrawerContent();
      })
    ),
    el('div', { className: 'setting-hint', text: 'Uses pure black and white surfaces with high contrast borders.' })
  );
  section.appendChild(contrastGroup);

  // Reset Accessibility
  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Accessibility to Defaults',
    onclick: () => resetSettingsSection('accessibility')
  }));

  return section;
}

function renderSearchSection(settings) {
  const section = el('div', { className: 'settings-section' });

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Search & Link Behavior' }),
      el('p', { className: 'settings-section-subtitle', text: 'Default web search engine, link navigation targets, and idle auto-hide' })
    ]),
    el('button', {
      className: 'section-reset-btn',
      type: 'button',
      html: `${ICON_REFRESH}<span>Reset section</span>`,
      onclick: () => resetSettingsSection('search')
    })
  ]);
  section.appendChild(secHeader);

  const select = /** @type {HTMLSelectElement} */ (el('select', { className: 'form-select' },
    el('option', { value: 'google', text: 'Google' }),
    el('option', { value: 'brave', text: 'Brave Search' }),
    el('option', { value: 'duckduckgo', text: 'DuckDuckGo' }),
    el('option', { value: 'bing', text: 'Bing' })
  ));
  select.value = settings.searchEngine || 'google';

  select.addEventListener('change', () => {
    store.updateSettings({ searchEngine: select.value });
    showToast(`Search engine set to ${select.options[select.selectedIndex].text}`);
  });

  const searchGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Default Search Engine' })
    ),
    select
  );
  section.appendChild(searchGroup);

  // Open Links In (same tab vs new tab)
  const openInGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Open Links In' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('Same Tab', (settings.behavior?.openIn || 'same') === 'same', () => {
        store.updateSettings({ behavior: { ...(settings.behavior || {}), openIn: 'same' } });
        renderDrawerContent();
      }),
      renderRadioCard('New Tab', (settings.behavior?.openIn || 'same') === 'new', () => {
        store.updateSettings({ behavior: { ...(settings.behavior || {}), openIn: 'new' } });
        renderDrawerContent();
      })
    )
  );
  section.appendChild(openInGroup);

  // 6.5 Auto-Hide Mode
  const isAutoHide = Boolean(settings.behavior?.autoHide);
  const autoHideRow = renderToggleRow(
    'Auto-hide Dashboard',
    'Show only clock and search until mouse moves or a key is pressed',
    isAutoHide,
    (checked) => {
      store.updateSettings({ behavior: { ...(settings.behavior || {}), autoHide: checked } });
      renderDrawerContent();
    }
  );
  section.appendChild(autoHideRow);

  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Search & Behavior to Defaults',
    onclick: () => resetSettingsSection('search')
  }));

  return section;
}

function renderSpacesSection(state) {
  const section = el('div', { className: 'settings-section' });
  const spaces = [...(state.spaces || [])].sort((a, b) => a.order - b.order);

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Spaces & Workspaces' }),
      el('p', { className: 'settings-section-subtitle', text: 'Separate browsing contexts for work, personal, and research activities' })
    ])
  ]);
  section.appendChild(secHeader);

  const list = el('div', { className: 'cat-mgmt-list' });

  spaces.forEach((sp, idx) => {
    const colCount = (state.categories || []).filter(c => c.spaceId === sp.id).length;
    const isActive = sp.id === state.activeSpaceId;

    const info = el('div', { className: 'cat-mgmt-info' },
      el('span', { className: 'cat-mgmt-icon', html: getIconSvg(sp.icon || 'folder', 15) }),
      el('span', { text: sp.name, style: { fontWeight: '500' } }),
      el('span', { text: `(${colCount} collections)`, style: { color: 'var(--text-muted)' } }),
      isActive ? el('span', { className: 'search-result-section-badge', text: 'Active' }) : null
    );

    const upBtn = idx > 0 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      html: ICON_ARROW_UP,
      title: 'Move up',
      onclick: () => {
        store.reorderSpaces(idx, idx - 1);
        renderDrawerContent();
      }
    }) : null;

    const downBtn = idx < spaces.length - 1 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      html: ICON_ARROW_DOWN,
      title: 'Move down',
      onclick: () => {
        store.reorderSpaces(idx, idx + 1);
        renderDrawerContent();
      }
    }) : null;

    const editBtn = el('button', {
      className: 'icon-action-btn',
      type: 'button',
      html: ICON_EDIT,
      title: 'Rename space',
      onclick: () => {
        openRenameSpaceDialog(sp);
      }
    });

    const deleteBtn = spaces.length > 1 ? el('button', {
      className: 'icon-action-btn delete',
      type: 'button',
      html: ICON_CLOSE,
      title: 'Delete space',
      onclick: () => {
        openDeleteSpaceDialog(sp);
      }
    }) : null;

    const actions = el('div', { className: 'cat-mgmt-actions' });
    if (upBtn) actions.appendChild(upBtn);
    if (downBtn) actions.appendChild(downBtn);
    actions.appendChild(editBtn);
    if (deleteBtn) actions.appendChild(deleteBtn);

    const item = el('div', { className: 'cat-mgmt-item' }, info, actions);
    list.appendChild(item);
  });

  const addBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    html: `${ICON_PLUS}<span>Add New Space</span>`,
    onclick: () => {
      openAddSpaceDialog();
    }
  });

  section.appendChild(el('span', { className: 'setting-label', text: 'Manage Spaces' }));
  section.appendChild(list);
  section.appendChild(addBtn);
  return section;
}

function renderCategoriesSection(categories) {
  const section = el('div', { className: 'settings-section' });

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Collections & Bookmarks' }),
      el('p', { className: 'settings-section-subtitle', text: 'Organize bookmark folders, change icons and names, or reorder collections' })
    ])
  ]);
  section.appendChild(secHeader);

  const list = el('div', { className: 'cat-mgmt-list' });

  categories.forEach((cat, idx) => {
    const info = el('div', { className: 'cat-mgmt-info' },
      el('span', { className: 'cat-mgmt-icon', html: getIconSvg(cat.icon || 'folder', 15) }),
      el('span', { text: cat.name, style: { fontWeight: '500' } }),
      el('span', { text: `(${cat.bookmarks.length})`, style: { color: 'var(--text-muted)' } })
    );

    const upBtn = idx > 0 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      html: ICON_ARROW_UP,
      title: 'Move up',
      onclick: () => {
        store.reorderCategories(idx, idx - 1);
        renderDrawerContent();
      }
    }) : null;

    const downBtn = idx < categories.length - 1 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      html: ICON_ARROW_DOWN,
      title: 'Move down',
      onclick: () => {
        store.reorderCategories(idx, idx + 1);
        renderDrawerContent();
      }
    }) : null;

    const editBtn = el('button', {
      className: 'icon-action-btn',
      type: 'button',
      html: ICON_EDIT,
      title: 'Edit collection',
      onclick: () => {
        openCategoryDialog({
          mode: 'edit',
          category: cat,
          onSave: (data) => {
            store.updateCategory(cat.id, data);
            renderDrawerContent();
          }
        });
      }
    });

    const actions = el('div', { className: 'cat-mgmt-actions' });
    if (upBtn) actions.appendChild(upBtn);
    if (downBtn) actions.appendChild(downBtn);
    actions.appendChild(editBtn);

    const item = el('div', { className: 'cat-mgmt-item' }, info, actions);
    list.appendChild(item);
  });

  const addBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    html: `${ICON_PLUS}<span>Add New Collection</span>`,
    onclick: () => {
      openCategoryDialog({
        mode: 'add',
        onSave: (data) => {
          store.addCategory(data);
          renderDrawerContent();
        }
      });
    }
  });

  section.appendChild(el('span', { className: 'setting-label', text: 'Manage Collections' }));
  section.appendChild(list);
  section.appendChild(addBtn);
  return section;
}
