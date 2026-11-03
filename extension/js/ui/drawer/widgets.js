// @ts-check
import { store } from '../../core/state.js';
import { el } from '../../utils/dom.js';
import { showToast } from '../toasts.js';
import { fetchWeatherData } from '../../features/weather.js';
import { renderRadioCard, renderToggleRow } from './common.js';

const ICON_REFRESH = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`;

export function renderWidgetsSection(settings, { renderDrawerContent = () => {}, resetSettingsSection = () => {}, closeDrawer = () => {} } = {}) {
  const section = el('div', { className: 'settings-section' });

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Lightweight Widgets' }),
      el('p', { className: 'settings-section-subtitle', text: 'Toggle productivity tools: notes, to-do list, weather forecast, timer, and quote' })
    ]),
    el('button', {
      className: 'section-reset-btn',
      type: 'button',
      html: `${ICON_REFRESH}<span>Reset section</span>`,
      onclick: () => resetSettingsSection('widgets')
    })
  ]);
  section.appendChild(secHeader);
  const widgets = settings.widgets || { notes: false, todo: false };
  const weather = settings.weather || { enabled: false, city: '', lat: null, lon: null, unit: 'c' };
  const clockConf = settings.clock || {};
  const heroWidgets = settings.hero?.widgets || {};

  // 1. Live Interactive Desktop Editor Action Banner
  const editorCallout = el('div', {
    className: 'setting-item',
    style: {
      padding: '16px',
      borderRadius: '12px',
      background: 'var(--accent-tint, rgba(59, 130, 246, 0.1))',
      border: '1px solid var(--accent-base, #3b82f6)',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }
  },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', style: { fontSize: '15px', fontWeight: '600' }, text: 'Visual Desktop Editor' }),
      el('span', { className: 'setting-desc', text: 'Drag to position widgets freely on your wallpaper and use corner handles to make them small or big.' })
    ),
    el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      el('button', {
        className: 'btn-primary',
        type: 'button',
        style: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
        html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Open Live Desktop Editor</span>`,
        onclick: () => {
          closeDrawer();
          import('../features/edit-mode.js').then(m => m.setEditMode(true)).catch(() => {});
        }
      }),
      el('button', {
        className: 'btn-secondary',
        type: 'button',
        text: 'Reset Layout & Sizes',
        onclick: () => {
          const s = store.getState ? store.getState() : store.get();
          const cleanWidgets = {};
          const widgetKeys = ['clock', 'search', 'weather', 'tasks', 'notes', 'timer', 'speeddial', 'quote'];
          for (const k of widgetKeys) {
            cleanWidgets[k] = { x: null, y: null, w: null, h: null, hidden: s.hero?.widgets?.[k]?.hidden || false };
          }
          store.updateSettings({
            clock: { ...(s.clock || {}), style: 'hero', size: 'huge' },
            hero: { ...(s.hero || {}), widgets: cleanWidgets }
          });
          renderDrawerContent();
        }
      })
    )
  );
  section.appendChild(editorCallout);

  // Helper for sizing cards
  function renderSizeSelector(currentW, smallW, smallH, medW, medH, largeW, largeH, onSelect) {
    const isSmall = currentW && currentW <= (smallW + 35);
    const isLarge = currentW && currentW >= (largeW - 35);
    const isMed = !isSmall && !isLarge;

    return el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '8px', marginBottom: '8px' } },
      renderRadioCard('Small', isSmall, () => onSelect(smallW, smallH, 'small')),
      renderRadioCard('Medium', isMed, () => onSelect(medW, medH, 'medium')),
      renderRadioCard('Large', isLarge, () => onSelect(largeW, largeH, 'large'))
    );
  }

  // 2. Clock Widget Size & Formatting
  const currentClockSize = clockConf.size || (clockConf.style === 'small' ? 'small' : (clockConf.style === 'large' ? 'large' : (clockConf.style === 'medium' ? 'medium' : 'huge')));

  const clockGroup = el('div', { className: 'setting-item', style: { marginBottom: '20px' } },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Clock Size & Formatting' }),
      el('span', { className: 'setting-desc', text: 'Choose clock size (Small, Medium, Large, Huge) and display format' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '10px' } },
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
      renderRadioCard('Huge (Hero)', currentClockSize === 'huge' || currentClockSize === 'hero', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.clock = { ...(curHero.clock || {}), w: null, h: null };
        store.updateSettings({
          clock: { ...clockConf, style: 'hero', size: 'huge' },
          hero: { ...(settings.hero || {}), widgets: curHero }
        });
        renderDrawerContent();
      })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '8px' } },
      renderRadioCard('12-Hour (AM/PM)', settings.timeFormat === '12h', () => {
        store.updateSettings({ timeFormat: '12h' });
        renderDrawerContent();
      }),
      renderRadioCard('24-Hour', settings.timeFormat === '24h', () => {
        store.updateSettings({ timeFormat: '24h' });
        renderDrawerContent();
      })
    ),
    renderToggleRow('Show Seconds', 'Display running seconds counter', Boolean(clockConf.showSeconds), (val) => {
      store.updateSettings({ clock: { ...clockConf, showSeconds: val } });
      renderDrawerContent();
    }),
    renderToggleRow('Show Greeting', 'Show personalized greeting below clock', settings.showGreeting !== false, (val) => {
      store.updateSettings({ showGreeting: val });
      renderDrawerContent();
    }),
    renderToggleRow('Show Date', 'Show calendar date below clock', settings.showDate !== false, (val) => {
      store.updateSettings({ showDate: val });
      renderDrawerContent();
    })
  );
  section.appendChild(clockGroup);

  // 3. Search Bar Widget Size & Engine
  const currentSearchWidth = heroWidgets.search?.w;
  const searchSizeLabel = currentSearchWidth && currentSearchWidth <= 420 ? 'small' : (currentSearchWidth && currentSearchWidth >= 750 ? 'large' : 'medium');

  const searchEngineSelect = /** @type {HTMLSelectElement} */ (el('select', { className: 'form-select', style: { marginTop: '8px' } },
    el('option', { value: 'google', text: 'Google' }),
    el('option', { value: 'duckduckgo', text: 'DuckDuckGo' }),
    el('option', { value: 'brave', text: 'Brave Search' }),
    el('option', { value: 'bing', text: 'Bing' }),
    el('option', { value: 'ecosia', text: 'Ecosia' })
  ));
  searchEngineSelect.value = settings.searchEngine || 'google';
  searchEngineSelect.addEventListener('change', () => {
    store.updateSettings({ searchEngine: searchEngineSelect.value });
  });

  const searchGroup = el('div', { className: 'setting-item', style: { marginBottom: '20px' } },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Search Bar Size & Engine' }),
      el('span', { className: 'setting-desc', text: 'Select search bar width (Small, Medium, Wide) and default provider' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '8px' } },
      renderRadioCard('Small (Compact)', searchSizeLabel === 'small', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.search = { ...(curHero.search || {}), w: 380 };
        store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
        renderDrawerContent();
      }),
      renderRadioCard('Medium (Standard)', searchSizeLabel === 'medium', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.search = { ...(curHero.search || {}), w: 560 };
        store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
        renderDrawerContent();
      }),
      renderRadioCard('Large (Wide)', searchSizeLabel === 'large', () => {
        const curHero = { ...(settings.hero?.widgets || {}) };
        curHero.search = { ...(curHero.search || {}), w: 800 };
        store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
        renderDrawerContent();
      })
    ),
    el('div', { className: 'setting-item-header', style: { marginTop: '10px' } },
      el('span', { className: 'setting-label', style: { fontSize: '13px' }, text: 'Search Provider' })
    ),
    searchEngineSelect
  );
  section.appendChild(searchGroup);

  // 4. Weather Widget (Opt-in)
  const weatherToggleRow = renderToggleRow(
    'Weather Capsule',
    'Live local weather from Open-Meteo with offline caching. Zero tracking, zero API key.',
    Boolean(weather.enabled),
    (checked) => {
      store.updateSettings({
        weather: { ...weather, enabled: checked }
      });
      renderDrawerContent();
    }
  );
  section.appendChild(weatherToggleRow);

  if (weather.enabled) {
    const cityInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'form-input',
      placeholder: 'e.g. London or Tokyo (optional)',
      value: weather.city || ''
    }));
    cityInput.addEventListener('change', () => {
      const val = cityInput.value.trim();
      store.updateSettings({
        weather: { ...weather, city: val, lat: null, lon: null }
      });
    });

    const cityGroup = el('div', { className: 'setting-item', style: { marginBottom: '8px' } },
      el('div', { className: 'setting-item-header' },
        el('span', { className: 'setting-label', text: 'Location / City Name' }),
        el('span', { className: 'setting-desc', text: 'Geocoded via Open-Meteo or leave blank' })
      ),
      cityInput
    );
    section.appendChild(cityGroup);

    const unitSelect = /** @type {HTMLSelectElement} */ (el('select', { className: 'form-select' },
      el('option', { value: 'c', text: 'Celsius (°C)' }),
      el('option', { value: 'f', text: 'Fahrenheit (°F)' })
    ));
    unitSelect.value = weather.unit === 'f' ? 'f' : 'c';
    unitSelect.addEventListener('change', () => {
      store.updateSettings({
        weather: { ...weather, unit: unitSelect.value }
      });
    });

    const unitGroup = el('div', { className: 'setting-item', style: { marginBottom: '16px' } },
      el('div', { className: 'setting-item-header' },
        el('span', { className: 'setting-label', text: 'Temperature Unit' })
      ),
      unitSelect
    );
    section.appendChild(unitGroup);

    const privacyNotice = el('div', {
      className: 'setting-hint',
      style: {
        fontSize: '12px',
        lineHeight: '1.4',
        padding: '10px 14px',
        borderRadius: '8px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '16px',
        color: 'var(--text-muted, #94a3b8)'
      },
      text: 'Privacy Notice: Enabling weather transmits your chosen city coordinates directly to Open-Meteo (api.open-meteo.com) for temperature and forecast data. Results are cached locally for 30 minutes. No personal identity, IP, or browsing history is tracked or retained.'
    });
    section.appendChild(privacyNotice);
  }

  // 5. Notes Widget
  const notesSizeSelector = renderSizeSelector(
    heroWidgets.notes?.w,
    280, 180,
    380, 260,
    520, 360,
    (w, h) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.notes = { ...(curHero.notes || {}), w, h };
      store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
      renderDrawerContent();
    }
  );

  const notesToggleRow = renderToggleRow(
    'Notes Widget',
    'Plain-text scratchpad with automatic debounced saving',
    Boolean(widgets.notes),
    (checked) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.notes = { ...(curHero.notes || {}), hidden: !checked };
      store.updateSettings({
        widgets: { ...widgets, notes: checked },
        hero: { ...(settings.hero || {}), widgets: curHero }
      });
      renderDrawerContent();
    }
  );
  section.appendChild(notesToggleRow);
  if (widgets.notes) {
    section.appendChild(el('div', { className: 'setting-item', style: { marginBottom: '16px' } },
      el('div', { className: 'setting-item-header' }, el('span', { className: 'setting-label', text: 'Notes Card Size' })),
      notesSizeSelector
    ));
  }

  // 6. To-do / Tasks Widget
  const todoSizeSelector = renderSizeSelector(
    heroWidgets.tasks?.w,
    280, 200,
    380, 300,
    520, 420,
    (w, h) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.tasks = { ...(curHero.tasks || {}), w, h };
      store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
      renderDrawerContent();
    }
  );

  const todoToggleRow = renderToggleRow(
    'To-do / Tasks Widget',
    'Simple checklist for daily tasks and reminders',
    Boolean(widgets.todo),
    (checked) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.tasks = { ...(curHero.tasks || {}), hidden: !checked };
      store.updateSettings({
        widgets: { ...widgets, todo: checked },
        hero: { ...(settings.hero || {}), widgets: curHero }
      });
      renderDrawerContent();
    }
  );
  section.appendChild(todoToggleRow);
  if (widgets.todo) {
    section.appendChild(el('div', { className: 'setting-item', style: { marginBottom: '16px' } },
      el('div', { className: 'setting-item-header' }, el('span', { className: 'setting-label', text: 'To-do Card Size' })),
      todoSizeSelector
    ));
  }

  // 7. Focus / Pomodoro Timer Widget
  const timerSizeSelector = renderSizeSelector(
    heroWidgets.timer?.w,
    240, 130,
    320, 180,
    420, 240,
    (w, h) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.timer = { ...(curHero.timer || {}), w, h };
      store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
      renderDrawerContent();
    }
  );

  const timerToggleRow = renderToggleRow(
    'Focus / Pomodoro Timer',
    '25-minute focus and 5-minute break interval timer with visual alerts',
    Boolean(widgets.timer),
    (checked) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.timer = { ...(curHero.timer || {}), hidden: !checked };
      store.updateSettings({
        widgets: { ...widgets, timer: checked },
        hero: { ...(settings.hero || {}), widgets: curHero }
      });
      renderDrawerContent();
    }
  );
  section.appendChild(timerToggleRow);
  if (widgets.timer) {
    section.appendChild(el('div', { className: 'setting-item', style: { marginBottom: '16px' } },
      el('div', { className: 'setting-item-header' }, el('span', { className: 'setting-label', text: 'Timer Card Size' })),
      timerSizeSelector
    ));
  }

  // 8. Speed Dial Widget
  const speeddialSizeSelector = renderSizeSelector(
    heroWidgets.speeddial?.w,
    320, 140,
    480, 200,
    680, 280,
    (w, h) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.speeddial = { ...(curHero.speeddial || {}), w, h };
      store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
      renderDrawerContent();
    }
  );

  const speeddialToggleRow = renderToggleRow(
    'Speed Dial Strip',
    'Quick-access pill strip for your top apps and pinned sites',
    Boolean(widgets.speeddial),
    (checked) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.speeddial = { ...(curHero.speeddial || {}), hidden: !checked };
      store.updateSettings({
        widgets: { ...widgets, speeddial: checked },
        hero: { ...(settings.hero || {}), widgets: curHero }
      });
      renderDrawerContent();
    }
  );
  section.appendChild(speeddialToggleRow);
  if (widgets.speeddial) {
    section.appendChild(el('div', { className: 'setting-item', style: { marginBottom: '16px' } },
      el('div', { className: 'setting-item-header' }, el('span', { className: 'setting-label', text: 'Speed Dial Size' })),
      speeddialSizeSelector
    ));
  }

  // 9. Daily Focus & Quote Widget
  const quoteSizeSelector = renderSizeSelector(
    heroWidgets.quote?.w,
    280, 120,
    420, 160,
    580, 220,
    (w, h) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.quote = { ...(curHero.quote || {}), w, h };
      store.updateSettings({ hero: { ...(settings.hero || {}), widgets: curHero } });
      renderDrawerContent();
    }
  );

  const quoteToggleRow = renderToggleRow(
    'Daily Focus & Quote',
    'Curated daily inspiration and an editable priority goal for today',
    Boolean(widgets.quote),
    (checked) => {
      const curHero = { ...(settings.hero?.widgets || {}) };
      curHero.quote = { ...(curHero.quote || {}), hidden: !checked };
      store.updateSettings({
        widgets: { ...widgets, quote: checked },
        hero: { ...(settings.hero || {}), widgets: curHero }
      });
      renderDrawerContent();
    }
  );
  section.appendChild(quoteToggleRow);
  if (widgets.quote) {
    section.appendChild(el('div', { className: 'setting-item', style: { marginBottom: '16px' } },
      el('div', { className: 'setting-item-header' }, el('span', { className: 'setting-label', text: 'Quote Card Size' })),
      quoteSizeSelector
    ));
  }

  // Reset Widgets to Defaults
  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Widgets to Defaults',
    onclick: () => resetSettingsSection('widgets')
  }));

  return section;
}