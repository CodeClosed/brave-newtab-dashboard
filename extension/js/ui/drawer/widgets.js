// @ts-check
import { store } from '../../core/state.js';
import { el } from '../../utils/dom.js';
import { renderRadioCard, renderToggleRow, renderSectionHeader } from './common.js';
import { WIDGET_GRID_SPECS, GRID_CELL_WIDTH, GRID_CELL_HEIGHT, pxToPct } from '../../features/widget-drag.js';
import { findFreeSpot } from '../../features/home-editor.js';
import { focusWidgetInEditor, setReturnToMenuTab } from '../../features/edit-mode.js';

let widgetFilter = 'all'; // 'all' | 'active' | 'core' | 'pack'

function presetDims(key, sizeName) {
  const spec = WIDGET_GRID_SPECS[key];
  const preset = spec?.presets?.[sizeName];
  if (!preset) return null;
  return {
    w: preset[0] * GRID_CELL_WIDTH,
    h: preset[1] * GRID_CELL_HEIGHT
  };
}

function computeAutoSpotForWidget(heroKey, settings) {
  const curWidgets = settings?.hero?.widgets || {};
  const hasPinnedLayout = Object.values(curWidgets).some((c) => typeof c?.x === 'number' && typeof c?.y === 'number');
  if (!hasPinnedLayout || typeof document === 'undefined') return {};

  const heroPanel = document.getElementById('hero-panel');
  if (!heroPanel) return {};

  const spec = WIDGET_GRID_SPECS[heroKey] || { defaultCols: 6, defaultRows: 4, minW: 220, maxW: 800, minH: 120, maxH: 500 };
  const w = Math.max(spec.minW || 220, Math.min(spec.maxW || 800, (spec.defaultCols || 6) * GRID_CELL_WIDTH));
  const h = Math.max(spec.minH || 120, Math.min(spec.maxH || 500, (spec.defaultRows || 4) * GRID_CELL_HEIGHT));

  const p = heroPanel.getBoundingClientRect();
  if (p.width < 100 || p.height < 100) return {};

  const dock = settings?.dock?.position || 'off';
  const bounds = {
    left: 12 + (dock === 'left' ? 76 : 0),
    top: 12 + (dock === 'top' ? 76 : 0),
    right: p.width - 12 - (dock === 'right' ? 76 : 0),
    bottom: p.height - 12 - (dock === 'bottom' ? 76 : 0)
  };

  const selectors = {
    clock: '.dashboard-header', search: '.search-container', weather: '#hero-weather-slot',
    tasks: '#hero-tasks-slot', notes: '#hero-notes-slot', timer: '#hero-timer-slot',
    speeddial: '#hero-speeddial-slot', quote: '#hero-quote-slot', glance: '#hero-glance-slot',
    habits: '#hero-habits-slot', worldclock: '#hero-worldclock-slot', countdown: '#hero-countdown-slot',
    soundscapes: '#hero-soundscapes-slot', voicememo: '#hero-voicememo-slot', pulse: '#hero-pulse-slot',
    clipboard: '#hero-clipboard-slot', calculator: '#hero-calculator-slot', readlater: '#hero-readlater-slot'
  };

  const others = [];
  for (const [k, sel] of Object.entries(selectors)) {
    if (k === heroKey) continue;
    const node = heroPanel.querySelector(sel);
    if (!node || /** @type {HTMLElement} */ (node).hidden || /** @type {HTMLElement} */ (node).style.display === 'none') continue;
    const r = node.getBoundingClientRect();
    if (r.width >= 20 && r.height >= 10) {
      others.push({ left: r.left - p.left, top: r.top - p.top, width: r.width, height: r.height });
    }
  }

  const spot = findFreeSpot(
    { left: p.width / 2 - w / 2, top: p.height / 2 - h / 2, width: w, height: h },
    others,
    bounds
  );
  if (!spot) return { w, h };

  return {
    x: Math.round(pxToPct(spot.left + spot.width / 2, p.width) * 100) / 100,
    y: Math.round(pxToPct(spot.top + spot.height / 2, p.height) * 100) / 100,
    w: Math.round(spot.width),
    ...(spec.resizeMode === 'horizontal' ? {} : { h: Math.round(spot.height) })
  };
}

