// @ts-check
import { store } from '../../core/state.js';
import { el } from '../../utils/dom.js';
import { showToast } from '../toasts.js';
import { renderRadioCard, renderToggleRow } from './common.js';

const ICON_REFRESH = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`;

export function renderLayoutSection(settings, { renderDrawerContent = () => {}, resetSettingsSection = () => {} } = {}) {
  const section = el('div', { className: 'settings-section' });

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Layout & Navigation' }),
      el('p', { className: 'settings-section-subtitle', text: 'Configure collection cards, grid columns, and the omnidirectional floating dock' })
    ]),
    el('button', {
      className: 'section-reset-btn',
      type: 'button',
      html: `${ICON_REFRESH}<span>Reset section</span>`,
      onclick: () => resetSettingsSection('layout')
    })
  ]);
  section.appendChild(secHeader);

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

  // 4.1 Card Style Cards
  const currentCardStyle = settings.cards?.style || 'filled';
  const cardStyleGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Card Style' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(5, 1fr)' } },
      renderRadioCard('Glass', currentCardStyle === 'glass', () => {
        store.updateSettings({ cards: { ...(settings.cards || {}), style: 'glass' } });
        renderDrawerContent();
      }),
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

  // 11.1 - 11.3 App Dock Settings
  const dockSettings = settings.dock || { position: 'top', autoHide: false, maxItems: 12 };
  const currentDockPos = dockSettings.position || 'top';
  const dockPosGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'App Dock Position' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(5, 1fr)' } },
      renderRadioCard('Top', currentDockPos === 'top', () => {
        store.updateSettings({ dock: { ...dockSettings, position: 'top' } });
        renderDrawerContent();
      }),
      renderRadioCard('Bottom', currentDockPos === 'bottom', () => {
        store.updateSettings({ dock: { ...dockSettings, position: 'bottom' } });
        renderDrawerContent();
      }),
      renderRadioCard('Left', currentDockPos === 'left', () => {
        store.updateSettings({ dock: { ...dockSettings, position: 'left' } });
        renderDrawerContent();
      }),
      renderRadioCard('Right', currentDockPos === 'right', () => {
        store.updateSettings({ dock: { ...dockSettings, position: 'right' } });
        renderDrawerContent();
      }),
      renderRadioCard('Off', currentDockPos === 'off', () => {
        store.updateSettings({ dock: { ...dockSettings, position: 'off' } });
        renderDrawerContent();
      })
    )
  );

  const dockAutoHideRow = renderToggleRow(
    'Dock Auto-Hide',
    'Reveal dock on screen edge hover or keyboard focus',
    Boolean(dockSettings.autoHide),
    (checked) => {
      store.updateSettings({ dock: { ...dockSettings, autoHide: checked } });
      renderDrawerContent();
    }
  );

  const currentMaxItems = typeof dockSettings.maxItems === 'number' ? dockSettings.maxItems : 12;
  const maxItemsValSpan = el('span', { text: `${currentMaxItems} items`, style: { fontSize: '12px' } });
  const maxItemsSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '4',
    max: '24',
    step: '1',
    value: String(currentMaxItems),
    style: { width: '100%' }
  }));
  maxItemsSlider.addEventListener('input', () => {
    const val = parseInt(maxItemsSlider.value, 10);
    maxItemsValSpan.textContent = `${val} items`;
    store.updateSettings({ dock: { ...dockSettings, maxItems: val } });
  });

  const maxItemsGroup = el('div', { className: 'setting-item' },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
      el('span', { className: 'setting-label', text: 'Max Pinned Items' }),
      maxItemsValSpan
    ),
    maxItemsSlider
  );

  // 12.5 Hub View Settings
  const hubSettings = settings.hub || { view: 'columns' };
  const currentHubView = hubSettings.view === 'tabs' ? 'tabs' : 'columns';
  const hubViewGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Collections Hub Layout' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
      renderRadioCard('Columns', currentHubView === 'columns', () => {
        store.updateSettings({ hub: { ...(settings.hub || {}), view: 'columns' } });
        renderDrawerContent();
      }),
      renderRadioCard('Tabbed Stack', currentHubView === 'tabs', () => {
        store.updateSettings({ hub: { ...(settings.hub || {}), view: 'tabs' } });
        renderDrawerContent();
      })
    )
  );

  section.appendChild(hubViewGroup);
  section.appendChild(dockPosGroup);
  section.appendChild(dockAutoHideRow);
  section.appendChild(maxItemsGroup);
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
