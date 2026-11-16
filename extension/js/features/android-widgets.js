// @ts-check
/**
 * Android-Inspired Dashboard Widgets (Glass v2).
 *
 * Implements 10 Android / Pixel / Material You / Nothing OS style widgets
 * designed for the Home Screen Editor grid:
 *  1. glance      — At a Glance / Day Agenda (Pixel Launcher)
 *  2. habits      — Habit & Streak Grid (Material You / Nothing OS)
 *  3. worldclock  — World Clock Matrix (Pixel Clock)
 *  4. countdown   — Countdown & Milestone Card (One UI)
 *  5. soundscapes — Ambient Soundscapes Mixer (Pixel Sounds)
 *  6. voicememo   — Quick Thought & Voice Capture (Pixel Recorder)
 *  7. pulse       — Device & Browser Pulse (Android Device Care)
 *  8. clipboard   — Clipboard & Snippet Pinboard (Gboard Clipboard)
 *  9. calculator  — Quick Calculator & Unit Converter (Material You Calculator)
 * 10. readlater   — Read-Later & Tab Queue (Chrome Reading List)
 */
import { el } from '../utils/dom.js';
import { store } from '../core/state.js';
import { showToast } from '../ui/toasts.js';
import { createFaviconElement } from '../ui/favicons.js';
import { saveCurrentTabs } from './tab-groups.js';
import {
  ICON_CLOCK,
  ICON_PLUS,
  ICON_CLOSE,
  ICON_CHECK,
  ICON_TRASH,
  ICON_REFRESH,
  ICON_SUN,
  ICON_MOON,
  ICON_PLAY,
  ICON_PAUSE,
  ICON_EXTERNAL_LINK,
  ICON_SAVE_TABS,
  getIconSvg
} from '../ui/icons.js';

export const ANDROID_WIDGET_KEYS = [
  'glance',
  'habits',
  'worldclock',
  'countdown',
  'soundscapes',
  'voicememo',
  'pulse',
  'clipboard',
  'calculator',
  'readlater'
];

const ICON_CALENDAR = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>`;
const ICON_COPY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
const ICON_MIC = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
const ICON_WAVES = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path></svg>`;
const ICON_CALC = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><rect width="16" height="20" x="4" y="2" rx="2"></rect><line x1="8" x2="16" y1="6" y2="6"></line><line x1="16" x2="16" y1="14" y2="18"></line><path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path><path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path></svg>`;

/* ==========================================================================
   Shared Helpers
   ========================================================================== */

function readLocalJson(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch { /* ignore quota errors */ }
}

/**
 * Checks whether a widget should render or stay hidden, and prepares container.
 * @param {HTMLElement | null} container
 * @param {any} state
 * @param {string} key
 * @returns {boolean}
 */
function prepareSlot(container, state, key) {
  if (!container) return false;
  const isEnabled = Boolean(state?.settings?.widgets?.[key]);
  const isHiddenByHero = Boolean(state?.settings?.hero?.widgets?.[key]?.hidden);
  if (!isEnabled || isHiddenByHero) {
    container.hidden = true;
    container.style.display = 'none';
    return false;
  }
  container.hidden = false;
  if (!container.dataset?.freeDrag) {
    container.style.display = '';
  }
  return true;
}

/**
 * Mounts card into slot while preserving the Home Editor drag frame if active.
 * @param {HTMLElement} container
 * @param {HTMLElement} card
 */
function mountCard(container, card) {
  const existingFrame = container.querySelector ? container.querySelector('.widget-drag-frame') : null;
  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(card);
  } else {
    container.textContent = '';
    container.appendChild(card);
  }
  if (existingFrame) {
    container.appendChild(existingFrame);
  }
}

async function copyText(text, label = 'Copied to clipboard') {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast(label);
      return;
    }
  } catch { /* fallback below */ }
  showToast(label);
}

/* ==========================================================================
   1. At a Glance / Day Agenda (Pixel Launcher style)
   ========================================================================== */

export function getDayAndYearProgress(now = new Date()) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayPct = Math.max(0, Math.min(100, Math.round(((now.getTime() - startOfDay) / 86400000) * 100)));

  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const dayOfYear = Math.max(1, Math.ceil((now.getTime() - startOfYear) / 86400000));
  const totalDays = Math.round((endOfYear - startOfYear) / 86400000);
  const yearPct = Math.max(0, Math.min(100, Math.round(((now.getTime() - startOfYear) / (endOfYear - startOfYear)) * 100)));
  const weekNum = Math.max(1, Math.ceil(dayOfYear / 7));

  return { dayPct, yearPct, dayOfYear, totalDays, weekNum };
}

export function renderGlanceWidget(container, state) {
  if (!prepareSlot(container, state, 'glance')) return;

  const now = new Date();
  const { dayPct, yearPct, dayOfYear, totalDays, weekNum } = getDayAndYearProgress(now);
  const activeSpace = state?.spaces?.find((s) => s.id === state.activeSpaceId) || state?.spaces?.[0];
  const todos = Array.isArray(activeSpace?.todos) ? activeSpace.todos : [];
  const nextTodo = todos.find((t) => !t.done);
  const doneCount = todos.filter((t) => t.done).length;

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const card = el('div', { className: 'widget-card widget-glance' });
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${ICON_CALENDAR}<span>At a Glance</span>` }),
      el('span', { className: 'widget-space-badge', text: `${dateStr} · W${weekNum}` })
    ]),
    el('span', { className: 'widget-count-badge', text: `Day ${dayOfYear}/${totalDays}` })
  ]);

  const barsWrap = el('div', { className: 'aw-glance-bars' }, [
    el('div', { className: 'aw-glance-bar-row' }, [
      el('div', { className: 'aw-glance-bar-meta' }, [
        el('span', { text: 'Day elapsed' }),
        el('span', { className: 'aw-mono', text: `${dayPct}%` })
      ]),
      el('div', { className: 'aw-progress-track' }, [
        el('div', { className: 'aw-progress-fill', style: { width: `${dayPct}%` } })
      ])
    ]),
    el('div', { className: 'aw-glance-bar-row' }, [
      el('div', { className: 'aw-glance-bar-meta' }, [
        el('span', { text: 'Year progress' }),
        el('span', { className: 'aw-mono', text: `${yearPct}%` })
      ]),
      el('div', { className: 'aw-progress-track' }, [
        el('div', { className: 'aw-progress-fill is-secondary', style: { width: `${yearPct}%` } })
      ])
    ])
  ]);

  const agendaRow = el('div', { className: 'aw-glance-agenda' });
  if (nextTodo && activeSpace) {
    const checkBtn = el('button', {
      type: 'button',
      className: 'aw-glance-check',
      title: 'Mark task complete',
      'aria-label': 'Mark task complete',
      html: ICON_CHECK,
      onclick: () => {
        store.toggleTodo(activeSpace.id, nextTodo.id);
        showToast('Task completed');
      }
    });
    agendaRow.appendChild(checkBtn);
    agendaRow.appendChild(el('div', { className: 'aw-glance-task-info' }, [
      el('span', { className: 'aw-glance-task-label', text: 'UP NEXT' }),
      el('span', { className: 'aw-glance-task-text', text: nextTodo.text })
    ]));
    agendaRow.appendChild(el('span', { className: 'widget-count-badge', text: `${doneCount}/${todos.length}` }));
  } else {
    const quickInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'aw-inline-input',
      placeholder: todos.length > 0 ? 'All tasks done! Add next task...' : 'Add a focus task for today...',
      'aria-label': 'Quick add task'
    }));
    const addBtn = el('button', {
      type: 'button',
      className: 'btn-quiet btn-sm',
      html: `${ICON_PLUS}<span>Add</span>`,
      onclick: () => {
        const val = quickInput.value.trim();
        if (!val || !activeSpace) return;
        store.addTodo(activeSpace.id, val);
        quickInput.value = '';
      }
    });
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    });
    agendaRow.appendChild(quickInput);
    agendaRow.appendChild(addBtn);
  }

  card.appendChild(header);
  card.appendChild(barsWrap);
  card.appendChild(agendaRow);
  mountCard(container, card);
}

