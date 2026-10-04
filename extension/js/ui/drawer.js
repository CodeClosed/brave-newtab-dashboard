// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { store } from '../core/state.js';
import { showToast } from './toasts.js';
import { exportDashboardToFile, parseAndValidateBookmarksImport } from '../features/data-io.js';
import { openCategoryDialog, openConfirmDialog, openImportPreviewDialog } from './dialogs.js';
import { createDefaultDashboardData, createDefaultSettings, validateDashboardData } from '../core/schema.js';
import { migrate } from '../core/migrate.js';
import { saveBackgroundImage, deleteBackgroundImage } from '../core/idb.js';
import { downscaleImage } from '../features/theme.js';
import { createSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot } from '../core/snapshots.js';
import { openAddSpaceDialog, openRenameSpaceDialog, openDeleteSpaceDialog } from '../features/spaces.js';

let drawerElement = null;
let activeTab = 'appearance';
let lastActiveElement = null;
let openingSnapshot = null;
let searchQuery = '';

const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'layout', label: 'Layout' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'clock', label: 'Clock' },
  { id: 'search', label: 'Search' },
  { id: 'categories', label: 'Categories' },
  { id: 'data', label: 'Data' }
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
  { name: 'Slate Calm', value: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' },
  { name: 'Nordic Deep', value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
  { name: 'Quiet Dusk', value: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' }
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
  { id: 'palette', section: 'appearance', label: 'Color Palette', keywords: 'palette default amoled paper contrast' },
  { id: 'accent', section: 'appearance', label: 'Accent Color', keywords: 'accent slate blue emerald amber rose custom color' },
  { id: 'background', section: 'appearance', label: 'Background & Wallpaper', keywords: 'wallpaper background solid gradient image' },
  { id: 'layout', section: 'layout', label: 'Card Layout', keywords: 'grid compact layout card style' },
  { id: 'cards', section: 'layout', label: 'Card Columns & Width', keywords: 'columns gap width translucent cards filled' },
  { id: 'clock', section: 'clock', label: 'Clock & Date Display', keywords: 'time clock greeting date format 12h 24h 24-hour seconds timezone' },
  { id: 'searchEngine', section: 'search', label: 'Search Engine', keywords: 'search engine google brave duckduckgo bing' },
  { id: 'searchShortcuts', section: 'search', label: 'Search Filter & Shortcuts', keywords: 'shortcuts filter bookmarks calculator math' },
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
      cards: JSON.parse(JSON.stringify(defaults.cards))
    };
  } else if (sectionId === 'clock') {
    label = 'Clock';
    patch = {
      showClock: defaults.showClock,
      showDate: defaults.showDate,
      showGreeting: defaults.showGreeting,
      timeFormat: defaults.timeFormat,
      clock: JSON.parse(JSON.stringify(defaults.clock))
    };
  } else if (sectionId === 'search') {
    label = 'Search';
    patch = {
      searchEngine: defaults.searchEngine,
      behavior: JSON.parse(JSON.stringify(defaults.behavior))
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
  clearChildren(drawerElement);

  const state = store.get();
  const settings = state.settings;

  // Header with stable ID for aria-labelledby, Cancel and Done buttons
  const header = el('header', { className: 'drawer-header' },
    el('div', { className: 'drawer-header-left' }, [
      el('h2', { className: 'drawer-title', id: 'settings-drawer-title', text: 'Customize Dashboard' })
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
      })
    ])
  );

  // Search box
  const searchWrapper = el('div', { className: 'drawer-search-wrapper' });
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
  searchWrapper.appendChild(searchInput);

  // Tab Nav (hidden if actively searching)
  const nav = el('nav', { className: 'drawer-nav', 'aria-label': 'Settings sections' });
  for (const tab of TABS) {
    const tabBtn = el('button', {
      className: `drawer-tab-btn${activeTab === tab.id ? ' active' : ''}`,
      type: 'button',
      text: tab.label,
      onclick: () => {
        activeTab = tab.id;
        searchQuery = '';
        renderDrawerContent();
      }
    });
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
      content.appendChild(renderAppearanceSection(settings));
    } else if (activeTab === 'layout') {
      content.appendChild(renderLayoutSection(settings));
    } else if (activeTab === 'spaces') {
      content.appendChild(renderSpacesSection(state));
    } else if (activeTab === 'clock') {
      content.appendChild(renderClockSection(settings));
    } else if (activeTab === 'search') {
      content.appendChild(renderSearchSection(settings));
    } else if (activeTab === 'categories') {
      content.appendChild(renderCategoriesSection(state.categories));
    } else if (activeTab === 'data') {
      content.appendChild(renderDataSection());
    }
  }

  drawerElement.appendChild(header);
  drawerElement.appendChild(searchWrapper);
  drawerElement.appendChild(nav);
  drawerElement.appendChild(content);
}