function renderSizePills(key, heroWidgetConf, settings, renderDrawerContent, closeDrawer) {
  const s = presetDims(key, 'S');
  const m = presetDims(key, 'M');
  const l = presetDims(key, 'L');
  if (!s || !m || !l) return null;

  const currentW = heroWidgetConf?.w;
  const isSmall = typeof currentW === 'number' && currentW <= s.w + 30;
  const isLarge = typeof currentW === 'number' && currentW >= l.w - 30;
  const isMed = !isSmall && !isLarge;

  const applySize = (dims) => {
    const curHero = { ...(settings.hero?.widgets || {}) };
    curHero[key] = {
      ...(curHero[key] || {}),
      w: dims.w,
      ...(WIDGET_GRID_SPECS[key]?.resizeMode === 'horizontal' ? {} : { h: dims.h })
    };
    store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
    renderDrawerContent();
  };

  return el('div', { className: 'widget-size-row' }, [
    el('div', { className: 'widget-size-group' }, [
      el('span', { className: 'widget-size-label', text: 'Size' }),
      el('div', { className: 'radio-group-cards widget-size-pills' }, [
        renderRadioCard('S', isSmall, () => applySize(s)),
        renderRadioCard('M', isMed, () => applySize(m)),
        renderRadioCard('L', isLarge, () => applySize(l))
      ])
    ]),
    el('button', {
      type: 'button',
      className: 'btn-secondary btn-sm widget-adjust-btn',
      text: 'Adjust on screen →',
      title: 'Open live editor with this widget selected',
      onclick: () => {
        closeDrawer(false);
        focusWidgetInEditor(key);
      }
    })
  ]);
}