/* ==========================================================================
   2. Habit & Streak Grid (Material You / Nothing OS style)
   ========================================================================== */

const HABITS_STORAGE_KEY = 'ntd_habits_v1';
const DEFAULT_HABITS = [
  { id: 'h_deep', name: 'Deep Work', days: {} },
  { id: 'h_read', name: 'Read 20m', days: {} },
  { id: 'h_water', name: 'Hydrate', days: {} }
];

function getLast7DateKeys(now = new Date()) {
  const keys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const label = d.toLocaleDateString(undefined, { weekday: 'narrow' });
    keys.push({ key: `${yyyy}-${mm}-${dd}`, label, isToday: i === 0 });
  }
  return keys;
}

export function computeHabitStreak(daysMap = {}, dateKeys = getLast7DateKeys()) {
  let streak = 0;
  for (let i = dateKeys.length - 1; i >= 0; i--) {
    const k = dateKeys[i].key;
    if (daysMap[k]) {
      streak++;
    } else if (!dateKeys[i].isToday) {
      break;
    }
  }
  return streak;
}

export function renderHabitsWidget(container, state) {
  if (!prepareSlot(container, state, 'habits')) return;

  const habits = readLocalJson(HABITS_STORAGE_KEY, DEFAULT_HABITS);
  const dateKeys = getLast7DateKeys();
  const todayKey = dateKeys[dateKeys.length - 1].key;
  const doneToday = habits.filter((h) => h.days?.[todayKey]).length;

  const card = el('div', { className: 'widget-card widget-habits' });
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${getIconSvg('flame', 14)}<span>Habit Grid</span>` }),
      el('span', { className: 'widget-space-badge', text: `${doneToday}/${habits.length} today` })
    ])
  ]);

  const list = el('div', { className: 'aw-habits-list' });
  habits.forEach((habit) => {
    const streak = computeHabitStreak(habit.days || {}, dateKeys);
    const dots = el('div', { className: 'aw-habit-dots' });
    dateKeys.forEach((d) => {
      const active = Boolean(habit.days?.[d.key]);
      const dotBtn = el('button', {
        type: 'button',
        className: `aw-habit-dot${active ? ' is-done' : ''}${d.isToday ? ' is-today' : ''}`,
        title: `${habit.name} · ${d.key}`,
        'aria-label': `Toggle ${habit.name} for ${d.key}`,
        text: d.label,
        onclick: () => {
          habit.days = habit.days || {};
          habit.days[d.key] = !habit.days[d.key];
          writeLocalJson(HABITS_STORAGE_KEY, habits);
          renderHabitsWidget(container, state);
        }
      });
      dots.appendChild(dotBtn);
    });

    const delBtn = el('button', {
      type: 'button',
      className: 'btn-quiet btn-icon-only aw-row-del',
      title: 'Delete habit',
      'aria-label': `Delete ${habit.name}`,
      html: ICON_CLOSE,
      onclick: () => {
        const next = habits.filter((x) => x.id !== habit.id);
        writeLocalJson(HABITS_STORAGE_KEY, next);
        renderHabitsWidget(container, state);
      }
    });

    const row = el('div', { className: 'aw-habit-row' }, [
      el('span', { className: 'aw-habit-name', text: habit.name }),
      dots,
      el('span', { className: 'aw-habit-streak aw-mono', text: `${streak}d` }),
      delBtn
    ]);
    list.appendChild(row);
  });

  const input = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'aw-inline-input',
    placeholder: 'New daily habit...',
    'aria-label': 'New habit name'
  }));
  const addBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: `${ICON_PLUS}<span>Add</span>`,
    onclick: () => {
      const name = input.value.trim();
      if (!name) return;
      habits.push({ id: 'h_' + Date.now().toString(36), name, days: {} });
      writeLocalJson(HABITS_STORAGE_KEY, habits);
      renderHabitsWidget(container, state);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBtn.click();
    }
  });

  const formRow = el('div', { className: 'aw-inline-form' }, [input, addBtn]);
  card.appendChild(header);
  card.appendChild(list);
  card.appendChild(formRow);
  mountCard(container, card);
}

/* ==========================================================================
   3. World Clock Matrix (Pixel Clock style)
   ========================================================================== */

const WORLDCLOCK_STORAGE_KEY = 'ntd_worldclocks_v1';
export const WORLD_CITIES = [
  { id: 'utc', city: 'UTC', tz: 'UTC' },
  { id: 'sfo', city: 'San Francisco', tz: 'America/Los_Angeles' },
  { id: 'nyc', city: 'New York', tz: 'America/New_York' },
  { id: 'lon', city: 'London', tz: 'Europe/London' },
  { id: 'par', city: 'Paris', tz: 'Europe/Paris' },
  { id: 'ber', city: 'Berlin', tz: 'Europe/Berlin' },
  { id: 'dxb', city: 'Dubai', tz: 'Asia/Dubai' },
  { id: 'bom', city: 'Mumbai', tz: 'Asia/Kolkata' },
  { id: 'sin', city: 'Singapore', tz: 'Asia/Singapore' },
  { id: 'hkg', city: 'Hong Kong', tz: 'Asia/Hong_Kong' },
  { id: 'icn', city: 'Seoul', tz: 'Asia/Seoul' },
  { id: 'tyo', city: 'Tokyo', tz: 'Asia/Tokyo' },
  { id: 'syd', city: 'Sydney', tz: 'Australia/Sydney' }
];
const DEFAULT_WORLD_CITIES = ['nyc', 'lon', 'tyo', 'syd'];

function formatCityTime(tz, use24h = false, now = new Date()) {
  try {
    const timeStr = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24h
    }).format(now);

    const hour24 = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false
      }).format(now)
    );
    const isDay = hour24 >= 6 && hour24 < 18;

    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const localDate = new Date(now.toLocaleString('en-US'));
    const diffHours = Math.round(((tzDate.getTime() - localDate.getTime()) / 3600000) * 2) / 2;
    const offsetStr = diffHours === 0 ? 'Local' : (diffHours > 0 ? `+${diffHours}h` : `${diffHours}h`);

    return { timeStr, isDay, offsetStr };
  } catch {
    return { timeStr: '--:--', isDay: true, offsetStr: '' };
  }
}

export function renderWorldClockWidget(container, state) {
  if (!prepareSlot(container, state, 'worldclock')) return;

  const selectedIds = readLocalJson(WORLDCLOCK_STORAGE_KEY, DEFAULT_WORLD_CITIES);
  const use24h = state?.settings?.timeFormat === '24h';
  const now = new Date();

  const card = el('div', { className: 'widget-card widget-worldclock' });

  const citySelect = /** @type {HTMLSelectElement} */ (el('select', {
    className: 'aw-mini-select',
    'aria-label': 'Add city to World Clock'
  }, [
    el('option', { value: '', text: '+ City' }),
    ...WORLD_CITIES.filter((c) => !selectedIds.includes(c.id)).map((c) =>
      el('option', { value: c.id, text: c.city })
    )
  ]));
  citySelect.addEventListener('change', () => {
    const val = citySelect.value;
    if (!val) return;
    const next = [...selectedIds, val];
    writeLocalJson(WORLDCLOCK_STORAGE_KEY, next);
    renderWorldClockWidget(container, state);
  });

  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${getIconSvg('globe', 14)}<span>World Clock</span>` })
    ]),
    citySelect
  ]);

  const grid = el('div', { className: 'aw-worldclock-grid' });
  selectedIds.forEach((id) => {
    const entry = WORLD_CITIES.find((c) => c.id === id) || { id, city: id, tz: 'UTC' };
    const { timeStr, isDay, offsetStr } = formatCityTime(entry.tz, use24h, now);
    const removeBtn = el('button', {
      type: 'button',
      className: 'aw-wc-remove',
      title: `Remove ${entry.city}`,
      'aria-label': `Remove ${entry.city}`,
      html: ICON_CLOSE,
      onclick: () => {
        const next = selectedIds.filter((x) => x !== id);
        writeLocalJson(WORLDCLOCK_STORAGE_KEY, next);
        renderWorldClockWidget(container, state);
      }
    });

    const cell = el('div', { className: 'aw-wc-card' }, [
      el('div', { className: 'aw-wc-top' }, [
        el('span', { className: 'aw-wc-city', text: entry.city }),
        el('span', { className: 'aw-wc-offset', html: `${isDay ? ICON_SUN : ICON_MOON}<span>${offsetStr}</span>` }),
        removeBtn
      ]),
      el('div', { className: 'aw-wc-time aw-mono', text: timeStr })
    ]);
    grid.appendChild(cell);
  });

  card.appendChild(header);
  card.appendChild(grid);
  mountCard(container, card);
}