// --- Section Renderers ---

function renderAppearanceSection(settings) {
  const section = el('div', { className: 'settings-section' });

  // Theme cards
  const themeGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Theme' })
    ),
    el('div', { className: 'radio-group-cards' },
      renderRadioCard('System', settings.theme === 'system', () => {
        store.updateSettings({ theme: 'system' });
        renderDrawerContent();
      }),
      renderRadioCard('Light', settings.theme === 'light', () => {
        store.updateSettings({ theme: 'light' });
        renderDrawerContent();
      }),
      renderRadioCard('Dark', settings.theme === 'dark', () => {
        store.updateSettings({ theme: 'dark' });
        renderDrawerContent();
      })
    )
  );

  // Accent circles
  const accentPicker = el('div', { className: 'accent-picker' });
  for (const acc of ACCENTS) {
    const btn = el('button', {
      className: `accent-circle-btn${settings.accent === acc.id ? ' selected' : ''}`,
      type: 'button',
      style: { backgroundColor: acc.color },
      title: acc.name,
      'aria-label': `${acc.name} accent`,
      onclick: () => {
        store.updateSettings({ accent: acc.id });
        renderDrawerContent();
      }
    });
    accentPicker.appendChild(btn);
  }

  const accentGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Accent Color' })
    ),
    accentPicker
  );

  // Background Options
  const bgConfig = settings.background || { type: 'none', value: null, dim: 0.35 };

  const bgTypeGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Background Surface' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
      renderRadioCard('None', bgConfig.type === 'none', () => {
        store.updateSettings({ background: { ...bgConfig, type: 'none' } });
        renderDrawerContent();
      }),
      renderRadioCard('Solid', bgConfig.type === 'solid', () => {
        store.updateSettings({ background: { ...bgConfig, type: 'solid', value: SOLID_PRESETS[0].value } });
        renderDrawerContent();
      }),
      renderRadioCard('Gradient', bgConfig.type === 'gradient', () => {
        store.updateSettings({ background: { ...bgConfig, type: 'gradient', value: GRADIENT_PRESETS[0].value } });
        renderDrawerContent();
      }),
      renderRadioCard('Image', bgConfig.type === 'image', () => {
        store.updateSettings({ background: { ...bgConfig, type: 'image' } });
        renderDrawerContent();
      })
    )
  );

  // Specific Background Customizers
  const bgDetailGroup = el('div', { className: 'setting-item' });

  if (bgConfig.type === 'solid') {
    const presetPills = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    for (const preset of SOLID_PRESETS) {
      const pBtn = el('button', {
        className: 'btn-secondary',
        style: { fontSize: '11px', padding: '4px 8px' },
        type: 'button',
        text: preset.name,
        onclick: () => {
          store.updateSettings({ background: { ...bgConfig, value: preset.value } });
        }
      });
      presetPills.appendChild(pBtn);
    }
    bgDetailGroup.appendChild(el('span', { className: 'setting-desc', text: 'Subtle solid preset:' }));
    bgDetailGroup.appendChild(presetPills);
  } else if (bgConfig.type === 'gradient') {
    const gradPills = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    for (const preset of GRADIENT_PRESETS) {
      const gBtn = el('button', {
        className: 'btn-secondary',
        style: { fontSize: '11px', padding: '4px 8px' },
        type: 'button',
        text: preset.name,
        onclick: () => {
          store.updateSettings({ background: { ...bgConfig, value: preset.value } });
        }
      });
      gradPills.appendChild(gBtn);
    }
    bgDetailGroup.appendChild(el('span', { className: 'setting-desc', text: 'Subdued gradient preset:' }));
    bgDetailGroup.appendChild(gradPills);
  } else if (bgConfig.type === 'image') {
    const fileInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp',
      style: { display: 'none' }
    }));

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        showToast('Processing wallpaper...');
        const downscaledBlob = await downscaleImage(file, 2560);
        await saveBackgroundImage(downscaledBlob);
        store.updateSettings({ background: { ...bgConfig, type: 'image', value: 'custom_wallpaper', updatedAt: Date.now() } });
        showToast('Custom wallpaper applied!');
        renderDrawerContent();
      } catch (err) {
        showToast('Failed to process image');
      }
    });

    const uploadBtn = el('button', {
      className: 'btn-secondary',
      type: 'button',
      text: 'Upload Wallpaper Image',
      onclick: () => fileInput.click()
    });

    const clearImgBtn = el('button', {
      className: 'btn-secondary btn-danger',
      type: 'button',
      text: 'Remove Image',
      onclick: async () => {
        await deleteBackgroundImage();
        store.updateSettings({ background: { ...bgConfig, type: 'none', value: null } });
        showToast('Wallpaper removed');
        renderDrawerContent();
      }
    });

    // Dimming overlay slider
    const dimValue = typeof bgConfig.dim === 'number' ? bgConfig.dim : 0.35;
    const dimPercentSpan = el('span', { text: `${Math.round(dimValue * 100)}%`, style: { fontSize: '12px' } });

    const slider = /** @type {HTMLInputElement} */ (el('input', {
      type: 'range',
      min: '0',
      max: '0.8',
      step: '0.05',
      value: String(dimValue),
      style: { width: '100%' }
    }));

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      dimPercentSpan.textContent = `${Math.round(val * 100)}%`;
      store.updateSettings({ background: { ...bgConfig, dim: val } });
    });

    const sliderRow = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { className: 'setting-desc', text: 'Dimming Overlay (preserves contrast)' }),
        dimPercentSpan
      ),
      slider
    );

    bgDetailGroup.appendChild(fileInput);
    bgDetailGroup.appendChild(uploadBtn);
    bgDetailGroup.appendChild(sliderRow);
    bgDetailGroup.appendChild(clearImgBtn);
  }

  section.appendChild(themeGroup);
  section.appendChild(accentGroup);
  section.appendChild(bgTypeGroup);
  if (bgConfig.type !== 'none') {
    section.appendChild(bgDetailGroup);
  }

  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Appearance to Defaults',
    onclick: () => resetSettingsSection('appearance')
  }));

  return section;
}

