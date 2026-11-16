// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { store } from '../core/state.js';
import { showToast } from './toasts.js';
import { openCategoryDialog } from './dialogs.js';
import { createDefaultSettings } from '../core/schema.js';
import { deleteBackgroundImage } from '../core/idb.js';
import { openAddSpaceDialog, openRenameSpaceDialog, openDeleteSpaceDialog } from '../features/spaces.js';
import { isValidTimezone, getSupportedTimezones } from '../features/clock.js';
import { renderAppearanceSection } from './drawer/appearance.js';
import { renderLayoutSection } from './drawer/layout.js';
import { renderWidgetsSection } from './drawer/widgets.js';
import { renderDataSection } from './drawer/data.js';
import { renderRadioCard, renderToggleRow, renderSectionHeader } from './drawer/common.js';
import { WIDGET_GRID_SPECS, GRID_CELL_WIDTH, GRID_CELL_HEIGHT } from '../features/widget-drag.js';

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
  { id: 'layout', label: 'App Dock', icon: ICON_LAYOUT, group: 'Core' },
  { id: 'widgets', label: 'Widgets', icon: ICON_WIDGETS, group: 'Core' },
  { id: 'categories', label: 'Collections', icon: ICON_COLLECTIONS, group: 'Core' },
  { id: 'spaces', label: 'Spaces', icon: ICON_SPACES, group: 'Productivity' },
  { id: 'clock', label: 'Clock & Date', icon: ICON_CLOCK, group: 'Productivity' },
  { id: 'search', label: 'Search', icon: ICON_SEARCH, group: 'Productivity' },
  { id: 'accessibility', label: 'Accessibility', icon: ICON_ACCESSIBILITY, group: 'System' },
  { id: 'data', label: 'Backup & Data', icon: ICON_DATA, group: 'System' }
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
  { id: 'theme', section: 'appearance', label: 'Theme & Presets (System, Light, Dark)', keywords: 'color mode dark light system appearance preset' },
  { id: 'themeSchedule', section: 'appearance', label: 'Theme Schedule (Auto Light/Dark)', keywords: 'schedule auto light dark switch time hours sunrise sunset' },
  { id: 'palette', section: 'appearance', label: 'Color Palette', keywords: 'palette default amoled paper contrast' },
  { id: 'accent', section: 'appearance', label: 'Accent Color & Custom Hex', keywords: 'accent slate blue emerald amber rose custom color wcag' },
  { id: 'background', section: 'appearance', label: 'Background, Wallpaper & Dimming', keywords: 'wallpaper background solid gradient image blur dim rotation readability' },
  { id: 'typography', section: 'appearance', label: 'Font Family & Text Size Scale', keywords: 'font family sans serif mono text size scale typography' },
  { id: 'glass', section: 'appearance', label: 'Frosted Glass Surface (Blur & Opacity)', keywords: 'glass blur opacity frosted translucency transparency' },
  { id: 'dock', section: 'layout', label: 'App Dock Position, Auto-Hide & Limit', keywords: 'dock position autohide pinned items max top bottom left right' },
  { id: 'widgets', section: 'widgets', label: 'Widgets & Live Desktop Editor', keywords: 'widgets editor resize small medium large weather timer pomodoro speed dial quote notes todo glance habits world clock countdown soundscapes voice memo pulse clipboard calculator reading queue' },
  { id: 'weather', section: 'widgets', label: 'Weather Capsule & City', keywords: 'weather temperature celsius fahrenheit city open-meteo' },
  { id: 'clock', section: 'clock', label: 'Clock Size, Format & Seconds', keywords: 'time clock 12h 24h 24-hour seconds size small medium large huge' },
  { id: 'greeting', section: 'clock', label: 'Greeting, Name, Date & Countdown', keywords: 'greeting name date format countdown event second timezone world clock' },
  { id: 'searchEngine', section: 'search', label: 'Search Engine, Link Target & Auto-Hide', keywords: 'search engine google brave duckduckgo bing open links new tab same tab auto-hide' },
  { id: 'accessibility', section: 'accessibility', label: 'Accessibility, Reduced Motion & Touch Targets', keywords: 'accessibility motion reduce animation transitions large targets 44px touch' },
  { id: 'spaces', section: 'spaces', label: 'Spaces & Workspaces', keywords: 'spaces dashboards add rename delete reorder move' },
  { id: 'categories', section: 'categories', label: 'Manage Collections', keywords: 'categories collections add reorder edit' },
  { id: 'snapshots', section: 'data', label: 'Backup, Export, Import & Snapshots', keywords: 'snapshots restore backup export import json html csv database reset' }
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
    label = 'App Dock';
    patch = {
      dock: JSON.parse(JSON.stringify(defaults.dock))
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
      largeTargets: defaults.largeTargets
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
    for (const k of ['glance', 'habits', 'worldclock', 'countdown', 'soundscapes', 'voicememo', 'pulse', 'clipboard', 'calculator', 'readlater']) {
      heroWidgets[k] = { ...(heroWidgets[k] || {}), hidden: !defaults.widgets[k] };
    }
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
 * Populates `.drawer-content` for the active tab or search query without rebuilding the sidebar.
 * @param {HTMLElement} content
 * @param {import('../core/schema.js').DashboardData} state
 */
function populateDrawerContentArea(content, state) {
  clearChildren(content);
  const settings = state.settings;

  if (searchQuery.trim().length > 0) {
    const matches = filterSettingsByQuery(searchQuery);
    const resultsContainer = el('div', { className: 'settings-section search-results-section' });
    const searchHeader = el('div', { className: 'settings-section-header' }, [
      el('div', {}, [
        el('h3', { className: 'settings-section-headline', text: 'Search Results' }),
        el('p', {
          className: 'settings-section-subtitle',
          text: `${matches.length} ${matches.length === 1 ? 'setting' : 'settings'} matching "${searchQuery.trim()}"`
        })
      ]),
      el('button', {
        className: 'section-reset-btn',
        type: 'button',
        text: '← Back to Menu',
        onclick: () => {
          searchQuery = '';
          renderDrawerContent();
        }
      })
    ]);
    resultsContainer.appendChild(searchHeader);

    if (matches.length === 0) {
      resultsContainer.appendChild(el('div', {
        className: 'snapshot-empty-hint',
        text: `No settings matching "${searchQuery}". Try searching for "clock", "theme", "timer", or "backup".`
      }));
    } else {
      const resultsList = el('div', { className: 'search-results-list' });
      matches.forEach(m => {
        const tabMeta = TABS.find(t => t.id === m.section);
        const item = el('button', {
          className: 'search-result-item drawer-search-result-btn',
          type: 'button',
          onclick: () => {
            activeTab = m.section;
            searchQuery = '';
            renderDrawerContent();
          }
        }, [
          el('div', { className: 'search-result-info' }, [
            el('span', { className: 'search-result-label', text: m.label }),
            el('span', { className: 'search-result-section-badge', text: tabMeta?.label || m.section })
          ]),
          el('span', { className: 'search-result-go', text: 'Open →' })
        ]);
        resultsList.appendChild(item);
      });
      resultsContainer.appendChild(resultsList);
    }
    content.appendChild(resultsContainer);
    return;
  }

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
  const activeTabObj = TABS.find(t => t.id === activeTab) || TABS[0];

  // Header with stable ID for aria-labelledby, Revert and Done buttons
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
        text: 'Revert',
        title: 'Discard changes made since opening settings',
        onclick: () => closeDrawer(true)
      }),
      el('button', {
        className: 'btn-primary btn-sm drawer-done-btn',
        type: 'button',
        text: 'Done',
        title: 'Save and close settings',
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

  // Content Container (created early so search input can update it in-place without losing focus)
  const content = el('div', { className: 'drawer-content' });

  // Search box
  const searchWrapper = el('div', { className: 'drawer-search-wrapper' });
  const searchIcon = el('span', { className: 'drawer-search-icon', html: ICON_SEARCH });
  const searchInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'search',
    className: 'drawer-search-input',
    placeholder: 'Search settings...',
    'aria-label': 'Search settings',
    value: searchQuery
  }));
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    populateDrawerContentArea(content, store.get());
    lastSearchQuery = searchQuery;
  });
  searchWrapper.appendChild(searchIcon);
  searchWrapper.appendChild(searchInput);

  // Tab Nav
  const nav = el('nav', { className: 'drawer-nav', 'aria-label': 'Settings sections' });
  let currentGroup = '';
  for (const tab of TABS) {
    if (tab.group && tab.group !== currentGroup) {
      currentGroup = tab.group;
      nav.appendChild(el('div', {
        className: 'drawer-nav-group-header',
        text: currentGroup
      }));
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

  populateDrawerContentArea(content, state);

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

  section.appendChild(renderSectionHeader(
    'Clock, Date & Greeting',
    'Configure clock size, time format, personal greeting, secondary world clock, and countdown',
    () => resetSettingsSection('clock')
  ));

  // Card 1: Display Elements & Greeting Name
  const nameInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'Your name (e.g. Alex)',
    value: settings.userName || '',
    'aria-label': 'Greeting name'
  }));
  nameInput.addEventListener('input', () => {
    store.updateSettings({ userName: nameInput.value });
  });

  const displayCard = el('div', { className: 'setting-item setting-grouped-card' }, [
    renderToggleRow('Show Clock', 'Display current time on your home screen', settings.showClock, (val) => {
      store.updateSettings({ showClock: val });
    }, { flat: true }),
    renderToggleRow('Show Date', 'Display localized date beneath the clock', settings.showDate, (val) => {
      store.updateSettings({ showDate: val });
    }, { flat: true }),
    renderToggleRow('Show Greeting', 'Display time-of-day greeting', settings.showGreeting, (val) => {
      store.updateSettings({ showGreeting: val });
    }, { flat: true }),
    el('div', { className: 'setting-sub-field' }, [
      el('div', { className: 'setting-toggle-info' }, [
        el('span', { className: 'setting-label', text: 'Greeting Name' }),
        el('span', { className: 'setting-desc', text: 'Personalizes greeting (e.g. Good evening, Alex)' })
      ]),
      nameInput
    ])
  ]);
  section.appendChild(displayCard);

  // Card 2: Clock Size, Format & Date Style
  const currentClockSize = clockConf.size || (clockConf.style === 'small' ? 'small' : (clockConf.style === 'large' ? 'large' : (clockConf.style === 'medium' ? 'medium' : 'huge')));
  const clockPresets = WIDGET_GRID_SPECS.clock.presets;
  const applyClockPreset = (presetName, style, size) => {
    const curHero = { ...(settings.hero?.widgets || {}) };
    if (presetName && clockPresets[presetName]) {
      const [cols, rows] = clockPresets[presetName];
      curHero.clock = { ...(curHero.clock || {}), w: cols * GRID_CELL_WIDTH, h: rows * GRID_CELL_HEIGHT };
    } else {
      curHero.clock = { ...(curHero.clock || {}), w: null, h: null };
    }
    store.updateSettings({
      clock: { ...clockConf, style, size },
      hero: { ...(settings.hero || {}), widgets: curHero }
    });
    renderDrawerContent();
  };

  const currentDateFmt = clockConf.dateFormat || 'weekday-short';
  const dateFmtSelect = /** @type {HTMLSelectElement} */ (el('select', {
    className: 'form-select',
    'aria-label': 'Date display format'
  },
    el('option', { value: 'weekday-short', text: 'Weekday, Short (Monday, Oct 5)' }),
    el('option', { value: 'weekday-full', text: 'Weekday, Full (Monday, October 5, 2026)' }),
    el('option', { value: 'short', text: 'Short (Oct 5, 2026)' }),
    el('option', { value: 'iso', text: 'ISO 8601 (2026-10-05)' }),
    el('option', { value: 'day-first', text: 'Day First (5 Oct 2026)' })
  ));
  dateFmtSelect.value = currentDateFmt;
  dateFmtSelect.addEventListener('change', () => {
    store.updateSettings({ clock: { ...clockConf, dateFormat: dateFmtSelect.value } });
  });

  const formatCard = el('div', { className: 'setting-item setting-grouped-card' }, [
    el('div', { className: 'setting-sub-field' }, [
      el('div', { className: 'setting-toggle-info' }, [
        el('span', { className: 'setting-label', text: 'Clock Size' }),
        el('span', { className: 'setting-desc', text: 'Pick a preset box size or Auto for the default Hero scale' })
      ]),
      el('div', { className: 'radio-group-cards radio-group-4' },
        renderRadioCard('Small', currentClockSize === 'small', () => applyClockPreset('S', 'small', 'small')),
        renderRadioCard('Medium', currentClockSize === 'medium', () => applyClockPreset('M', 'large', 'medium')),
        renderRadioCard('Large', currentClockSize === 'large', () => applyClockPreset('L', 'large', 'large')),
        renderRadioCard('Auto', currentClockSize === 'huge' || currentClockSize === 'hero', () => applyClockPreset(null, 'hero', 'huge'))
      )
    ]),
    el('div', { className: 'setting-sub-field' }, [
      el('span', { className: 'setting-label', text: 'Time Format' }),
      el('div', { className: 'radio-group-cards radio-group-2' },
        renderRadioCard('12-Hour (AM/PM)', settings.timeFormat === '12h', () => {
          store.updateSettings({ timeFormat: '12h' });
          renderDrawerContent();
        }),
        renderRadioCard('24-Hour', settings.timeFormat === '24h', () => {
          store.updateSettings({ timeFormat: '24h' });
          renderDrawerContent();
        })
      )
    ]),
    renderToggleRow('Show Seconds', 'Display live running seconds counter', Boolean(clockConf.showSeconds), (val) => {
      store.updateSettings({ clock: { ...clockConf, showSeconds: val } });
    }, { flat: true }),
    el('div', { className: 'setting-sub-field' }, [
      el('span', { className: 'setting-label', text: 'Date Format' }),
      dateFmtSelect
    ])
  ]);
  section.appendChild(formatCard);

  // Card 3: Second Timezone & Event Countdown
  const currentTz = clockConf.secondTimezone || '';
  const tzInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'e.g. America/New_York, Asia/Tokyo, UTC',
    value: currentTz,
    style: { flex: '1', minWidth: '0' }
  }));
  tzInput.setAttribute('list', 'supported-tz-list');

  const tzDatalist = el('datalist', { id: 'supported-tz-list' });
  const sampleTimezones = getSupportedTimezones();
  for (const tzName of sampleTimezones.slice(0, 50)) {
    tzDatalist.appendChild(el('option', { value: tzName }));
  }

  const tzStatus = el('span', {
    className: 'setting-desc',
    text: currentTz ? (isValidTimezone(currentTz) ? `Active: ${currentTz}` : 'Invalid timezone') : 'Optional secondary world clock beneath the main time'
  });

  const applyTz = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      store.updateSettings({ clock: { ...clockConf, secondTimezone: null } });
      tzStatus.textContent = 'Optional secondary world clock beneath the main time';
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

  const cdConf = settings.countdown || { label: '', date: null };
  const cdLabelInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'Event label (e.g. Vacation, Launch)',
    value: cdConf.label || '',
    style: { flex: '1', minWidth: '140px' }
  }));

  const cdDateInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'date',
    className: 'form-input',
    value: cdConf.date || '',
    style: { width: '148px' }
  }));

  const updateCountdown = () => {
    store.updateSettings({
      countdown: {
        label: cdLabelInput.value.trim(),
        date: cdDateInput.value || null
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

  const extrasCard = el('div', { className: 'setting-item setting-grouped-card' }, [
    el('div', { className: 'setting-sub-field' }, [
      el('div', { className: 'setting-toggle-info' }, [
        el('span', { className: 'setting-label', text: 'Second Timezone' }),
        tzStatus
      ]),
      el('div', { className: 'setting-inline-row' }, [tzInput, tzClearBtn]),
      tzDatalist
    ]),
    el('div', { className: 'setting-sub-field' }, [
      el('div', { className: 'setting-toggle-info' }, [
        el('span', { className: 'setting-label', text: 'Event Countdown' }),
        el('span', { className: 'setting-desc', text: 'Displays a days-remaining badge beneath the clock' })
      ]),
      el('div', { className: 'setting-inline-row' }, [cdLabelInput, cdDateInput, cdClearBtn])
    ])
  ]);
  section.appendChild(extrasCard);

  return section;
}

function renderAccessibilitySection(settings) {
  const section = el('div', { className: 'settings-section' });

  section.appendChild(renderSectionHeader(
    'Accessibility & Motion',
    'Motion reduction preferences and enlarged touch targets',
    () => resetSettingsSection('accessibility')
  ));

  // Motion Preference (System vs Reduce)
  const currentMotion = settings.motion === 'reduce' ? 'reduce' : 'system';
  const motionGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('div', { className: 'setting-toggle-info' },
        el('span', { className: 'setting-label', text: 'Motion & Animations' }),
        el('span', { className: 'setting-desc', text: 'Reduce motion minimizes transitions and animations across the dashboard' })
      )
    ),
    el('div', { className: 'radio-group-cards radio-group-2' },
      renderRadioCard('System Default', currentMotion === 'system', () => {
        store.updateSettings({ motion: 'system' });
        renderDrawerContent();
      }),
      renderRadioCard('Reduce Motion', currentMotion === 'reduce', () => {
        store.updateSettings({ motion: 'reduce' });
        renderDrawerContent();
      })
    )
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

  return section;
}

function renderSearchSection(settings) {
  const section = el('div', { className: 'settings-section' });

  section.appendChild(renderSectionHeader(
    'Search & Link Behavior',
    'Default web search engine, link navigation targets, and idle auto-hide',
    () => resetSettingsSection('search')
  ));

  const select = /** @type {HTMLSelectElement} */ (el('select', {
    className: 'form-select',
    'aria-label': 'Default search engine'
  },
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
      el('div', { className: 'setting-toggle-info' },
        el('span', { className: 'setting-label', text: 'Default Search Engine' }),
        el('span', { className: 'setting-desc', text: 'Used when submitting queries from the search bar' })
      )
    ),
    select
  );
  section.appendChild(searchGroup);

  // Open Links In (same tab vs new tab)
  const openInGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('div', { className: 'setting-toggle-info' },
        el('span', { className: 'setting-label', text: 'Open Links In' }),
        el('span', { className: 'setting-desc', text: 'Choose whether pinned dock and speed dial links open in this tab or a new tab' })
      )
    ),
    el('div', { className: 'radio-group-cards radio-group-2' },
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

  return section;
}

function renderSpacesSection(state) {
  const section = el('div', { className: 'settings-section' });
  const spaces = [...(state.spaces || [])].sort((a, b) => a.order - b.order);

  section.appendChild(renderSectionHeader(
    'Spaces & Workspaces',
    'Separate browsing contexts for work, personal, and research activities'
  ));

  const list = el('div', { className: 'cat-mgmt-list' });

  spaces.forEach((sp, idx) => {
    const colCount = (state.categories || []).filter(c => c.spaceId === sp.id).length;
    const isActive = sp.id === state.activeSpaceId;

    const info = el('div', { className: 'cat-mgmt-info' },
      el('span', { className: 'cat-mgmt-icon', html: getIconSvg(sp.icon || 'folder', 15) }),
      el('span', { text: sp.name, style: { fontWeight: '500' } }),
      el('span', { text: `(${colCount} collections)`, style: { color: 'var(--text-muted)' } }),
      isActive ? el('span', { className: 'widget-active-badge', text: 'Active' }) : null
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

  section.appendChild(el('div', { className: 'setting-item' }, [
    el('div', { className: 'setting-item-header' }, [
      el('span', { className: 'setting-label', text: 'Manage Spaces' }),
      addBtn
    ]),
    list
  ]));
  return section;
}

function renderCategoriesSection(categories) {
  const section = el('div', { className: 'settings-section' });

  section.appendChild(renderSectionHeader(
    'Collections & Bookmarks',
    'Organize bookmark folders, change icons and names, or reorder collections'
  ));

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

  section.appendChild(el('div', { className: 'setting-item' }, [
    el('div', { className: 'setting-item-header' }, [
      el('span', { className: 'setting-label', text: 'Manage Collections' }),
      addBtn
    ]),
    list
  ]));
  return section;
}
