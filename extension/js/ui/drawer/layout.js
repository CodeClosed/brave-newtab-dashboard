// @ts-check
import { store } from '../../core/state.js';
import { el } from '../../utils/dom.js';
import { renderRadioCard, renderToggleRow, renderSliderRow, renderSectionHeader } from './common.js';

export function renderLayoutSection(settings, { renderDrawerContent = () => {}, resetSettingsSection = () => {} } = {}) {
  const section = el('div', { className: 'settings-section' });

  section.appendChild(renderSectionHeader(
    'App Dock',
    'Choose where your quick-launch dock floats and how many pinned apps it holds',
    () => resetSettingsSection('layout')
  ));

  // App Dock Settings
  const dockSettings = settings.dock || { position: 'top', autoHide: false, maxItems: 12 };
  const currentDockPos = dockSettings.position || 'top';
  const dockPosGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('div', { className: 'setting-toggle-info' },
        el('span', { className: 'setting-label', text: 'Dock Position' }),
        el('span', { className: 'setting-desc', text: 'Pin the floating dock to any edge or hide it' })
      )
    ),
    el('div', { className: 'radio-group-cards radio-group-5' },
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
    'Auto-hide Dock',
    'Tuck the dock near the screen edge until you hover or focus it',
    Boolean(dockSettings.autoHide),
    (checked) => {
      store.updateSettings({ dock: { ...dockSettings, autoHide: checked } });
      renderDrawerContent();
    }
  );

  const currentMaxItems = typeof dockSettings.maxItems === 'number' ? dockSettings.maxItems : 12;
  const maxItemsGroup = renderSliderRow({
    label: 'Max Pinned Apps',
    desc: 'Maximum shortcuts shown in the floating dock',
    valueText: `${currentMaxItems}`,
    min: 4,
    max: 24,
    step: 1,
    value: currentMaxItems,
    onInput: (val, badge) => {
      const n = Math.round(val);
      badge.textContent = `${n}`;
      store.updateSettings({ dock: { ...dockSettings, maxItems: n } });
    }
  });

  section.appendChild(dockPosGroup);
  section.appendChild(dockAutoHideRow);
  section.appendChild(maxItemsGroup);

  return section;
}
