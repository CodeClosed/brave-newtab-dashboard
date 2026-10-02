// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { store } from '../core/state.js';
import { showToast } from './toasts.js';
import { exportDashboardToFile, parseAndValidateImport } from '../features/data-io.js';
import { openCategoryDialog, openConfirmDialog, openImportPreviewDialog } from './dialogs.js';
import { createDefaultDashboardData, validateDashboardData } from '../core/schema.js';
import { migrate } from '../core/migrate.js';
import { saveBackgroundImage, deleteBackgroundImage } from '../core/idb.js';
import { downscaleImage } from '../features/theme.js';

let drawerElement = null;
let backdropElement = null;
let activeTab = 'appearance';
let lastActiveElement = null;

const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'layout', label: 'Layout' },
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
 * Initializes and mounts drawer DOM elements if not already present.
 */
function ensureDrawerDOM() {
  if (drawerElement && document.body.contains(drawerElement)) return;

  backdropElement = el('div', {
    className: 'drawer-backdrop',
    onclick: closeDrawer
  });

  drawerElement = el('aside', {
    className: 'settings-drawer',
    'aria-label': 'Dashboard settings'
  });

  document.body.appendChild(backdropElement);
  document.body.appendChild(drawerElement);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerElement?.classList.contains('open')) {
      closeDrawer();
    }
  });
}

/**
 * Opens the settings drawer.
 * @param {string} [tab='appearance']
 */
export function openDrawer(tab = 'appearance') {
  ensureDrawerDOM();
  lastActiveElement = /** @type {HTMLElement} */ (document.activeElement);
  activeTab = tab;
  renderDrawerContent();

  backdropElement?.classList.add('open');
  drawerElement?.classList.add('open');

  const closeBtn = drawerElement?.querySelector('.drawer-close-btn');
  if (closeBtn && typeof closeBtn.focus === 'function') {
    closeBtn.focus();
  }
}

/**
 * Closes the settings drawer.
 */
export function closeDrawer() {
  backdropElement?.classList.remove('open');
  drawerElement?.classList.remove('open');
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
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

  // Header
  const header = el('header', { className: 'drawer-header' },
    el('h2', { className: 'drawer-title', text: 'Customize Dashboard' }),
    el('button', {
      className: 'drawer-close-btn',
      type: 'button',
      'aria-label': 'Close settings',
      text: '✕',
      onclick: closeDrawer
    })
  );

  // Tab Nav
  const nav = el('nav', { className: 'drawer-nav', 'aria-label': 'Settings sections' });
  for (const tab of TABS) {
    const tabBtn = el('button', {
      className: `drawer-tab-btn${activeTab === tab.id ? ' active' : ''}`,
      type: 'button',
      text: tab.label,
      onclick: () => {
        activeTab = tab.id;
        renderDrawerContent();
      }
    });
    nav.appendChild(tabBtn);
  }

  // Content Container
  const content = el('div', { className: 'drawer-content' });

  if (activeTab === 'appearance') {
    content.appendChild(renderAppearanceSection(settings));
  } else if (activeTab === 'layout') {
    content.appendChild(renderLayoutSection(settings));
  } else if (activeTab === 'clock') {
    content.appendChild(renderClockSection(settings));
  } else if (activeTab === 'search') {
    content.appendChild(renderSearchSection(settings));
  } else if (activeTab === 'categories') {
    content.appendChild(renderCategoriesSection(state.categories));
  } else if (activeTab === 'data') {
    content.appendChild(renderDataSection());
  }

  drawerElement.appendChild(header);
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
        store.updateSettings({ background: { ...bgConfig, type: 'image', value: 'custom_wallpaper' } });
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

  section.appendChild(layoutGroup);
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

  // Import JSON with preview and undo
  const fileInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'file',
    accept: '.json,application/json',
    style: { display: 'none' }
  }));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseAndValidateImport(text);

      if (!result.success || !result.data || !result.summary) {
        showToast(`Import failed: ${result.error || 'Invalid file format'}`);
        return;
      }

      // Open pre-import preview modal
      openImportPreviewDialog({
        summary: result.summary,
        onConfirm: async () => {
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
    text: 'Import Backup (JSON)',
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