/* ==========================================================================
   4. Countdown & Milestone Card (One UI style)
   ========================================================================== */

const COUNTDOWN_STORAGE_KEY = 'ntd_countdowns_v1';

function getDefaultCountdowns() {
  const nextMonth = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  return [
    { id: 'cd_default', title: 'Next Milestone', targetDate: nextMonth, createdAt: Date.now() - 7 * 86400000 }
  ];
}

export function computeDaysRemaining(targetDateStr, now = new Date()) {
  const target = new Date(`${targetDateStr}T23:59:59`);
  if (isNaN(target.getTime())) return { days: 0, label: 'Invalid', past: false };
  const diffMs = target.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86400000);
  if (days > 1) return { days, label: `${days} days left`, past: false };
  if (days === 1) return { days: 1, label: 'Tomorrow', past: false };
  if (days === 0) return { days: 0, label: 'Today!', past: false };
  return { days, label: `${Math.abs(days)}d ago`, past: true };
}

export function renderCountdownWidget(container, state) {
  if (!prepareSlot(container, state, 'countdown')) return;

  const items = readLocalJson(COUNTDOWN_STORAGE_KEY, getDefaultCountdowns());
  const now = new Date();

  const card = el('div', { className: 'widget-card widget-countdown' });
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${getIconSvg('rocket', 14)}<span>Countdowns</span>` }),
      el('span', { className: 'widget-count-badge', text: `${items.length} active` })
    ])
  ]);

  const list = el('div', { className: 'aw-countdown-list' });
  items.forEach((item) => {
    const { label, past } = computeDaysRemaining(item.targetDate, now);
    const startMs = item.createdAt || (now.getTime() - 30 * 86400000);
    const endMs = new Date(`${item.targetDate}T23:59:59`).getTime();
    const pct = endMs > startMs
      ? Math.max(5, Math.min(100, Math.round(((now.getTime() - startMs) / (endMs - startMs)) * 100)))
      : 100;

    const delBtn = el('button', {
      type: 'button',
      className: 'btn-quiet btn-icon-only aw-row-del',
      title: 'Remove countdown',
      html: ICON_CLOSE,
      onclick: () => {
        const next = items.filter((x) => x.id !== item.id);
        writeLocalJson(COUNTDOWN_STORAGE_KEY, next);
        renderCountdownWidget(container, state);
      }
    });

    const row = el('div', { className: 'aw-countdown-item' }, [
      el('div', { className: 'aw-countdown-top' }, [
        el('span', { className: 'aw-countdown-title', text: item.title }),
        el('span', { className: `aw-countdown-badge${past ? ' is-past' : ''}`, text: label }),
        delBtn
      ]),
      el('div', { className: 'aw-progress-track' }, [
        el('div', { className: 'aw-progress-fill', style: { width: `${pct}%` } })
      ]),
      el('span', { className: 'aw-countdown-date', text: `Target: ${item.targetDate}` })
    ]);
    list.appendChild(row);
  });

  const titleInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'aw-inline-input',
    placeholder: 'Event name...',
    'aria-label': 'Countdown event title'
  }));
  const dateInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'date',
    className: 'aw-inline-date',
    value: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    'aria-label': 'Target date'
  }));
  const addBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: ICON_PLUS,
    title: 'Add countdown',
    onclick: () => {
      const title = titleInput.value.trim();
      const targetDate = dateInput.value;
      if (!title || !targetDate) return;
      items.push({ id: 'cd_' + Date.now().toString(36), title, targetDate, createdAt: Date.now() });
      writeLocalJson(COUNTDOWN_STORAGE_KEY, items);
      renderCountdownWidget(container, state);
    }
  });

  const formRow = el('div', { className: 'aw-inline-form' }, [titleInput, dateInput, addBtn]);
  card.appendChild(header);
  card.appendChild(list);
  card.appendChild(formRow);
  mountCard(container, card);
}

/* ==========================================================================
   5. Ambient Soundscapes Mixer (100% Offline Web Audio Synthesizer)
   ========================================================================== */

const SOUNDSCAPE_CHANNELS = [
  { id: 'rain', label: 'Soft Rain', desc: 'Filtered rainfall' },
  { id: 'brown', label: 'Brown Noise', desc: 'Deep focus rumble' },
  { id: 'wind', label: 'Forest Wind', desc: 'Warm sweeping breeze' },
  { id: 'drone', label: 'Warm Pad', desc: 'Calm harmonic drone' }
];

let audioCtx = null;
let masterGain = null;
let masterVolume = 0.45;
/** @type {Record<string, { stop: () => void }>} */
const activeNodes = {};

function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window['webkitAudioContext']) : null;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

function startChannel(id) {
  if (activeNodes[id]) return;
  const ctx = ensureAudioContext();
  if (!ctx || !masterGain) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const chGain = ctx.createGain();
  chGain.gain.value = 0.35;
  chGain.connect(masterGain);

  if (id === 'drone') {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.value = 110; // A2
    osc2.frequency.value = 164.81; // E3
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(chGain);
    osc1.start();
    osc2.start();
    activeNodes[id] = {
      stop: () => {
        try { osc1.stop(); osc2.stop(); chGain.disconnect(); } catch { /* ignore */ }
      }
    };
    return;
  }

  // Procedural noise buffer (2 seconds looped)
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (id === 'brown') {
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.2;
    } else {
      data[i] = white * 0.45;
    }
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  if (id === 'rain') {
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;
  } else if (id === 'wind') {
    filter.type = 'bandpass';
    filter.frequency.value = 380;
    filter.Q.value = 2.5;
  } else {
    filter.type = 'lowpass';
    filter.frequency.value = 480;
  }

  noise.connect(filter);
  filter.connect(chGain);
  noise.start();
  activeNodes[id] = {
    stop: () => {
      try { noise.stop(); chGain.disconnect(); } catch { /* ignore */ }
    }
  };
}

function stopChannel(id) {
  if (!activeNodes[id]) return;
  activeNodes[id].stop();
  delete activeNodes[id];
}

export function stopAllSoundscapes() {
  for (const k of Object.keys(activeNodes)) {
    stopChannel(k);
  }
}

export function renderSoundscapesWidget(container, state) {
  if (!prepareSlot(container, state, 'soundscapes')) return;

  const activeCount = Object.keys(activeNodes).length;
  const card = el('div', { className: 'widget-card widget-soundscapes' });

  const stopAllBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: activeCount > 0 ? `${ICON_PAUSE}<span>Mute All</span>` : `${ICON_PLAY}<span>Rain + Brown</span>`,
    onclick: () => {
      if (activeCount > 0) {
        stopAllSoundscapes();
      } else {
        startChannel('rain');
        startChannel('brown');
      }
      renderSoundscapesWidget(container, state);
    }
  });

  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${ICON_WAVES}<span>Soundscapes</span>` }),
      el('span', { className: 'widget-space-badge', text: activeCount > 0 ? `${activeCount} playing` : 'Offline Audio' })
    ]),
    stopAllBtn
  ]);

  const grid = el('div', { className: 'aw-sound-grid' });
  SOUNDSCAPE_CHANNELS.forEach((ch) => {
    const isPlaying = Boolean(activeNodes[ch.id]);
    const tile = el('button', {
      type: 'button',
      className: `aw-sound-tile${isPlaying ? ' is-active' : ''}`,
      'aria-pressed': String(isPlaying),
      onclick: () => {
        if (activeNodes[ch.id]) stopChannel(ch.id);
        else startChannel(ch.id);
        renderSoundscapesWidget(container, state);
      }
    }, [
      el('span', { className: 'aw-sound-name', text: ch.label }),
      el('span', { className: 'aw-sound-desc', text: isPlaying ? 'Playing' : ch.desc })
    ]);
    grid.appendChild(tile);
  });

  const volSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    className: 'aw-sound-slider',
    min: '5',
    max: '100',
    value: String(Math.round(masterVolume * 100)),
    'aria-label': 'Ambient sound volume'
  }));
  volSlider.addEventListener('input', () => {
    masterVolume = Number(volSlider.value) / 100;
    if (masterGain) masterGain.gain.value = masterVolume;
  });

  const footer = el('div', { className: 'aw-sound-footer' }, [
    el('span', { className: 'aw-sound-vol-label', text: 'Volume' }),
    volSlider
  ]);

  card.appendChild(header);
  card.appendChild(grid);
  card.appendChild(footer);
  mountCard(container, card);
}