function renderLayoutSection(settings) {
  const section = el('div', { className: 'settings-section' });

  const layoutGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Dashboard Grid Density' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('Standard Grid', settings.layout === 'grid', () => {
        store.updateSettings({ layout: 'grid' });
        renderDrawerContent();
      }),
      renderRadioCard('Compact', settings.layout === 'compact', () => {
        store.updateSettings({ layout: 'compact' });
        renderDrawerContent();
      })
    )
  );

  // 4.1 Card Style Cards
  const currentCardStyle = settings.cards?.style || 'filled';
  const cardStyleGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Card Style' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
      renderRadioCard('Filled', currentCardStyle === 'filled', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), style: 'filled' } });
        renderDrawerContent();
      }),
      renderRadioCard('Frosted', currentCardStyle === 'frosted', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), style: 'frosted' } });
        renderDrawerContent();
      }),
      renderRadioCard('Outline', currentCardStyle === 'outline', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), style: 'outline' } });
        renderDrawerContent();
      }),
      renderRadioCard('Minimal', currentCardStyle === 'minimal', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), style: 'minimal' } });
        renderDrawerContent();
      })
    )
  );

  // 4.1 Translucent Card Toggle
  const isTranslucent = Boolean(settings.cards?.translucent);
  const translucentRow = renderToggleRow(
    'Translucent Cards',
    'Subtle background blur behind cards',
    isTranslucent,
    (checked) => {
      store.updateSettings({ cards: { ...(settings.cards || {}), translucent: checked } });
      renderDrawerContent();
    }
  );

  // 4.1 Equal Height Toggle
  const isEqualHeight = settings.cards?.equalHeight !== false;
  const equalHeightRow = renderToggleRow(
    'Equal Height Cards',
    'Stretch cards to match row height',
    isEqualHeight,
    (checked) => {
      store.updateSettings({ cards: { ...(settings.cards || {}), equalHeight: checked } });
      renderDrawerContent();
    }
  );

  section.appendChild(layoutGroup);
  section.appendChild(cardStyleGroup);
  section.appendChild(translucentRow);
  section.appendChild(equalHeightRow);

  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Layout to Defaults',
    onclick: () => resetSettingsSection('layout')
  }));

  return section;
}

