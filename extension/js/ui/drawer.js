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
import { renderWallpaperLibrary } from '../features/wallpaper.js';
import { isValidTimezone, getSupportedTimezones } from '../features/clock.js';

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
  { id: 'themeSchedule', section: 'appearance', label: 'Theme Schedule (Auto Light/Dark)', keywords: 'schedule auto light dark switch time hours appearance' },
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
      display: JSON.parse(JSON.stringify(defaults.display))
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

  // 4.5 Curated Theme Presets
  const presetsGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Curated Theme Presets' }),
      el('span', { className: 'setting-desc', text: 'One-click visual bundles with undo' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(5, 1fr)' } },
      ...THEME_PRESETS.map(preset => {
        const isSelected = settings.palette === preset.settings.palette &&
          settings.accent === preset.settings.accent &&
          settings.theme === preset.settings.theme;
        return renderRadioCard(preset.name, isSelected, () => {
          const res = applyThemePreset(preset.id, store);
          if (res.success) {
            renderDrawerContent();
            showToast(`Applied "${preset.name}" preset`, () => {
              if (res.undo) res.undo();
              renderDrawerContent();
              showToast('Preset undone');
            });
          }
        });
      })
    )
  );

  section.appendChild(presetsGroup);

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

  // 4.4 Palette selection
  const currentPalette = settings.palette || 'default';
  const paletteGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Color Palette' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
      renderRadioCard('Default', currentPalette === 'default', () => {
        store.updateSettings({ palette: 'default' });
        renderDrawerContent();
      }),
      renderRadioCard('AMOLED', currentPalette === 'amoled', () => {
        store.updateSettings({ palette: 'amoled' });
        renderDrawerContent();
      }),
      renderRadioCard('Paper', currentPalette === 'paper', () => {
        store.updateSettings({ palette: 'paper' });
        renderDrawerContent();
      }),
      renderRadioCard('Contrast', currentPalette === 'contrast', () => {
        store.updateSettings({ palette: 'contrast' });
        renderDrawerContent();
      })
    )
  );

  // Accent circles + Custom Accent
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
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

  // Custom accent circle trigger
  const isCustomAccent = settings.accent === 'custom';
  const customColorVal = settings.accentCustom || '#3b82f6';
  const customBtn = el('button', {
    className: `accent-circle-btn${isCustomAccent ? ' selected' : ''}`,
    type: 'button',
    style: { background: isCustomAccent ? customColorVal : 'conic-gradient(from 180deg, red, yellow, lime, aqua, blue, magenta, red)' },
    title: 'Custom accent color',
    'aria-label': 'Custom accent color',
    onclick: () => {
      store.updateSettings({ accent: 'custom', accentCustom: customColorVal });
      renderDrawerContent();
    }
  });
  accentPicker.appendChild(customBtn);

  let customAccentControls = null;
  if (isCustomAccent) {
    const contrastRes = validateAccentContrast(customColorVal, isDark);

    const colorPickerInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: customColorVal,
      style: { width: '32px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }
    }));

    const hexInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'inline-add-input',
      value: customColorVal,
      placeholder: '#3b82f6',
      style: { width: '90px', fontFamily: 'var(--font-mono)' },
      'aria-label': 'Custom accent hex code'
    }));

    const contrastBadge = el('span', {
      className: `search-result-section-badge${contrastRes.valid ? '' : ' danger'}`,
      text: contrastRes.valid ? `✓ WCAG AA (${contrastRes.ratio}:1)` : `⚠ Fails AA (${contrastRes.ratio}:1)`
    });

    const updateCustomColor = (newHex) => {
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(newHex)) {
        const bgHex = isDark
          ? (settings.palette === 'amoled' || settings.palette === 'contrast' ? '#0a0a0a' : '#1b1e22')
          : (settings.palette === 'paper' ? '#faf8f5' : '#ffffff');
        const val = validateAccentContrast(newHex, isDark, bgHex);
        if (!val.valid) {
          showToast(val.reason || 'Low contrast against background. Suggested accessible shade applied.');
          store.updateSettings({ accent: 'custom', accentCustom: val.suggestedHex || newHex });
        } else {
          store.updateSettings({ accent: 'custom', accentCustom: newHex });
        }
        renderDrawerContent();
      }
    };

    colorPickerInput.addEventListener('input', () => {
      hexInput.value = colorPickerInput.value;
    });

    colorPickerInput.addEventListener('change', () => {
      updateCustomColor(colorPickerInput.value);
    });

    hexInput.addEventListener('change', () => {
      updateCustomColor(hexInput.value.trim());
    });

    const customRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
      colorPickerInput,
      hexInput,
      contrastBadge
    );

    if (!contrastRes.valid && contrastRes.suggestedHex) {
      const fixBtn = el('button', {
        className: 'btn-secondary btn-sm',
        type: 'button',
        text: `Apply passing shade (${contrastRes.suggestedHex})`,
        onclick: () => {
          store.updateSettings({ accent: 'custom', accentCustom: contrastRes.suggestedHex });
          renderDrawerContent();
        }
      });
      customRow.appendChild(fixBtn);
    }

    customAccentControls = customRow;
  }

  const accentGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Accent Color' })
    ),
    accentPicker
  );
  if (customAccentControls) {
    accentGroup.appendChild(customAccentControls);
  }

  // 4.6 Theme Schedule (auto light/dark switch)
  const schedule = settings.themeSchedule || { enabled: false, mode: 'hours', lightFrom: '07:00', darkFrom: '19:00' };
  const scheduleToggleRow = renderToggleRow(
    'Theme Schedule',
    'Automatically switch between light and dark themes',
    Boolean(schedule.enabled),
    (checked) => {
      store.updateSettings({
        themeSchedule: { ...schedule, enabled: checked }
      });
      renderDrawerContent();
    }
  );

  const scheduleGroup = el('div', { className: 'setting-item' }, scheduleToggleRow);

  if (schedule.enabled) {
    const isSolar = schedule.mode === 'solar';
    const solarTimes = getSolarTimes();

    const modeSelector = el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '8px' } },
      renderRadioCard('Explicit Hours', !isSolar, () => {
        store.updateSettings({
          themeSchedule: { ...schedule, mode: 'hours' }
        });
        renderDrawerContent();
      }),
      renderRadioCard('Sunrise to Sunset', isSolar, () => {
        store.updateSettings({
          themeSchedule: { ...schedule, mode: 'solar' }
        });
        renderDrawerContent();
      })
    );
    scheduleGroup.appendChild(modeSelector);

    if (isSolar) {
      const solarInfo = el('div', {
        style: {
          marginTop: '8px',
          padding: '6px 10px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          background: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius-xs)',
          border: '1px solid var(--border-subtle)'
        },
        text: `☀️ Sunrise: ~${solarTimes.sunriseStr}  •  🌙 Sunset: ~${solarTimes.sunsetStr} (solar estimation from local date)`
      });
      scheduleGroup.appendChild(solarInfo);
    } else {
      const timeInputsRow = el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginTop: '8px',
          padding: '0 4px',
          flexWrap: 'wrap'
        }
      });

      const lightLabel = el('label', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-subtle)' }
      }, [
        el('span', { text: 'Light mode from:' }),
        (() => {
          const input = el('input', {
            type: 'time',
            className: 'input-time',
            value: schedule.lightFrom || '07:00',
            'aria-label': 'Light theme start time',
            style: { padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }
          });
          input.addEventListener('change', (e) => {
            const val = /** @type {HTMLInputElement} */ (e.target).value;
            if (val) {
              store.updateSettings({
                themeSchedule: { ...schedule, lightFrom: val }
              });
            }
          });
          return input;
        })()
      ]);

      const darkLabel = el('label', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-subtle)' }
      }, [
        el('span', { text: 'Dark mode from:' }),
        (() => {
          const input = el('input', {
            type: 'time',
            className: 'input-time',
            value: schedule.darkFrom || '19:00',
            'aria-label': 'Dark theme start time',
            style: { padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }
          });
          input.addEventListener('change', (e) => {
            const val = /** @type {HTMLInputElement} */ (e.target).value;
            if (val) {
              store.updateSettings({
                themeSchedule: { ...schedule, darkFrom: val }
              });
            }
          });
          return input;
        })()
      ]);

      timeInputsRow.appendChild(lightLabel);
      timeInputsRow.appendChild(darkLabel);
      scheduleGroup.appendChild(timeInputsRow);
    }
  }

  section.appendChild(themeGroup);
  section.appendChild(scheduleGroup);
  section.appendChild(paletteGroup);
  section.appendChild(accentGroup);

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
    const currentColor = typeof bgConfig.value === 'string' && validateSolidColor(bgConfig.value) ? bgConfig.value : '#1e293b';

    const colorPickerInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: currentColor,
      style: { width: '32px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }
    }));

    const hexInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'form-input',
      value: currentColor,
      placeholder: '#1e293b',
      style: { width: '100px', height: '32px', fontSize: '12px' }
    }));

    const updateColor = (val) => {
      const valid = validateSolidColor(val);
      if (valid) {
        colorPickerInput.value = valid;
        hexInput.value = valid;
        store.updateSettings({ background: { ...bgConfig, value: valid } });
      }
    };

    colorPickerInput.addEventListener('input', () => updateColor(colorPickerInput.value));
    hexInput.addEventListener('change', () => updateColor(hexInput.value));

    const pickerRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [
      colorPickerInput,
      hexInput,
      el('span', { className: 'setting-desc', text: 'Custom solid hex' })
    ]);

    const presetPills = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    for (const preset of SOLID_PRESETS) {
      const pBtn = el('button', {
        className: 'btn-secondary',
        style: { fontSize: '11px', padding: '4px 8px' },
        type: 'button',
        text: preset.name,
        onclick: () => updateColor(preset.value)
      });
      presetPills.appendChild(pBtn);
    }

    bgDetailGroup.appendChild(pickerRow);
    bgDetailGroup.appendChild(el('span', { className: 'setting-desc', text: 'Quick presets:' }));
    bgDetailGroup.appendChild(presetPills);
  } else if (bgConfig.type === 'gradient') {
    let gradConfig = { from: '#0f172a', to: '#1e293b', angle: 135 };
    if (typeof bgConfig.value === 'object' && bgConfig.value !== null) {
      const validated = validateGradientConfig(bgConfig.value);
      if (validated) gradConfig = validated;
    }

    const previewBar = el('div', {
      style: {
        height: '24px',
        borderRadius: 'var(--radius-xs)',
        background: formatGradientCss(gradConfig),
        marginBottom: '10px',
        border: '1px solid var(--border-subtle)'
      }
    });

    const updateGrad = (newConf) => {
      const valid = validateGradientConfig(newConf);
      if (valid) {
        gradConfig = valid;
        previewBar.style.background = formatGradientCss(valid);
        store.updateSettings({ background: { ...bgConfig, value: valid } });
      }
    };

    // Color stop 1
    const fromColor = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: gradConfig.from,
      style: { width: '28px', height: '28px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }
    }));
    const fromHex = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'form-input',
      value: gradConfig.from,
      style: { width: '80px', height: '28px', fontSize: '11px' }
    }));
    fromColor.addEventListener('input', () => {
      fromHex.value = fromColor.value;
      updateGrad({ ...gradConfig, from: fromColor.value });
    });
    fromHex.addEventListener('change', () => {
      const v = validateSolidColor(fromHex.value);
      if (v) {
        fromColor.value = v;
        updateGrad({ ...gradConfig, from: v });
      }
    });

    // Color stop 2
    const toColor = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: gradConfig.to,
      style: { width: '28px', height: '28px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }
    }));
    const toHex = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'form-input',
      value: gradConfig.to,
      style: { width: '80px', height: '28px', fontSize: '11px' }
    }));
    toColor.addEventListener('input', () => {
      toHex.value = toColor.value;
      updateGrad({ ...gradConfig, to: toColor.value });
    });
    toHex.addEventListener('change', () => {
      const v = validateSolidColor(toHex.value);
      if (v) {
        toColor.value = v;
        updateGrad({ ...gradConfig, to: v });
      }
    });

    // Angle slider
    const angleSpan = el('span', { text: `${gradConfig.angle}°`, style: { fontSize: '12px' } });
    const angleSlider = /** @type {HTMLInputElement} */ (el('input', {
      type: 'range',
      min: '0',
      max: '360',
      step: '5',
      value: String(gradConfig.angle),
      style: { width: '100%' }
    }));
    angleSlider.addEventListener('input', () => {
      const a = parseInt(angleSlider.value, 10);
      angleSpan.textContent = `${a}°`;
      updateGrad({ ...gradConfig, angle: a });
    });

    const stopsRow = el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' } }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
        el('span', { className: 'setting-desc', text: 'From:' }),
        fromColor,
        fromHex
      ]),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
        el('span', { className: 'setting-desc', text: 'To:' }),
        toColor,
        toHex
      ])
    ]);

    const angleRow = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
        el('span', { className: 'setting-desc', text: 'Angle' }),
        angleSpan
      ]),
      angleSlider
    ]);

    const gradPills = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    for (const preset of GRADIENT_PRESETS) {
      const gBtn = el('button', {
        className: 'btn-secondary',
        style: { fontSize: '11px', padding: '4px 8px' },
        type: 'button',
        text: preset.name,
        onclick: () => {
          store.updateSettings({ background: { ...bgConfig, value: preset.value } });
          renderDrawerContent();
        }
      });
      gradPills.appendChild(gBtn);
    }

    bgDetailGroup.appendChild(previewBar);
    bgDetailGroup.appendChild(stopsRow);
    bgDetailGroup.appendChild(angleRow);
    bgDetailGroup.appendChild(el('span', { className: 'setting-desc', text: 'Quick presets:' }));
    bgDetailGroup.appendChild(gradPills);
  } else if (bgConfig.type === 'image') {
    const libraryContainer = el('div', { className: 'wallpaper-library-container' });
    renderWallpaperLibrary(libraryContainer, store, {
      onRefresh: () => renderDrawerContent()
    });
    bgDetailGroup.appendChild(libraryContainer);

    // Auto-readability toggle
    const autoReadability = bgConfig.autoReadability !== false;
    const autoToggleLabel = el('label', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer', fontSize: '12px' }
    });
    const autoCheckbox = /** @type {HTMLInputElement} */ (el('input', {
      type: 'checkbox',
      checked: autoReadability
    }));
    autoCheckbox.addEventListener('change', () => {
      store.updateSettings({
        background: { ...bgConfig, autoReadability: autoCheckbox.checked }
      });
      renderDrawerContent();
    });
    autoToggleLabel.appendChild(autoCheckbox);
    autoToggleLabel.appendChild(el('span', { text: 'Auto-readability (adjusts dim from wallpaper brightness)' }));
    bgDetailGroup.appendChild(autoToggleLabel);

    // Dimming overlay slider
    const dimValue = typeof bgConfig.dim === 'number' ? bgConfig.dim : 0.35;
    const dimLabelText = autoReadability ? `Auto (${Math.round(dimValue * 100)}%)` : `${Math.round(dimValue * 100)}%`;
    const dimPercentSpan = el('span', { text: dimLabelText, style: { fontSize: '12px' } });

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
      store.updateSettings({ background: { ...bgConfig, autoReadability: false, dim: val } });
    });

    const sliderRow = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { className: 'setting-desc', text: 'Dimming Overlay (preserves contrast)' }),
        dimPercentSpan
      ),
      slider
    );

    // Blur slider (0..20px)
    const blurValue = typeof bgConfig.blur === 'number' ? bgConfig.blur : 0;
    const blurPxSpan = el('span', { text: `${blurValue}px`, style: { fontSize: '12px' } });
    const blurSlider = /** @type {HTMLInputElement} */ (el('input', {
      type: 'range',
      min: '0',
      max: '20',
      step: '1',
      value: String(blurValue),
      style: { width: '100%' }
    }));
    blurSlider.addEventListener('input', () => {
      const val = parseInt(blurSlider.value, 10);
      blurPxSpan.textContent = `${val}px`;
      store.updateSettings({ background: { ...bgConfig, blur: val } });
    });
    const blurRow = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { className: 'setting-desc', text: 'Wallpaper Blur' }),
        blurPxSpan
      ),
      blurSlider
    );

    bgDetailGroup.appendChild(sliderRow);
    bgDetailGroup.appendChild(blurRow);

    // Rotation mode (Off, Every Tab, Hourly, Daily)
    const rotationModes = [
      { id: 'off', label: 'Off' },
      { id: 'tab', label: 'Every Tab' },
      { id: 'hourly', label: 'Hourly' },
      { id: 'daily', label: 'Daily' }
    ];
    const currentRotation = bgConfig.rotation || 'off';
    const rotContainer = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' } });
    rotContainer.appendChild(el('span', { className: 'setting-desc', text: 'Wallpaper Rotation' }));
    const rotPills = el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } });
    for (const m of rotationModes) {
      rotPills.appendChild(renderRadioCard(m.label, currentRotation === m.id, () => {
        store.updateSettings({ background: { ...bgConfig, rotation: m.id } });
        renderDrawerContent();
      }));
    }
    rotContainer.appendChild(rotPills);
    bgDetailGroup.appendChild(rotContainer);

    const clearImgBtn = el('button', {
      className: 'btn-secondary btn-danger btn-sm',
      style: { marginTop: '12px' },
      type: 'button',
      text: 'Clear Wallpaper Image',
      onclick: () => {
        store.updateSettings({ background: { ...bgConfig, type: 'none', activeId: null } });
        showToast('Wallpaper cleared');
        renderDrawerContent();
      }
    });

    bgDetailGroup.appendChild(clearImgBtn);
  }

  section.appendChild(bgTypeGroup);
  if (bgConfig.type !== 'none') {
    section.appendChild(bgDetailGroup);
  }

  // 6.2 Typography: Font Family & Text Scale
  const fontConf = settings.font || { family: 'system', scale: 1.0 };
  const currentFamily = fontConf.family === 'sans' ? 'system' : (fontConf.family || 'system');
  const fontFamilyGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Font Family' }),
      el('span', { className: 'setting-desc', text: 'System-native fonts only, no remote webfonts' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
      renderRadioCard('System Sans', currentFamily === 'system', () => {
        store.updateSettings({ font: { ...fontConf, family: 'system' } });
        renderDrawerContent();
      }),
      renderRadioCard('Serif', currentFamily === 'serif', () => {
        store.updateSettings({ font: { ...fontConf, family: 'serif' } });
        renderDrawerContent();
      }),
      renderRadioCard('Monospace', currentFamily === 'mono', () => {
        store.updateSettings({ font: { ...fontConf, family: 'mono' } });
        renderDrawerContent();
      })
    )
  );

  const currentScale = typeof fontConf.scale === 'number' ? fontConf.scale : 1.0;
  const scalePercentSpan = el('span', { text: `${Math.round(currentScale * 100)}%`, style: { fontSize: '12px' } });
  const scaleSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '0.9',
    max: '1.3',
    step: '0.05',
    value: String(currentScale),
    style: { width: '100%' }
  }));
  scaleSlider.addEventListener('input', () => {
    const val = Math.round(parseFloat(scaleSlider.value) * 100) / 100;
    scalePercentSpan.textContent = `${Math.round(val * 100)}%`;
    store.updateSettings({ font: { ...fontConf, scale: val } });
  });

  const fontScaleGroup = el('div', { className: 'setting-item' },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
      el('span', { className: 'setting-label', text: 'Text Size Scale' }),
      scalePercentSpan
    ),
    scaleSlider
  );

  section.appendChild(fontFamilyGroup);
  section.appendChild(fontScaleGroup);

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

  // 4.2 Columns Controls (auto, 1..6)
  const currentCols = settings.cards?.columns ?? 'auto';
  const colsGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Columns' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(7, 1fr)' } },
      renderRadioCard('Auto', currentCols === 'auto', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), columns: 'auto' } });
        renderDrawerContent();
      }),
      ...[1, 2, 3, 4, 5, 6].map(num => renderRadioCard(String(num), currentCols === num, () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), columns: num } });
        renderDrawerContent();
      }))
    )
  );

  // 4.2 Card Width Slider & Presets
  const currentWidth = typeof settings.cards?.width === 'number' ? settings.cards.width : 340;
  const widthValSpan = el('span', { text: `${currentWidth}px`, style: { fontSize: '12px' } });
  const widthSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '200',
    max: '600',
    step: '10',
    value: String(currentWidth),
    style: { width: '100%' }
  }));
  widthSlider.addEventListener('input', () => {
    const val = parseInt(widthSlider.value, 10);
    widthValSpan.textContent = `${val}px`;
    store.updateSettings({ cards: { ...(settings.cards || {}), width: val } });
  });

  const widthPresetButtons = [
    { label: 'Compact (280px)', val: 280 },
    { label: 'Standard (340px)', val: 340 },
    { label: 'Spacious (420px)', val: 420 }
  ].map(p => el('button', {
    className: `btn-secondary btn-sm${currentWidth === p.val ? ' active' : ''}`,
    type: 'button',
    text: p.label,
    onclick: () => {
      store.updateSettings({ cards: { ...(settings.cards || {}), width: p.val } });
      renderDrawerContent();
    }
  }));

  const cardWidthGroup = el('div', { className: 'setting-item' },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
      el('span', { className: 'setting-label', text: 'Card Width' }),
      widthValSpan
    ),
    widthSlider,
    el('div', { style: { display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' } }, ...widthPresetButtons)
  );

  // 4.2 Gap Slider
  const currentGap = typeof settings.cards?.gap === 'number' ? settings.cards.gap : 16;
  const gapValSpan = el('span', { text: `${currentGap}px`, style: { fontSize: '12px' } });
  const gapSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '0',
    max: '48',
    step: '4',
    value: String(currentGap),
    style: { width: '100%' }
  }));
  gapSlider.addEventListener('input', () => {
    const val = parseInt(gapSlider.value, 10);
    gapValSpan.textContent = `${val}px`;
    store.updateSettings({ cards: { ...(settings.cards || {}), gap: val } });
  });

  const gapGroup = el('div', { className: 'setting-item' },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
      el('span', { className: 'setting-label', text: 'Card Gap' }),
      gapValSpan
    ),
    gapSlider
  );

  // 4.2 Alignment Controls
  const currentAlign = settings.cards?.align === 'left' ? 'left' : 'center';
  const alignGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Grid Alignment' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('Center', currentAlign === 'center', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), align: 'center' } });
        renderDrawerContent();
      }),
      renderRadioCard('Left', currentAlign === 'left', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), align: 'left' } });
        renderDrawerContent();
      })
    )
  );

  // 4.2 Vertical Centering Toggle
  const isVerticalCenter = Boolean(settings.cards?.verticalCenter);
  const verticalCenterRow = renderToggleRow(
    'Vertical Centering',
    'Center dashboard vertically on large displays',
    isVerticalCenter,
    (checked) => {
      store.updateSettings({ cards: { ...(settings.cards || {}), verticalCenter: checked } });
      renderDrawerContent();
    }
  );

  // 4.3 Default Bookmark Display Mode
  const currentMode = settings.display?.defaultMode || 'list';
  const displayModeGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Default Bookmark View' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
      renderRadioCard('List', currentMode === 'list', () => {
        store.updateSettings({ display: { ...(settings.display || {}), defaultMode: 'list' } });
        renderDrawerContent();
      }),
      renderRadioCard('Grid', currentMode === 'grid', () => {
        store.updateSettings({ display: { ...(settings.display || {}), defaultMode: 'grid' } });
        renderDrawerContent();
      }),
      renderRadioCard('Icons Only', currentMode === 'icons', () => {
        store.updateSettings({ display: { ...(settings.display || {}), defaultMode: 'icons' } });
        renderDrawerContent();
      })
    )
  );

  // 4.3 Tile Shape Controls
  const currentTileShape = settings.display?.tileShape || 'rounded';
  const tileShapeGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Tile Shape' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
      renderRadioCard('Rounded', currentTileShape === 'rounded', () => {
        store.updateSettings({ display: { ...(settings.display || {}), tileShape: 'rounded' } });
        renderDrawerContent();
      }),
      renderRadioCard('Square', currentTileShape === 'square', () => {
        store.updateSettings({ display: { ...(settings.display || {}), tileShape: 'square' } });
        renderDrawerContent();
      }),
      renderRadioCard('Circle', currentTileShape === 'circle', () => {
        store.updateSettings({ display: { ...(settings.display || {}), tileShape: 'circle' } });
        renderDrawerContent();
      })
    )
  );

  // 4.3 Density Controls
  const currentDensity = settings.display?.density || 'comfortable';
  const densityGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Bookmark Spacing' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('Comfortable', currentDensity === 'comfortable', () => {
        store.updateSettings({ display: { ...(settings.display || {}), density: 'comfortable' } });
        renderDrawerContent();
      }),
      renderRadioCard('Compact', currentDensity === 'compact', () => {
        store.updateSettings({ display: { ...(settings.display || {}), density: 'compact' } });
        renderDrawerContent();
      })
    )
  );

  // 4.3 Show Domains Toggle
  const showDomains = settings.display?.showDomains !== false;
  const showDomainsRow = renderToggleRow(
    'Show Website Domains',
    'Display clean hostname beneath bookmark titles in list view',
    showDomains,
    (checked) => {
      store.updateSettings({ display: { ...(settings.display || {}), showDomains: checked } });
      renderDrawerContent();
    }
  );

  // 4.3 Icon Size Slider
  const currentIconSize = typeof settings.display?.iconSize === 'number' ? settings.display.iconSize : 20;
  const iconSizeValSpan = el('span', { text: `${currentIconSize}px`, style: { fontSize: '12px' } });
  const iconSizeSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '16',
    max: '36',
    step: '2',
    value: String(currentIconSize),
    style: { width: '100%' }
  }));
  iconSizeSlider.addEventListener('input', () => {
    const val = parseInt(iconSizeSlider.value, 10);
    iconSizeValSpan.textContent = `${val}px`;
    store.updateSettings({ display: { ...(settings.display || {}), iconSize: val } });
  });

  const iconSizeGroup = el('div', { className: 'setting-item' },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
      el('span', { className: 'setting-label', text: 'Icon Size' }),
      iconSizeValSpan
    ),
    iconSizeSlider
  );

  section.appendChild(layoutGroup);
  section.appendChild(colsGroup);
  section.appendChild(cardWidthGroup);
  section.appendChild(gapGroup);
  section.appendChild(alignGroup);
  section.appendChild(cardStyleGroup);
  section.appendChild(displayModeGroup);
  section.appendChild(tileShapeGroup);
  section.appendChild(densityGroup);
  section.appendChild(iconSizeGroup);
  section.appendChild(showDomainsRow);
  section.appendChild(translucentRow);
  section.appendChild(equalHeightRow);
  section.appendChild(verticalCenterRow);

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
  const clockConf = settings.clock || {};

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

  // 6.1 Clock Style
  const currentClockStyle = clockConf.style === 'small' ? 'small' : (clockConf.style === 'left' || clockConf.style === 'left-aligned' ? 'left' : 'large');
  const clockStyleGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Clock Layout Style' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
      renderRadioCard('Large', currentClockStyle === 'large', () => {
        store.updateSettings({ clock: { ...clockConf, style: 'large' } });
        renderDrawerContent();
      }),
      renderRadioCard('Small', currentClockStyle === 'small', () => {
        store.updateSettings({ clock: { ...clockConf, style: 'small' } });
        renderDrawerContent();
      }),
      renderRadioCard('Left-aligned', currentClockStyle === 'left', () => {
        store.updateSettings({ clock: { ...clockConf, style: 'left' } });
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