/* ==========================================================================
   6. Quick Thought & Voice Memo (Pixel Recorder style)
   ========================================================================== */

const MEMOS_STORAGE_KEY = 'ntd_memos_v1';
let isDictating = false;

export function renderVoiceMemoWidget(container, state) {
  if (!prepareSlot(container, state, 'voicememo')) return;

  const memos = readLocalJson(MEMOS_STORAGE_KEY, []);
  const card = el('div', { className: 'widget-card widget-voicememo' });

  const input = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'aw-inline-input',
    placeholder: isDictating ? 'Listening... speak now' : 'Capture a quick thought or voice note...',
    'aria-label': 'Voice or text memo'
  }));

  const saveMemo = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const stamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    memos.unshift({ id: 'm_' + Date.now().toString(36), text: trimmed, time: stamp });
    writeLocalJson(MEMOS_STORAGE_KEY, memos.slice(0, 25));
    renderVoiceMemoWidget(container, state);
  };

  const micBtn = el('button', {
    type: 'button',
    className: `btn-quiet btn-sm aw-mic-btn${isDictating ? ' is-recording' : ''}`,
    title: 'Dictate with microphone',
    html: `${ICON_MIC}<span>${isDictating ? 'Listening...' : 'Dictate'}</span>`,
    onclick: () => {
      const SpeechRec = typeof window !== 'undefined'
        ? (window['SpeechRecognition'] || window['webkitSpeechRecognition'])
        : null;
      if (!SpeechRec) {
        showToast('Speech recognition unavailable — type your memo below');
        input.focus?.();
        return;
      }
      try {
        const rec = new SpeechRec();
        rec.lang = navigator.language || 'en-US';
        rec.interimResults = false;
        isDictating = true;
        renderVoiceMemoWidget(container, state);
        rec.onresult = (ev) => {
          const transcript = ev.results?.[0]?.[0]?.transcript || '';
          isDictating = false;
          if (transcript) saveMemo(transcript);
          else renderVoiceMemoWidget(container, state);
        };
        rec.onerror = () => {
          isDictating = false;
          renderVoiceMemoWidget(container, state);
        };
        rec.onend = () => {
          isDictating = false;
          renderVoiceMemoWidget(container, state);
        };
        rec.start();
      } catch {
        isDictating = false;
        showToast('Could not start microphone');
      }
    }
  });

  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${ICON_MIC}<span>Voice & Scratch</span>` }),
      el('span', { className: 'widget-count-badge', text: `${memos.length} saved` })
    ]),
    micBtn
  ]);

  const addBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: `${ICON_PLUS}<span>Log</span>`,
    onclick: () => saveMemo(input.value)
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveMemo(input.value);
    }
  });

  const formRow = el('div', { className: 'aw-inline-form' }, [input, addBtn]);
  const list = el('div', { className: 'aw-memo-list' });

  if (memos.length === 0) {
    list.appendChild(el('div', { className: 'todo-empty', text: 'No memos yet. Dictate or type a quick timestamped thought.' }));
  } else {
    memos.forEach((m) => {
      const row = el('div', { className: 'aw-memo-row' }, [
        el('span', { className: 'aw-memo-time aw-mono', text: m.time || '' }),
        el('span', { className: 'aw-memo-text', text: m.text }),
        el('button', {
          type: 'button',
          className: 'btn-quiet btn-icon-only aw-row-del',
          title: 'Copy memo',
          html: ICON_COPY,
          onclick: () => copyText(m.text, 'Memo copied')
        }),
        el('button', {
          type: 'button',
          className: 'btn-quiet btn-icon-only aw-row-del',
          title: 'Delete memo',
          html: ICON_CLOSE,
          onclick: () => {
            const next = memos.filter((x) => x.id !== m.id);
            writeLocalJson(MEMOS_STORAGE_KEY, next);
            renderVoiceMemoWidget(container, state);
          }
        })
      ]);
      list.appendChild(row);
    });
  }

  card.appendChild(header);
  card.appendChild(formRow);
  card.appendChild(list);
  mountCard(container, card);
}

/* ==========================================================================
   7. Device & Browser Pulse (Android Device Care style)
   ========================================================================== */

let cachedBattery = { level: 100, charging: true };
let batteryListenerBound = false;

function pollBattery(onUpdate) {
  if (typeof navigator === 'undefined' || typeof navigator['getBattery'] !== 'function') return;
  navigator['getBattery']().then((bat) => {
    cachedBattery = {
      level: Math.round((bat.level ?? 1) * 100),
      charging: Boolean(bat.charging)
    };
    if (!batteryListenerBound) {
      batteryListenerBound = true;
      bat.addEventListener?.('levelchange', () => {
        cachedBattery.level = Math.round((bat.level ?? 1) * 100);
        onUpdate?.();
      });
      bat.addEventListener?.('chargingchange', () => {
        cachedBattery.charging = Boolean(bat.charging);
        onUpdate?.();
      });
    }
    onUpdate?.();
  }).catch(() => {});
}

export function renderPulseWidget(container, state) {
  if (!prepareSlot(container, state, 'pulse')) return;

  pollBattery(() => {
    const valEl = container.querySelector?.('.aw-pulse-bat-val');
    const subEl = container.querySelector?.('.aw-pulse-bat-sub');
    if (valEl) valEl.textContent = `${cachedBattery.level}%`;
    if (subEl) subEl.textContent = cachedBattery.charging ? 'Charging / AC' : 'On Battery';
  });

  const nav = typeof navigator !== 'undefined' ? /** @type {any} */ (navigator) : {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
  const online = nav.onLine !== false;
  const downlink = conn.downlink ? `${conn.downlink} Mbps` : (online ? 'Online' : 'Offline');
  const netSub = conn.effectiveType ? `${String(conn.effectiveType).toUpperCase()} · ${conn.rtt || 20}ms` : (online ? 'Connected' : 'Disconnected');

  const cores = nav.hardwareConcurrency || 8;
  const devMem = nav.deviceMemory ? `${nav.deviceMemory} GB RAM` : 'Active';

  const totalCategories = (state?.categories || []).length;
  const totalBookmarks = (state?.categories || []).reduce((acc, c) => acc + (c.bookmarks?.length || 0), 0);

  const card = el('div', { className: 'widget-card widget-pulse' });
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${getIconSvg('cpu', 14)}<span>Device Pulse</span>` }),
      el('span', { className: 'widget-space-badge', text: online ? 'System Healthy' : 'Offline Mode' })
    ]),
    el('button', {
      type: 'button',
      className: 'btn-quiet btn-icon-only',
      title: 'Refresh telemetry',
      html: ICON_REFRESH,
      onclick: () => renderPulseWidget(container, state)
    })
  ]);

  const grid = el('div', { className: 'aw-pulse-grid' }, [
    el('div', { className: 'aw-pulse-cell' }, [
      el('span', { className: 'aw-pulse-label', text: 'BATTERY' }),
      el('span', { className: 'aw-pulse-val aw-pulse-bat-val aw-mono', text: `${cachedBattery.level}%` }),
      el('span', { className: 'aw-pulse-sub aw-pulse-bat-sub', text: cachedBattery.charging ? 'Charging / AC' : 'On Battery' })
    ]),
    el('div', { className: 'aw-pulse-cell' }, [
      el('span', { className: 'aw-pulse-label', text: 'NETWORK' }),
      el('span', { className: 'aw-pulse-val aw-mono', text: downlink }),
      el('span', { className: 'aw-pulse-sub', text: netSub })
    ]),
    el('div', { className: 'aw-pulse-cell' }, [
      el('span', { className: 'aw-pulse-label', text: 'COMPUTE' }),
      el('span', { className: 'aw-pulse-val aw-mono', text: `${cores} Cores` }),
      el('span', { className: 'aw-pulse-sub', text: devMem })
    ]),
    el('div', { className: 'aw-pulse-cell' }, [
      el('span', { className: 'aw-pulse-label', text: 'LIBRARY' }),
      el('span', { className: 'aw-pulse-val aw-mono', text: `${totalBookmarks} Apps` }),
      el('span', { className: 'aw-pulse-sub', text: `${totalCategories} Collections` })
    ])
  ]);

  card.appendChild(header);
  card.appendChild(grid);
  mountCard(container, card);
}