function renderClockSection(settings) {
  const section = el('div', { className: 'settings-section' });

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
  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Clock to Defaults',
    onclick: () => resetSettingsSection('clock')
  }));

  return section;
}

function renderSearchSection(settings) {
  const section = el('div', { className: 'settings-section' });

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

  const list = el('div', { className: 'cat-mgmt-list' });

  spaces.forEach((sp, idx) => {
    const colCount = (state.categories || []).filter(c => c.spaceId === sp.id).length;
    const isActive = sp.id === state.activeSpaceId;

    const info = el('div', { className: 'cat-mgmt-info' },
      el('span', { text: sp.icon || '📁' }),
      el('span', { text: sp.name, style: { fontWeight: '500' } }),
      el('span', { text: `(${colCount} collections)`, style: { color: 'var(--text-muted)' } }),
      isActive ? el('span', { className: 'search-result-section-badge', text: 'Active' }) : null
    );

    const upBtn = idx > 0 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      text: '↑',
      title: 'Move up',
      onclick: () => {
        store.reorderSpaces(idx, idx - 1);
        renderDrawerContent();
      }
    }) : null;

    const downBtn = idx < spaces.length - 1 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      text: '↓',
      title: 'Move down',
      onclick: () => {
        store.reorderSpaces(idx, idx + 1);
        renderDrawerContent();
      }
    }) : null;

    const editBtn = el('button', {
      className: 'icon-action-btn',
      type: 'button',
      text: '✎',
      title: 'Rename space',
      onclick: () => {
        openRenameSpaceDialog(sp);
      }
    });

    const deleteBtn = spaces.length > 1 ? el('button', {
      className: 'icon-action-btn delete',
      type: 'button',
      text: '✕',
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
    text: '+ Add New Space',
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

  const list = el('div', { className: 'cat-mgmt-list' });

  categories.forEach((cat, idx) => {
    const info = el('div', { className: 'cat-mgmt-info' },
      el('span', { text: cat.icon }),
      el('span', { text: cat.name, style: { fontWeight: '500' } }),
      el('span', { text: `(${cat.bookmarks.length})`, style: { color: 'var(--text-muted)' } })
    );

    const upBtn = idx > 0 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      text: '↑',
      title: 'Move up',
      onclick: () => {
        store.reorderCategories(idx, idx - 1);
        renderDrawerContent();
      }
    }) : null;

    const downBtn = idx < categories.length - 1 ? el('button', {
      className: 'icon-action-btn',
      type: 'button',
      text: '↓',
      title: 'Move down',
      onclick: () => {
        store.reorderCategories(idx, idx + 1);
        renderDrawerContent();
      }
    }) : null;

    const editBtn = el('button', {
      className: 'icon-action-btn',
      type: 'button',
      text: '✎',
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
    text: '+ Add New Collection',
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

function renderDataSection() {
  const section = el('div', { className: 'settings-section' });

  // Export JSON
  const exportBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Export Backup (JSON)',
    onclick: () => {
      exportDashboardToFile();
      showToast('Dashboard backup exported');
    }
  });

  // Import JSON, HTML, CSV with preview and undo
  const fileInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'file',
    accept: '.json,.html,.htm,.csv,application/json,text/html,text/csv',
    style: { display: 'none' }
  }));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseAndValidateBookmarksImport(text, 'auto');

      if (!result.success || !result.data || !result.summary) {
        showToast(`Import failed: ${result.error || 'Invalid file format'}`);
        return;
      }

      // Open pre-import preview modal
      openImportPreviewDialog({
        summary: result.summary,
        onConfirm: async () => {
          await createSnapshot('Before import', store.get());
          const preImportSnapshot = JSON.parse(JSON.stringify(store.get()));
          await store.replaceData(result.data, true);
          closeDrawer();

          showToast(`Restored ${result.summary.categoryCount} collections and ${result.summary.bookmarkCount} bookmarks`, () => {
            store.replaceData(preImportSnapshot, true);
            showToast('Restore undone');
          });
        }
      });
    } catch (err) {
      showToast('Unable to read import file');
    } finally {
      fileInput.value = '';
    }
  });

  const importBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Import File (JSON, HTML, CSV)',
    onclick: () => fileInput.click()
  });

  // Reset to Defaults with undo
  const resetBtn = el('button', {
    className: 'btn-secondary btn-danger',
    type: 'button',
    text: 'Reset to Defaults',
    onclick: () => {
      openConfirmDialog({
        title: 'Reset Dashboard?',
        message: 'This will reset all your collections, bookmarks, and settings back to default. Are you sure?',
        confirmText: 'Reset All',
        onConfirm: async () => {
          await createSnapshot('Before reset', store.get());
          const preResetSnapshot = JSON.parse(JSON.stringify(store.get()));
          await store.replaceData(createDefaultDashboardData(), true);
          closeDrawer();
          showToast('Dashboard reset to defaults', () => {
            store.replaceData(preResetSnapshot, true);
            showToast('Reset undone');
          });
        }
      });
    }
  });

  // Import from browser bookmarks (on-demand permission)
  const browserImportBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Import Browser Bookmarks',
    title: 'Imports bookmarks from your browser into collections',
    onclick: async () => {
      const { importFromBrowserBookmarks } = await import('../features/data-io.js');
      showToast('Requesting permission to access bookmarks...');
      const res = await importFromBrowserBookmarks();
      if (res.success) {
        showToast(`Imported ${res.count} bookmarks into collections!`);
        closeDrawer();
      } else {
        showToast(res.error || 'Could not import browser bookmarks');
      }
    }
  });

  section.appendChild(el('span', { className: 'setting-label', text: 'Backup & Restore' }));
  section.appendChild(exportBtn);
  section.appendChild(fileInput);
  section.appendChild(importBtn);
  section.appendChild(browserImportBtn);

  // --- Snapshots Section ---
  const snapshotsSection = el('div', { className: 'snapshots-section' });
  const snapshotsHeader = el('div', { className: 'setting-item' }, [
    el('span', { className: 'setting-label', text: 'Snapshots' }),
    el('span', { className: 'setting-hint', text: 'Automatic safety backups saved in browser database (up to 10 latest).' })
  ]);

  const snapshotListContainer = el('div', { className: 'snapshots-list' });

  async function refreshSnapshots() {
    clearChildren(snapshotListContainer);
    const snaps = await listSnapshots();
    if (!snaps || snaps.length === 0) {
      snapshotListContainer.appendChild(el('div', {
        className: 'snapshot-empty-hint',
        text: 'No snapshots saved yet.'
      }));
      return;
    }

    snaps.forEach(snap => {
      const dateFormatted = new Date(snap.createdAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const snapItem = el('div', { className: 'snapshot-item' }, [
        el('div', { className: 'snapshot-info' }, [
          el('div', { className: 'snapshot-meta' }, [
            el('span', { className: 'snapshot-reason', text: snap.reason || 'Snapshot' }),
            el('span', { className: 'snapshot-date', text: dateFormatted })
          ]),
          el('div', {
            className: 'snapshot-counts',
            text: `${snap.counts?.categories ?? 0} collections · ${snap.counts?.bookmarks ?? 0} bookmarks`
          })
        ]),
        el('div', { className: 'snapshot-actions' }, [
          el('button', {
            className: 'btn-secondary btn-sm',
            type: 'button',
            text: 'Restore',
            title: 'Restore this snapshot',
            onclick: () => {
              openConfirmDialog({
                title: 'Restore Snapshot?',
                message: `Restore snapshot from ${dateFormatted} (${snap.reason})? It contains ${snap.counts?.categories ?? 0} collections and ${snap.counts?.bookmarks ?? 0} bookmarks. Current data will be backed up before restore.`,
                confirmText: 'Restore',
                onConfirm: async () => {
                  const preRestore = JSON.parse(JSON.stringify(store.get()));
                  await restoreSnapshot(snap.id);
                  closeDrawer();
                  showToast(`Restored snapshot from ${dateFormatted}`, () => {
                    store.replaceData(preRestore, true);
                    showToast('Restore undone');
                  });
                }
              });
            }
          }),
          el('button', {
            className: 'btn-icon btn-sm btn-danger',
            type: 'button',
            text: '✕',
            title: 'Delete snapshot',
            onclick: async () => {
              await deleteSnapshot(snap.id);
              showToast('Snapshot deleted');
              await refreshSnapshots();
            }
          })
        ])
      ]);

      snapshotListContainer.appendChild(snapItem);
    });
  }

  const createSnapBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Create Snapshot',
    onclick: async () => {
      await createSnapshot('Manual snapshot');
      showToast('Snapshot created');
      await refreshSnapshots();
    }
  });

  refreshSnapshots().catch(() => {});

  snapshotsSection.appendChild(snapshotsHeader);
  snapshotsSection.appendChild(createSnapBtn);
  snapshotsSection.appendChild(snapshotListContainer);

  section.appendChild(snapshotsSection);
  section.appendChild(resetBtn);

  return section;
}

// --- Helper UI controls ---

function renderRadioCard(label, isActive, onClick) {
  return el('button', {
    className: `radio-card${isActive ? ' active' : ''}`,
    type: 'button',
    text: label,
    onclick: onClick
  });
}

function renderToggleRow(title, desc, isChecked, onChange) {
  const checkbox = /** @type {HTMLInputElement} */ (el('input', {
    type: 'checkbox',
    checked: isChecked
  }));

  checkbox.addEventListener('change', () => {
    onChange(checkbox.checked);
  });

  const slider = el('span', { className: 'toggle-slider' });
  const toggleLabel = el('label', { className: 'toggle-switch' }, checkbox, slider);

  const info = el('div', { style: { display: 'flex', flexDirection: 'column' } },
    el('span', { className: 'setting-label', text: title }),
    el('span', { className: 'setting-desc', text: desc })
  );

  return el('div', {
    className: 'setting-item-header',
    style: { padding: '4px 0' }
  }, info, toggleLabel);
}