export function renderWidgetsSection(settings, { renderDrawerContent = () => {}, resetSettingsSection = () => {}, closeDrawer = () => {} } = {}) {
  const section = el('div', { className: 'settings-section' });

  section.appendChild(renderSectionHeader(
    'Widgets',
    'Toggle widgets on your home screen, pick a size, or arrange them in the live editor',
    () => resetSettingsSection('widgets')
  ));

  const widgets = settings.widgets || { notes: false, todo: false };
  const weather = settings.weather || { enabled: false, city: '', lat: null, lon: null, unit: 'c' };
  const heroWidgets = settings.hero?.widgets || {};

  // 1. Live Interactive Desktop Editor Banner (Glass v2)
  const editorCallout = el('div', { className: 'setting-item widget-editor-banner' }, [
    el('div', { className: 'widget-editor-banner-copy' }, [
      el('span', { className: 'setting-label', text: 'Live Desktop Editor' }),
      el('span', { className: 'setting-desc', text: 'Drag widgets anywhere on your wallpaper and pull edges or corners to resize.' })
    ]),
    el('div', { className: 'widget-editor-banner-actions' }, [
      el('button', {
        className: 'btn-primary btn-sm',
        type: 'button',
        html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Open Live Editor</span>`,
        onclick: () => {
          closeDrawer(false);
          setReturnToMenuTab('widgets');
          import('../../features/edit-mode.js')
            .then((m) => m.setEditMode(true))
            .catch((err) => console.error('Failed to open widget editor', err));
        }
      }),
      el('button', {
        className: 'btn-secondary btn-sm',
        type: 'button',
        text: 'Reset Positions',
        onclick: () => {
          const s = store.getState ? store.getState() : store.get();
          const cleanWidgets = {};
          for (const k of Object.keys(WIDGET_GRID_SPECS)) {
            cleanWidgets[k] = { x: null, y: null, w: null, h: null, hidden: s.hero?.widgets?.[k]?.hidden || false };
          }
          store.updateSettings({
            clock: { ...(s.clock || {}), style: 'hero', size: 'huge' },
            hero: { ...(s.hero || {}), widgets: cleanWidgets }
          });
          renderDrawerContent();
        }
      })
    ])
  ]);
  section.appendChild(editorCallout);

  // Build unified catalog of widget entries
  const coreWidgets = [
    {
      key: 'weather',
      heroKey: 'weather',
      group: 'core',
      title: 'Weather Capsule',
      desc: 'Local conditions from Open-Meteo with offline caching',
      enabled: Boolean(weather.enabled),
      onToggle: (checked) => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        const existing = curHero.weather || {};
        const autoSpot = checked && typeof existing.x !== 'number' ? computeAutoSpotForWidget('weather', settings) : {};
        curHero.weather = { ...existing, ...autoSpot, hidden: !checked };
        store.updateSettings({
          weather: { ...weather, enabled: checked },
          hero: { ...(settings.hero || {}), widgets: curHero }
        });
        renderDrawerContent();
      },
      renderExtra: () => {
        const cityInput = /** @type {HTMLInputElement} */ (el('input', {
          type: 'text',
          className: 'form-input',
          placeholder: 'City (e.g. London, Tokyo)',
          value: weather.city || '',
          'aria-label': 'Weather city name'
        }));
        cityInput.addEventListener('change', () => {
          store.updateSettings({
            weather: { ...weather, city: cityInput.value.trim(), lat: null, lon: null }
          });
        });

        const unitSelect = /** @type {HTMLSelectElement} */ (el('select', {
          className: 'form-select',
          'aria-label': 'Temperature unit'
        },
          el('option', { value: 'c', text: '°C (Celsius)' }),
          el('option', { value: 'f', text: '°F (Fahrenheit)' })
        ));
        unitSelect.value = weather.unit === 'f' ? 'f' : 'c';
        unitSelect.addEventListener('change', () => {
          store.updateSettings({ weather: { ...weather, unit: unitSelect.value } });
        });

        return [
          el('div', { className: 'widget-weather-fields' }, [cityInput, unitSelect]),
          el('span', {
            className: 'setting-hint',
            text: 'Sends chosen city coordinates to api.open-meteo.com (cached 30 min locally, zero tracking).'
          })
        ];
      }
    },
    { key: 'timer', heroKey: 'timer', group: 'core', title: 'Focus Timer', desc: 'Pomodoro focus & break intervals with chime alerts' },
    { key: 'speeddial', heroKey: 'speeddial', group: 'core', title: 'Speed Dial', desc: 'Quick-access tiles for your top pinned sites' },
    { key: 'quote', heroKey: 'quote', group: 'core', title: 'Daily Focus & Quote', desc: 'Daily inspiration plus an editable priority goal' },
    { key: 'notes', heroKey: 'notes', group: 'core', title: 'Notes', desc: 'Plain-text scratchpad synced per space' },
    { key: 'todo', heroKey: 'tasks', group: 'core', title: 'To-do Tasks', desc: 'Lightweight checklist for daily reminders' }
  ];

  const packWidgets = [
    { key: 'glance', heroKey: 'glance', group: 'pack', title: 'At a Glance', desc: 'Day & year progress bars with your next task' },
    { key: 'habits', heroKey: 'habits', group: 'pack', title: 'Habit Grid', desc: '7-day habit tracker matrix with streak counts' },
    { key: 'worldclock', heroKey: 'worldclock', group: 'pack', title: 'World Clock', desc: 'Multi-timezone city cards with day/night badges' },
    { key: 'countdown', heroKey: 'countdown', group: 'pack', title: 'Countdowns', desc: 'Days remaining toward launches, trips, or exams' },
    { key: 'soundscapes', heroKey: 'soundscapes', group: 'pack', title: 'Soundscapes', desc: 'Offline ambient mixer: Rain, Brown Noise, Wind, Pad' },
    { key: 'voicememo', heroKey: 'voicememo', group: 'pack', title: 'Voice & Scratch', desc: 'Timestamped thought capture and mic dictation' },
    { key: 'pulse', heroKey: 'pulse', group: 'pack', title: 'Device Pulse', desc: 'Battery level, network speed, cores, and stats' },
    { key: 'clipboard', heroKey: 'clipboard', group: 'pack', title: 'Clipboard Pins', desc: 'One-click copy chips for snippets and hex colors' },
    { key: 'calculator', heroKey: 'calculator', group: 'pack', title: 'Calculator', desc: 'Quick math keypad and unit conversions' },
    { key: 'readlater', heroKey: 'readlater', group: 'pack', title: 'Reading Queue', desc: 'Save links and open tabs to read later' }
  ];

  const allToggleWidgets = [...coreWidgets, ...packWidgets].map((def) => {
    const enabled = def.enabled !== undefined ? def.enabled : Boolean(widgets[def.key]);
    return {
      ...def,
      enabled,
      onToggle: def.onToggle || ((checked) => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        const existing = curHero[def.heroKey] || {};
        const autoSpot = checked && typeof existing.x !== 'number' ? computeAutoSpotForWidget(def.heroKey, settings) : {};
        curHero[def.heroKey] = { ...existing, ...autoSpot, hidden: !checked };
        store.updateSettings({
          widgets: { ...widgets, [def.key]: checked },
          hero: { ...(settings.hero || {}), widgets: curHero }
        });
        renderDrawerContent();
      })
    };
  });

  const activeCount = allToggleWidgets.filter((w) => w.enabled).length + 1; // +1 for Search Bar

  // Filter Bar
  const filterTabs = [
    { id: 'all', label: `All (${allToggleWidgets.length + 1})` },
    { id: 'active', label: `Active (${activeCount})` },
    { id: 'core', label: 'Core' },
    { id: 'pack', label: 'Utility Pack' }
  ];

  const filterBar = el('div', { className: 'widget-filter-pills', role: 'tablist', 'aria-label': 'Filter widgets' },
    filterTabs.map((t) => el('button', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(widgetFilter === t.id),
      className: `widget-filter-pill${widgetFilter === t.id ? ' active' : ''}`,
      text: t.label,
      onclick: () => {
        widgetFilter = t.id;
        renderDrawerContent();
      }
    }))
  );
  section.appendChild(filterBar);

  // Search Bar Size Card (always active, shown under All / Active / Core)
  if (widgetFilter === 'all' || widgetFilter === 'active' || widgetFilter === 'core') {
    const searchSizeRow = renderSizePills('search', heroWidgets.search, settings, renderDrawerContent, closeDrawer);
    const searchCard = el('div', { className: 'setting-item widget-setting-card is-enabled' }, [
      el('div', { className: 'setting-item-header' }, [
        el('div', { className: 'setting-toggle-info' }, [
          el('span', { className: 'setting-label', text: 'Search Bar' }),
          el('span', { className: 'setting-desc', text: 'Adjust the width of the main search pill' })
        ]),
        el('span', { className: 'widget-active-badge', text: 'Always on' })
      ]),
      el('div', { className: 'widget-card-controls' }, [searchSizeRow])
    ]);
    section.appendChild(searchCard);
  }

  const filtered = allToggleWidgets.filter((w) => {
    if (widgetFilter === 'active') return w.enabled;
    if (widgetFilter === 'core') return w.group === 'core';
    if (widgetFilter === 'pack') return w.group === 'pack';
    return true;
  });

  if (filtered.length === 0) {
    section.appendChild(el('div', {
      className: 'snapshot-empty-hint',
      text: 'No widgets match this filter.'
    }));
    return section;
  }

  const grid = el('div', { className: 'widgets-settings-grid' });
  for (const def of filtered) {
    const card = el('div', {
      className: `setting-item widget-setting-card${def.enabled ? ' is-enabled' : ''}`
    });

    card.appendChild(renderToggleRow(def.title, def.desc, def.enabled, def.onToggle, { flat: true }));

    if (def.enabled) {
      const controls = el('div', { className: 'widget-card-controls' });
      const sizeRow = renderSizePills(def.heroKey, heroWidgets[def.heroKey], settings, renderDrawerContent, closeDrawer);
      if (sizeRow) controls.appendChild(sizeRow);
      if (typeof def.renderExtra === 'function') {
        for (const extraNode of def.renderExtra()) {
          if (extraNode) controls.appendChild(extraNode);
        }
      }
      card.appendChild(controls);
    }

    grid.appendChild(card);
  }
  section.appendChild(grid);

  return section;
}