/* ==========================================================================
   8. Clipboard & Snippet Pinboard (Gboard Clipboard style)
   ========================================================================== */

const CLIPS_STORAGE_KEY = 'ntd_clips_v1';
const DEFAULT_CLIPS = [
  { id: 'c1', text: '#3B82F6' },
  { id: 'c2', text: 'git status -sb' },
  { id: 'c3', text: 'npm test' }
];

export function renderClipboardWidget(container, state) {
  if (!prepareSlot(container, state, 'clipboard')) return;

  const clips = readLocalJson(CLIPS_STORAGE_KEY, DEFAULT_CLIPS);
  const card = el('div', { className: 'widget-card widget-clipboard' });

  const pasteBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: `${ICON_PLUS}<span>Paste Clipboard</span>`,
    onclick: async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          const text = (await navigator.clipboard.readText()).trim();
          if (text) {
            clips.unshift({ id: 'c_' + Date.now().toString(36), text: text.slice(0, 160) });
            writeLocalJson(CLIPS_STORAGE_KEY, clips.slice(0, 20));
            renderClipboardWidget(container, state);
            showToast('Pinned from clipboard');
            return;
          }
        }
      } catch { /* fallback */ }
      showToast('Type or paste into the box below to pin');
    }
  });

  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${ICON_COPY}<span>Clipboard Pins</span>` }),
      el('span', { className: 'widget-count-badge', text: `${clips.length} pins` })
    ]),
    pasteBtn
  ]);

  const pillsWrap = el('div', { className: 'aw-clips-grid' });
  clips.forEach((clip) => {
    const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(clip.text.trim());
    const pill = el('div', { className: 'aw-clip-pill' });
    if (isHex) {
      pill.appendChild(el('span', {
        className: 'aw-clip-swatch',
        style: { backgroundColor: clip.text.trim() }
      }));
    }
    const copyTrigger = el('button', {
      type: 'button',
      className: 'aw-clip-text-btn',
      title: 'Click to copy',
      text: clip.text,
      onclick: () => copyText(clip.text, `Copied "${clip.text.slice(0, 24)}"`)
    });
    const delBtn = el('button', {
      type: 'button',
      className: 'aw-clip-del',
      title: 'Unpin snippet',
      html: ICON_CLOSE,
      onclick: () => {
        const next = clips.filter((x) => x.id !== clip.id);
        writeLocalJson(CLIPS_STORAGE_KEY, next);
        renderClipboardWidget(container, state);
      }
    });
    pill.appendChild(copyTrigger);
    pill.appendChild(delBtn);
    pillsWrap.appendChild(pill);
  });

  const input = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'aw-inline-input',
    placeholder: 'Pin snippet, command, or #hex...',
    'aria-label': 'Pin new snippet'
  }));
  const addBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: `${ICON_PLUS}<span>Pin</span>`,
    onclick: () => {
      const val = input.value.trim();
      if (!val) return;
      clips.unshift({ id: 'c_' + Date.now().toString(36), text: val });
      writeLocalJson(CLIPS_STORAGE_KEY, clips.slice(0, 20));
      renderClipboardWidget(container, state);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBtn.click();
    }
  });

  card.appendChild(header);
  card.appendChild(pillsWrap);
  card.appendChild(el('div', { className: 'aw-inline-form' }, [input, addBtn]));
  mountCard(container, card);
}

/* ==========================================================================
   9. Quick Calculator & Unit Converter (Material You Calculator style)
   ========================================================================== */

let calcExpression = '';
let calcResult = '0';

/**
 * Safe recursive-descent arithmetic evaluator (no eval / Function).
 * Supports +, -, *, /, %, ^, parentheses, and decimals.
 * @param {string} expr
 * @returns {number | null}
 */
export function evaluateMathExpression(expr) {
  if (!expr || typeof expr !== 'string') return null;
  const cleaned = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  if (!cleaned || !/^[0-9+\-*/%.^()]+$/.test(cleaned)) return null;

  let pos = 0;
  function peek() { return cleaned[pos] || ''; }
  function consume() { return cleaned[pos++]; }

  function parseExp() {
    let v = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const rhs = parseTerm();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  function parseTerm() {
    let v = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const rhs = parseFactor();
      if (op === '*') v *= rhs;
      else if (op === '/') v = rhs === 0 ? NaN : v / rhs;
      else v = rhs === 0 ? NaN : v % rhs;
    }
    return v;
  }

  function parseFactor() {
    if (peek() === '+') { consume(); return parseFactor(); }
    if (peek() === '-') { consume(); return -parseFactor(); }
    let base = parsePrimary();
    if (peek() === '^') {
      consume();
      base = Math.pow(base, parseFactor());
    }
    return base;
  }

  function parsePrimary() {
    if (peek() === '(') {
      consume();
      const val = parseExp();
      if (peek() === ')') consume();
      return val;
    }
    const start = pos;
    while (/[0-9.]/.test(peek())) consume();
    if (start === pos) return NaN;
    return Number(cleaned.slice(start, pos));
  }

  const out = parseExp();
  if (pos !== cleaned.length || !Number.isFinite(out)) return null;
  return Math.round(out * 1e8) / 1e8;
}

export function convertUnitValue(val, mode) {
  if (!Number.isFinite(val)) return null;
  switch (mode) {
    case 'km-mi': return `${Math.round(val * 0.621371 * 100) / 100} mi`;
    case 'mi-km': return `${Math.round(val * 1.60934 * 100) / 100} km`;
    case 'kg-lb': return `${Math.round(val * 2.20462 * 100) / 100} lb`;
    case 'c-f': return `${Math.round(((val * 9) / 5 + 32) * 10) / 10} °F`;
    case 'f-c': return `${Math.round((((val - 32) * 5) / 9) * 10) / 10} °C`;
    default: return null;
  }
}

export function renderCalculatorWidget(container, state) {
  if (!prepareSlot(container, state, 'calculator')) return;

  const card = el('div', { className: 'widget-card widget-calculator' });
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${ICON_CALC}<span>Calculator</span>` })
    ]),
    el('button', {
      type: 'button',
      className: 'btn-quiet btn-sm',
      html: `${ICON_COPY}<span>Copy</span>`,
      onclick: () => copyText(calcResult, `Copied ${calcResult}`)
    })
  ]);

  const exprInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'aw-calc-input aw-mono',
    placeholder: 'e.g. 240 * 1.18',
    value: calcExpression,
    'aria-label': 'Calculator expression'
  }));
  const resultEl = el('div', { className: 'aw-calc-result aw-mono', text: `= ${calcResult}` });

  const updateCalc = (nextExpr) => {
    calcExpression = nextExpr;
    exprInput.value = calcExpression;
    const val = evaluateMathExpression(calcExpression);
    if (val !== null) calcResult = String(val);
    else if (!calcExpression) calcResult = '0';
    resultEl.textContent = `= ${calcResult}`;
  };

  exprInput.addEventListener('input', () => updateCalc(exprInput.value));
  exprInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = evaluateMathExpression(calcExpression);
      if (val !== null) updateCalc(String(val));
    }
  });

  const displayBox = el('div', { className: 'aw-calc-display' }, [exprInput, resultEl]);

  // Unit conversion chips
  const unitRow = el('div', { className: 'aw-calc-units' });
  [
    { id: 'km-mi', label: 'km→mi' },
    { id: 'kg-lb', label: 'kg→lb' },
    { id: 'c-f', label: '°C→°F' },
    { id: 'f-c', label: '°F→°C' }
  ].forEach((u) => {
    unitRow.appendChild(el('button', {
      type: 'button',
      className: 'timer-preset-pill',
      text: u.label,
      onclick: () => {
        const num = evaluateMathExpression(calcExpression) ?? Number(calcResult) ?? 0;
        const converted = convertUnitValue(num, u.id);
        if (converted) {
          resultEl.textContent = `= ${converted}`;
        }
      }
    }));
  });

  // Compact glass keypad
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', 'C', '0', '.', '=', '+'];
  const pad = el('div', { className: 'aw-calc-pad' });
  keys.forEach((k) => {
    pad.appendChild(el('button', {
      type: 'button',
      className: `aw-calc-key${k === '=' ? ' is-equals' : ''}${k === 'C' ? ' is-clear' : ''}`,
      text: k,
      onclick: () => {
        if (k === 'C') {
          updateCalc('');
        } else if (k === '=') {
          const val = evaluateMathExpression(calcExpression);
          if (val !== null) updateCalc(String(val));
        } else {
          updateCalc(calcExpression + k);
        }
      }
    }));
  });

  card.appendChild(header);
  card.appendChild(displayBox);
  card.appendChild(unitRow);
  card.appendChild(pad);
  mountCard(container, card);
}

/* ==========================================================================
   10. Read-Later & Tab Queue (Chrome Reading List style)
   ========================================================================== */

const READLATER_STORAGE_KEY = 'ntd_readlater_v1';
const DEFAULT_READLATER = [
  { id: 'rl_1', title: 'MDN Web Docs — Modern Web APIs', url: 'https://developer.mozilla.org' },
  { id: 'rl_2', title: 'Hacker News — Top Stories', url: 'https://news.ycombinator.com' }
];

export function renderReadLaterWidget(container, state) {
  if (!prepareSlot(container, state, 'readlater')) return;

  const queue = readLocalJson(READLATER_STORAGE_KEY, DEFAULT_READLATER);
  const openIn = state?.settings?.behavior?.openIn || 'same';

  const card = el('div', { className: 'widget-card widget-readlater' });
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', html: `${getIconSvg('bookmark', 14)}<span>Reading Queue</span>` }),
      el('span', { className: 'widget-count-badge', text: `${queue.length} unread` })
    ]),
    el('button', {
      type: 'button',
      className: 'btn-quiet btn-sm',
      title: 'Save open browser tabs into a collection',
      html: `${ICON_SAVE_TABS}<span>Save Tabs</span>`,
      onclick: () => saveCurrentTabs()
    })
  ]);

  const list = el('div', { className: 'aw-readlater-list' });
  if (queue.length === 0) {
    list.appendChild(el('div', { className: 'todo-empty', text: 'Reading queue is clear! Add a link below to save for later.' }));
  } else {
    queue.forEach((item) => {
      const fav = createFaviconElement(item.url, item.title);
      const link = el('a', {
        className: 'aw-rl-link',
        href: item.url,
        target: openIn === 'new' ? '_blank' : '_self',
        rel: openIn === 'new' ? 'noopener noreferrer' : undefined,
        title: item.url
      }, [
        fav,
        el('span', { className: 'aw-rl-title', text: item.title })
      ]);

      const doneBtn = el('button', {
        type: 'button',
        className: 'btn-quiet btn-icon-only aw-row-del',
        title: 'Mark as read',
        html: ICON_CHECK,
        onclick: () => {
          const next = queue.filter((x) => x.id !== item.id);
          writeLocalJson(READLATER_STORAGE_KEY, next);
          renderReadLaterWidget(container, state);
          showToast('Removed from Reading Queue');
        }
      });

      list.appendChild(el('div', { className: 'aw-rl-row' }, [link, doneBtn]));
    });
  }

  const urlInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'aw-inline-input',
    placeholder: 'Paste article URL or title + URL...',
    'aria-label': 'Add URL to reading queue'
  }));
  const addBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: `${ICON_PLUS}<span>Queue</span>`,
    onclick: () => {
      let raw = urlInput.value.trim();
      if (!raw) return;
      if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
      let host = raw;
      try { host = new URL(raw).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
      queue.unshift({ id: 'rl_' + Date.now().toString(36), title: host, url: raw });
      writeLocalJson(READLATER_STORAGE_KEY, queue);
      renderReadLaterWidget(container, state);
    }
  });
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBtn.click();
    }
  });

  card.appendChild(header);
  card.appendChild(list);
  card.appendChild(el('div', { className: 'aw-inline-form' }, [urlInput, addBtn]));
  mountCard(container, card);
}

/* ==========================================================================
   Master Renderer for All 10 Android Widgets
   ========================================================================== */

export function renderAndroidWidgets(state) {
  if (typeof document === 'undefined') return;
  try { renderGlanceWidget(document.getElementById('hero-glance-slot'), state); } catch (e) { console.error('[NTD] glance error:', e); }
  try { renderHabitsWidget(document.getElementById('hero-habits-slot'), state); } catch (e) { console.error('[NTD] habits error:', e); }
  try { renderWorldClockWidget(document.getElementById('hero-worldclock-slot'), state); } catch (e) { console.error('[NTD] worldclock error:', e); }
  try { renderCountdownWidget(document.getElementById('hero-countdown-slot'), state); } catch (e) { console.error('[NTD] countdown error:', e); }
  try { renderSoundscapesWidget(document.getElementById('hero-soundscapes-slot'), state); } catch (e) { console.error('[NTD] soundscapes error:', e); }
  try { renderVoiceMemoWidget(document.getElementById('hero-voicememo-slot'), state); } catch (e) { console.error('[NTD] voicememo error:', e); }
  try { renderPulseWidget(document.getElementById('hero-pulse-slot'), state); } catch (e) { console.error('[NTD] pulse error:', e); }
  try { renderClipboardWidget(document.getElementById('hero-clipboard-slot'), state); } catch (e) { console.error('[NTD] clipboard error:', e); }
  try { renderCalculatorWidget(document.getElementById('hero-calculator-slot'), state); } catch (e) { console.error('[NTD] calculator error:', e); }
  try { renderReadLaterWidget(document.getElementById('hero-readlater-slot'), state); } catch (e) { console.error('[NTD] readlater error:', e); }
}
