// @ts-check
/**
 * Home Screen Editor (Android-launcher style).
 *
 * Model
 * -----
 * - The hero panel is the canvas. Every visible widget is pinned to an absolute
 *   position (center in % of the panel, width/height in px) while editing, so
 *   nothing reflows when another widget is moved.
 * - Moving snaps to a half-cell grid, resizing snaps to whole cells, and widgets
 *   can never overlap: a ghost outline shows where the widget will land (red
 *   when there is no room) and the nearest free slot is used on drop.
 * - Nothing is written to storage until the user actually changes something;
 *   the first change persists the whole pinned layout.
 * - Hidden widgets live in the "Add widget" tray, like the Android widget picker.
 */
import {
  onEditModeChange,
  getEditMode,
  setEditMode,
  consumePendingWidgetSelection,
  onWidgetFocusRequest,
  getReturnToMenuTab
} from './edit-mode.js';
import {
  applyWidgetPositions,
  pxToPct,
  GRID_CELL_WIDTH,
  GRID_CELL_HEIGHT,
  WIDGET_GRID_SPECS
} from './widget-drag.js';
import { showToast } from '../ui/toasts.js';
import {
  ICON_GRIP_VERTICAL,
  ICON_CLOSE,
  ICON_PLUS,
  ICON_ARROW_LEFT,
  ICON_CHECK,
  ICON_TRASH,
  ICON_REFRESH
} from '../ui/icons.js';

const ICON_ALIGN_CENTER = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"></line><rect x="5" y="7" width="14" height="10" rx="2"></rect></svg>`;
const ICON_RESET_SIZE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="m21 3-7 7"></path><path d="m3 21 7-7"></path></svg>`;
const ICON_UNDO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"></path></svg>`;

export const GRID_STEP_X = GRID_CELL_WIDTH / 2;
export const GRID_STEP_Y = GRID_CELL_HEIGHT / 2;

const PANEL_PADDING = 12;
const DOCK_RESERVE = 76;
const OVERLAP_TOLERANCE = 2;
const CENTER_SNAP_PX = 10;
const MAX_SEARCH_RING = 24;

/** Widgets whose font scales with their box keep a natural width until resized. */
const FONT_SCALED = new Set(['clock', 'timer']);

const WIDGETS = [
  { key: 'clock', sel: '.dashboard-header' },
  { key: 'search', sel: '.search-container' },
  { key: 'weather', sel: '#hero-weather-slot' },
  { key: 'tasks', sel: '#hero-tasks-slot' },
  { key: 'notes', sel: '#hero-notes-slot' },
  { key: 'timer', sel: '#hero-timer-slot' },
  { key: 'speeddial', sel: '#hero-speeddial-slot' },
  { key: 'quote', sel: '#hero-quote-slot' },
  { key: 'glance', sel: '#hero-glance-slot' },
  { key: 'habits', sel: '#hero-habits-slot' },
  { key: 'worldclock', sel: '#hero-worldclock-slot' },
  { key: 'countdown', sel: '#hero-countdown-slot' },
  { key: 'soundscapes', sel: '#hero-soundscapes-slot' },
  { key: 'voicememo', sel: '#hero-voicememo-slot' },
  { key: 'pulse', sel: '#hero-pulse-slot' },
  { key: 'clipboard', sel: '#hero-clipboard-slot' },
  { key: 'calculator', sel: '#hero-calculator-slot' },
  { key: 'readlater', sel: '#hero-readlater-slot' }
];

/** Settings flag that must be on for a widget to render at all. */
const FEATURE_FLAGS = {
  tasks: (s) => Boolean(s.widgets?.todo),
  notes: (s) => Boolean(s.widgets?.notes),
  weather: (s) => Boolean(s.weather?.enabled),
  timer: (s) => s.widgets?.timer !== false,
  speeddial: (s) => s.widgets?.speeddial !== false,
  quote: (s) => s.widgets?.quote !== false,
  glance: (s) => Boolean(s.widgets?.glance),
  habits: (s) => Boolean(s.widgets?.habits),
  worldclock: (s) => Boolean(s.widgets?.worldclock),
  countdown: (s) => Boolean(s.widgets?.countdown),
  soundscapes: (s) => Boolean(s.widgets?.soundscapes),
  voicememo: (s) => Boolean(s.widgets?.voicememo),
  pulse: (s) => Boolean(s.widgets?.pulse),
  clipboard: (s) => Boolean(s.widgets?.clipboard),
  calculator: (s) => Boolean(s.widgets?.calculator),
  readlater: (s) => Boolean(s.widgets?.readlater)
};

/** @typedef {{ left: number, top: number, width: number, height: number }} Rect */
/** @typedef {{ left: number, top: number, right: number, bottom: number }} Bounds */

/* ==========================================================================
   Pure geometry helpers (exported for tests)
   ========================================================================== */

/**
 * @param {number} v
 * @param {number} min
 * @param {number} max
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * True when two rects overlap by more than `tolerance` px on both axes.
 * @param {Rect} a
 * @param {Rect} b
 * @param {number} [tolerance]
 */
export function rectsOverlap(a, b, tolerance = OVERLAP_TOLERANCE) {
  return (
    a.left < b.left + b.width - tolerance &&
    a.left + a.width > b.left + tolerance &&
    a.top < b.top + b.height - tolerance &&
    a.top + a.height > b.top + tolerance
  );
}

/**
 * True when rect lies fully inside bounds.
 * @param {Rect} r
 * @param {Bounds} bounds
 */
export function rectInBounds(r, bounds) {
  return (
    r.left >= bounds.left - 0.5 &&
    r.top >= bounds.top - 0.5 &&
    r.left + r.width <= bounds.right + 0.5 &&
    r.top + r.height <= bounds.bottom + 0.5
  );
}

/**
 * Shifts a rect so it sits inside bounds (never resizes it unless it is larger than bounds).
 * @param {Rect} r
 * @param {Bounds} bounds
 * @returns {Rect}
 */
export function clampRectToBounds(r, bounds) {
  const width = Math.min(r.width, bounds.right - bounds.left);
  const height = Math.min(r.height, bounds.bottom - bounds.top);
  return {
    left: clamp(r.left, bounds.left, Math.max(bounds.left, bounds.right - width)),
    top: clamp(r.top, bounds.top, Math.max(bounds.top, bounds.bottom - height)),
    width,
    height
  };
}

/**
 * Snaps a dragged rect to the half-cell grid and the panel's center guides.
 * @param {Rect} r
 * @param {{ width: number, height: number }} panel
 * @param {boolean} [disabled]
 * @returns {Rect}
 */
export function snapMoveRect(r, panel, disabled = false) {
  if (disabled) return { ...r };
  let left = Math.round(r.left / GRID_STEP_X) * GRID_STEP_X;
  let top = Math.round(r.top / GRID_STEP_Y) * GRID_STEP_Y;
  if (Math.abs(left + r.width / 2 - panel.width / 2) <= CENTER_SNAP_PX) {
    left = Math.round(panel.width / 2 - r.width / 2);
  }
  if (Math.abs(top + r.height / 2 - panel.height / 2) <= CENTER_SNAP_PX) {
    top = Math.round(panel.height / 2 - r.height / 2);
  }
  return { left, top, width: r.width, height: r.height };
}

/**
 * Snaps a dimension to whole grid cells within [min, max].
 * @param {number} value
 * @param {number} cell
 * @param {number} min
 * @param {number} max
 * @param {boolean} [disabled]
 */
export function snapDimension(value, cell, min, max, disabled = false) {
  const snapped = disabled ? Math.round(value) : Math.round(value / cell) * cell;
  return clamp(snapped, min, max);
}

/** @type {Array<{ dx: number, dy: number }> | null} */
let searchOffsets = null;

function getSearchOffsets() {
  if (searchOffsets) return searchOffsets;
  const list = [];
  for (let dy = -MAX_SEARCH_RING; dy <= MAX_SEARCH_RING; dy++) {
    for (let dx = -MAX_SEARCH_RING; dx <= MAX_SEARCH_RING; dx++) {
      list.push({ dx, dy });
    }
  }
  const dist = (o) => (o.dx * GRID_STEP_X) ** 2 + (o.dy * GRID_STEP_Y) ** 2;
  list.sort((a, b) => dist(a) - dist(b));
  searchOffsets = list;
  return list;
}

/**
 * True when rect is inside bounds and overlaps none of `others`.
 * @param {Rect} r
 * @param {Rect[]} others
 * @param {Bounds} bounds
 */
export function rectFits(r, others, bounds) {
  return rectInBounds(r, bounds) && !others.some((o) => rectsOverlap(r, o));
}

/**
 * Finds the free slot closest to `rect` (Android-style "nearest empty cell").
 * Returns null when the screen has no room for a rect of that size.
 * @param {Rect} rect
 * @param {Rect[]} others
 * @param {Bounds} bounds
 * @returns {Rect | null}
 */
export function findFreeSpot(rect, others, bounds) {
  const base = clampRectToBounds(rect, bounds);
  if (rectFits(base, others, bounds)) return base;
  for (const { dx, dy } of getSearchOffsets()) {
    const candidate = {
      left: base.left + dx * GRID_STEP_X,
      top: base.top + dy * GRID_STEP_Y,
      width: base.width,
      height: base.height
    };
    if (rectFits(candidate, others, bounds)) return candidate;
  }
  return null;
}

/**
 * Computes the new rect for an edge/corner resize.
 * @param {Rect} start
 * @param {'left'|'right'|'top'|'bottom'|'corner'} dir
 * @param {number} dx
 * @param {number} dy
 * @param {{ minW: number, maxW: number, minH: number, maxH: number, resizeMode?: string }} spec
 * @param {boolean} [free] Disable grid snapping (Alt)
 * @returns {Rect}
 */
export function resizeRect(start, dir, dx, dy, spec, free = false) {
  const right = start.left + start.width;
  const bottom = start.top + start.height;
  let { left, top, width, height } = start;

  if (dir === 'right' || dir === 'corner') {
    width = snapDimension(start.width + dx, GRID_CELL_WIDTH, spec.minW, spec.maxW, free);
  } else if (dir === 'left') {
    width = snapDimension(start.width - dx, GRID_CELL_WIDTH, spec.minW, spec.maxW, free);
    left = right - width;
  }

  if (spec.resizeMode !== 'horizontal') {
    if (dir === 'bottom' || dir === 'corner') {
      height = snapDimension(start.height + dy, GRID_CELL_HEIGHT, spec.minH, spec.maxH, free);
    } else if (dir === 'top') {
      height = snapDimension(start.height - dy, GRID_CELL_HEIGHT, spec.minH, spec.maxH, free);
      top = bottom - height;
    }
  }

  return { left, top, width, height };
}

/* ==========================================================================
   Editor
   ========================================================================== */

/**
 * @param {string} key
 */
function getSpec(key) {
  return WIDGET_GRID_SPECS[key] || {
    label: key,
    resizeMode: 'both',
    minW: 200,
    maxW: 800,
    minH: 80,
    maxH: 500,
    presets: { S: [4, 3], M: [6, 4], L: [8, 6] }
  };
}

const clone = (v) => JSON.parse(JSON.stringify(v ?? {}));
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Wires the home screen editor to edit mode.
 * @param {HTMLElement | null} heroPanel
 * @param {any} store
 * @returns {{ destroy: () => void } | null}
 */
export function initHomeEditor(heroPanel, store) {
  if (!heroPanel || !store || typeof document === 'undefined') return null;

  let active = false;
  let dirty = false;
  /** Currently selected widget key in the editor. */
  /** @type {string | null} */ let selectedKey = null;
  /** Widget config the editor is currently showing (pinned layout). */
  let session = {};
  /** @type {any[]} Stack of previously persisted widget configs for Undo. */
  let history = [];
  /** @type {HTMLElement | null} */ let bar = null;
  /** @type {HTMLElement | null} */ let ghost = null;
  /** @type {HTMLElement | null} */ let tray = null;
  const observer = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(() => { if (active) ensureFrames(); })
    : null;

  /* ---------- helpers ---------- */

  const getSettings = () => (store.getState ? store.getState() : store.get()).settings;
  const getEl = (key) => /** @type {HTMLElement | null} */ (heroPanel.querySelector(WIDGETS.find((w) => w.key === key)?.sel || ''));
  const panelRect = () => heroPanel.getBoundingClientRect();

  /** @param {HTMLElement} el @returns {Rect} */
  function liveRect(el) {
    const p = panelRect();
    const r = el.getBoundingClientRect();
    return { left: r.left - p.left, top: r.top - p.top, width: r.width, height: r.height };
  }

  function isVisible(key) {
    const el = getEl(key);
    if (!el || el.hidden || el.style.display === 'none' || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 20 && r.height >= 10;
  }

  const visibleKeys = () => WIDGETS.map((w) => w.key).filter(isVisible);

  /** @param {string} exceptKey @returns {Rect[]} */
  function otherRects(exceptKey) {
    return visibleKeys().filter((k) => k !== exceptKey).map((k) => liveRect(/** @type {HTMLElement} */ (getEl(k))));
  }

  /** @returns {Bounds} */
  function getBounds() {
    const p = panelRect();
    const dock = getSettings().dock?.position || 'off';
    return {
      left: PANEL_PADDING + (dock === 'left' ? DOCK_RESERVE : 0),
      top: PANEL_PADDING + (dock === 'top' ? DOCK_RESERVE : 0),
      right: p.width - PANEL_PADDING - (dock === 'right' ? DOCK_RESERVE : 0),
      bottom: p.height - PANEL_PADDING - (dock === 'bottom' ? DOCK_RESERVE : 0)
    };
  }

  function applySession() {
    applyWidgetPositions(heroPanel, session);
  }

  /**
   * Writes a rect into the session config (center % + px size).
   * @param {string} key
   * @param {Rect} rect
   * @param {boolean} withSize
   */
  function setSessionRect(key, rect, withSize) {
    const p = panelRect();
    const conf = session[key] || (session[key] = { x: null, y: null, w: null, h: null, hidden: false });
    conf.x = pxToPct(rect.left + rect.width / 2, p.width);
    conf.y = pxToPct(rect.top + rect.height / 2, p.height);
    if (withSize) {
      conf.w = rect.width;
      if (getSpec(key).resizeMode !== 'horizontal') conf.h = rect.height;
    }
    applySession();
  }

  /** Pins every visible widget to its current on-screen position. */
  function pinLayout() {
    const p = panelRect();
    const measured = {};
    for (const key of visibleKeys()) {
      measured[key] = liveRect(/** @type {HTMLElement} */ (getEl(key)));
    }
    for (const [key, r] of Object.entries(measured)) {
      const conf = session[key] || (session[key] = { x: null, y: null, w: null, h: null, hidden: false });
      if (typeof conf.x !== 'number' || typeof conf.y !== 'number') {
        conf.x = pxToPct(r.left + r.width / 2, p.width);
        conf.y = pxToPct(r.top + r.height / 2, p.height);
        if (!FONT_SCALED.has(key) && typeof conf.w !== 'number') conf.w = Math.round(r.width);
      }
    }
    applySession();
  }

  function storedWidgets() {
    return clone(getSettings().hero?.widgets);
  }

  function writeWidgets(widgets) {
    const s = getSettings();
    store.updateSettings({ hero: { ...(s.hero || {}), widgets } });
  }

  /** Persists the session layout (and records Undo history). */
  function commit() {
    history.push(storedWidgets());
    if (history.length > 30) history.shift();
    const out = clone(session);
    for (const conf of Object.values(out)) {
      if (typeof conf.x === 'number') conf.x = round2(conf.x);
      if (typeof conf.y === 'number') conf.y = round2(conf.y);
      if (typeof conf.w === 'number') conf.w = Math.round(conf.w);
      if (typeof conf.h === 'number') conf.h = Math.round(conf.h);
    }
    session = out;
    writeWidgets(out);
    dirty = true;
    applySession();
    ensureFrames();
    renderBar();
  }

  /** Replaces layout with `widgets`, then re-pins whatever flows naturally. */
  function restore(widgets) {
    session = clone(widgets);
    writeWidgets(clone(widgets));
    applySession();
    requestAnimationFrame(() => {
      if (!active) return;
      pinLayout();
      ensureFrames();
      renderBar();
    });
  }

  /* ---------- ghost (landing preview) ---------- */

  function showGhost(rect, valid) {
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'he-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.appendChild(Object.assign(document.createElement('span'), { className: 'he-ghost-label' }));
      heroPanel.appendChild(ghost);
    }
    ghost.classList.toggle('is-invalid', !valid);
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    const label = ghost.firstElementChild;
    if (label) {
      label.textContent = valid
        ? `${Math.max(1, Math.round(rect.width / GRID_CELL_WIDTH))} × ${Math.max(1, Math.round(rect.height / GRID_CELL_HEIGHT))}`
        : 'No room';
    }
  }

  function hideGhost() {
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
  }

  /* ---------- interactions ---------- */

  /**
   * @param {PointerEvent} e
   * @param {string} key
   * @param {'move'|'resize'} mode
   * @param {'left'|'right'|'top'|'bottom'|'corner'} [dir]
   */
  function beginInteraction(e, key, mode, dir = 'corner') {
    if (e.button !== undefined && e.button !== 0) return;
    const el = getEl(key);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    const target = /** @type {HTMLElement} */ (e.currentTarget);
    const spec = getSpec(key);
    const start = liveRect(el);
    const original = { ...session[key] };
    const startX = e.clientX;
    const startY = e.clientY;
    const bounds = getBounds();
    const panel = panelRect();
    const others = otherRects(key);

    let proposed = start;
    let valid = true;
    let moved = false;

    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.add(mode === 'move' ? 'is-dragging' : 'is-resizing');
    document.body.classList.add('is-widget-resizing');

    const onMove = (/** @type {PointerEvent} */ ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;

      if (mode === 'move') {
        const raw = { left: start.left + dx, top: start.top + dy, width: start.width, height: start.height };
        setSessionRect(key, clampRectToBounds(raw, bounds), false);
        const snapped = clampRectToBounds(snapMoveRect(raw, panel, ev.altKey), bounds);
        const spot = findFreeSpot(snapped, others, bounds);
        valid = Boolean(spot);
        proposed = spot || snapped;
      } else {
        const next = resizeRect(start, dir, dx, dy, spec, ev.altKey);
        setSessionRect(key, next, true);
        proposed = next;
        valid = rectFits(next, others, bounds);
      }
      showGhost(proposed, valid);
    };

    const finish = (/** @type {PointerEvent} */ ev, cancelled) => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onCancel);
      try { target.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      el.classList.remove('is-dragging', 'is-resizing');
      document.body.classList.remove('is-widget-resizing');
      hideGhost();

      if (cancelled || !moved || !valid) {
        session[key] = original;
        applySession();
        if (moved && !valid && !cancelled) showToast('No room there — widget moved back');
        return;
      }
      setSessionRect(key, proposed, mode === 'resize');
      commit();
    };
    const onUp = (/** @type {PointerEvent} */ ev) => finish(ev, false);
    const onCancel = (/** @type {PointerEvent} */ ev) => finish(ev, true);

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onCancel);
  }

  /**
   * Returns 'S' | 'M' | 'L' if widget dimensions match a preset within half a cell, else null.
   * @param {string} key
   * @returns {string | null}
   */
  function getMatchingPreset(key) {
    const el = getEl(key);
    const spec = getSpec(key);
    if (!el || !spec.presets) return null;
    const r = liveRect(el);
    for (const [name, [cols, rows]] of Object.entries(spec.presets)) {
      const targetW = clamp(cols * GRID_CELL_WIDTH, spec.minW, spec.maxW);
      const targetH = clamp(rows * GRID_CELL_HEIGHT, spec.minH, spec.maxH);
      const wMatch = Math.abs(r.width - targetW) <= GRID_CELL_WIDTH * 0.45;
      const hMatch = spec.resizeMode === 'horizontal' || Math.abs(r.height - targetH) <= GRID_CELL_HEIGHT * 0.45;
      if (wMatch && hMatch) return name;
    }
    return null;
  }

  function updateSelectionUI() {
    for (const { key } of WIDGETS) {
      const el = getEl(key);
      if (!el) continue;
      const isSel = active && key === selectedKey && isVisible(key);
      el.classList.toggle('is-selected', isSel);
      const frame = Array.from(el.children).find((c) => c.classList.contains('widget-drag-frame'));
      if (frame) {
        frame.classList.toggle('is-selected', isSel);
        const activePreset = getMatchingPreset(key);
        frame.querySelectorAll('.widget-preset-btn').forEach((btn) => {
          const isActive = btn.textContent === activePreset;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-pressed', String(isActive));
        });
      }
    }
  }

  /**
   * Selects a widget in edit mode (or clears selection with null).
   * @param {string | null} key
   * @param {{ focusFrame?: boolean }} [opts]
   */
  function setSelected(key, opts = {}) {
    selectedKey = key && isVisible(key) ? key : null;
    updateSelectionUI();
    renderBar();
    if (opts.focusFrame && selectedKey) {
      const el = getEl(selectedKey);
      const frame = /** @type {HTMLElement | null} */ (el ? Array.from(el.children).find((c) => c.classList.contains('widget-drag-frame')) : null);
      frame?.focus?.({ preventScroll: true });
    }
  }

  /**
   * Applies an S / M / L preset.
   * @param {string} key
   * @param {string} name
   */
  function applyPreset(key, name) {
    const el = getEl(key);
    const spec = getSpec(key);
    const preset = spec.presets?.[name];
    if (!el || !preset) return;
    const [cols, rows] = preset;
    const current = liveRect(el);
    const width = clamp(cols * GRID_CELL_WIDTH, spec.minW, spec.maxW);
    const height = spec.resizeMode === 'horizontal'
      ? current.height
      : clamp(rows * GRID_CELL_HEIGHT, spec.minH, spec.maxH);
    const spot = findFreeSpot({ left: current.left, top: current.top, width, height }, otherRects(key), getBounds());
    if (!spot) {
      showToast('Not enough room for that size');
      return;
    }
    setSelected(key);
    setSessionRect(key, spot, true);
    commit();
  }

  /** Centers a widget horizontally on the canvas without overlapping others. @param {string} key */
  function centerWidget(key) {
    const el = getEl(key);
    if (!el) return;
    const r = liveRect(el);
    const p = panelRect();
    const target = {
      left: Math.round((p.width - r.width) / 2),
      top: r.top,
      width: r.width,
      height: r.height
    };
    const spot = findFreeSpot(target, otherRects(key), getBounds());
    if (!spot) {
      showToast('Not enough room to center there');
      return;
    }
    setSessionRect(key, spot, false);
    commit();
  }

  /** Resets a widget's size back to its default dimensions. @param {string} key */
  function resetWidgetSize(key) {
    const el = getEl(key);
    if (!el) return;
    const spec = getSpec(key);
    const current = liveRect(el);
    if (FONT_SCALED.has(key)) {
      const conf = session[key] || (session[key] = { x: null, y: null, w: null, h: null, hidden: false });
      conf.w = null;
      conf.h = null;
      commit();
      return;
    }
    const width = clamp((spec.defaultCols || 6) * GRID_CELL_WIDTH, spec.minW, spec.maxW);
    const height = spec.resizeMode === 'horizontal'
      ? current.height
      : clamp((spec.defaultRows || 4) * GRID_CELL_HEIGHT, spec.minH, spec.maxH);
    const spot = findFreeSpot({ left: current.left, top: current.top, width, height }, otherRects(key), getBounds());
    if (!spot) {
      showToast('Not enough room for default size');
      return;
    }
    setSessionRect(key, spot, true);
    commit();
  }

  /** @param {string} key */
  function syncFeatureFlagDisabled(key) {
    const s = getSettings();
    if (key === 'weather') {
      if (s.weather?.enabled) {
        store.updateSettings({ weather: { ...(s.weather || {}), enabled: false } });
      }
      return;
    }
    const widgetFlagKey = key === 'tasks' ? 'todo' : key;
    if (key !== 'clock' && key !== 'search' && s.widgets && s.widgets[widgetFlagKey] === true) {
      store.updateSettings({ widgets: { ...(s.widgets || {}), [widgetFlagKey]: false } });
    }
  }

  /** @param {string} key */
  function hideWidget(key) {
    const conf = session[key] || (session[key] = { x: null, y: null, w: null, h: null, hidden: false });
    conf.hidden = true;
    if (selectedKey === key) selectedKey = null;
    syncFeatureFlagDisabled(key);
    commit();
    showToast(`${getSpec(key).label || key} removed from home screen`);
  }

  /**
   * Keyboard move / resize by one grid step.
   * @param {string} key
   * @param {KeyboardEvent} e
   */
  function nudge(key, e) {
    const el = getEl(key);
    if (!el) return;
    const spec = getSpec(key);
    const r = liveRect(el);
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!steps) return;
    e.preventDefault();

    let next;
    if (e.shiftKey) {
      next = {
        ...r,
        width: clamp(r.width + steps[0] * GRID_CELL_WIDTH, spec.minW, spec.maxW),
        height: spec.resizeMode === 'horizontal' ? r.height : clamp(r.height + steps[1] * GRID_CELL_HEIGHT, spec.minH, spec.maxH)
      };
    } else {
      next = { ...r, left: r.left + steps[0] * GRID_STEP_X, top: r.top + steps[1] * GRID_STEP_Y };
    }
    if (!rectFits(next, otherRects(key), getBounds())) return;
    setSessionRect(key, next, Boolean(e.shiftKey));
    commit();
  }

  /* ---------- frames ---------- */

  /** @param {string} key */
  function buildFrame(key) {
    const spec = getSpec(key);
    const frame = document.createElement('div');
    frame.className = 'widget-drag-frame';
    frame.tabIndex = 0;
    frame.setAttribute('role', 'group');
    frame.setAttribute('aria-label', `${spec.label || key} widget. Arrow keys move, Shift plus arrows resize, Delete removes.`);

    const pill = document.createElement('div');
    pill.className = 'widget-drag-handle';
    pill.title = 'Drag to move';

    const grip = document.createElement('span');
    grip.className = 'widget-drag-grip';
    grip.innerHTML = ICON_GRIP_VERTICAL;
    pill.appendChild(grip);

    const label = document.createElement('span');
    label.className = 'widget-drag-label';
    label.textContent = spec.label || key;
    pill.appendChild(label);

    const group = document.createElement('span');
    group.className = 'widget-drag-btn-group';
    for (const name of Object.keys(spec.presets || {})) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'widget-drag-mini-btn widget-preset-btn';
      b.textContent = name;
      b.title = `Resize to ${name}`;
      b.setAttribute('aria-label', `Resize ${spec.label || key} to ${name}`);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); applyPreset(key, name); });
      group.appendChild(b);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'widget-drag-mini-btn widget-hide-btn';
    remove.title = 'Remove from home screen';
    remove.setAttribute('aria-label', `Remove ${spec.label || key}`);
    remove.innerHTML = ICON_CLOSE;
    remove.addEventListener('pointerdown', (e) => e.stopPropagation());
    remove.addEventListener('click', (e) => { e.stopPropagation(); hideWidget(key); });
    group.appendChild(remove);
    pill.appendChild(group);
    frame.appendChild(pill);

    const dirs = spec.resizeMode === 'horizontal' ? ['left', 'right'] : ['left', 'right', 'top', 'bottom', 'corner'];
    for (const dir of dirs) {
      const h = document.createElement('div');
      h.className = `widget-resize-handle widget-resize-handle-${dir}`;
      h.title = 'Drag to resize';
      h.addEventListener('pointerdown', (e) => beginInteraction(e, key, 'resize', /** @type {any} */ (dir)));
      frame.appendChild(h);
    }

    frame.addEventListener('pointerdown', (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      setSelected(key);
      if (t.closest('.widget-drag-mini-btn') || t.closest('.widget-resize-handle')) return;
      beginInteraction(e, key, 'move');
    });
    frame.addEventListener('focus', () => {
      if (active && selectedKey !== key) setSelected(key);
    });
    frame.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        hideWidget(key);
      } else {
        nudge(key, e);
      }
    });
    return frame;
  }

  function ensureFrames() {
    for (const { key } of WIDGETS) {
      const el = getEl(key);
      if (!el) continue;
      const frame = Array.from(el.children).find((c) => c.classList.contains('widget-drag-frame'));
      const show = active && isVisible(key);
      if (show && !frame) el.appendChild(buildFrame(key));
      else if (!show && frame) frame.remove();
    }
    updateSelectionUI();
  }

  /* ---------- bottom bar + widget tray ---------- */

  function hiddenWidgetKeys() {
    return WIDGETS.map((w) => w.key).filter((k) => Boolean(session[k]?.hidden) || !isVisible(k));
  }

  /**
   * Ensures a widget's feature flag is turned on in settings so it renders in the DOM when added from the tray.
   * @param {string} key
   */
  function enableWidgetFeature(key) {
    const s = getSettings();
    if (key === 'weather') {
      if (!s.weather?.enabled) {
        store.updateSettings({ weather: { ...(s.weather || {}), enabled: true } });
      }
      return;
    }
    const widgetFlagKey = key === 'tasks' ? 'todo' : key;
    if (s.widgets && s.widgets[widgetFlagKey] !== true && key !== 'clock' && key !== 'search') {
      store.updateSettings({ widgets: { ...(s.widgets || {}), [widgetFlagKey]: true } });
    }
  }

  function closeTray() {
    if (tray) {
      tray.remove();
      tray = null;
    }
    const trigger = bar?.querySelector('[data-he-action="add-widget"]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function toggleTray() {
    if (tray) {
      closeTray();
      return;
    }
    const trigger = bar?.querySelector('[data-he-action="add-widget"]');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    tray = document.createElement('div');
    tray.className = 'he-tray';
    tray.setAttribute('role', 'menu');
    const title = document.createElement('div');
    title.className = 'he-tray-title';
    title.textContent = 'Add widget';
    tray.appendChild(title);

    const keys = hiddenWidgetKeys();
    if (keys.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'he-tray-empty';
      empty.textContent = 'All widgets are on your home screen.';
      tray.appendChild(empty);
    }
    for (const key of keys) {
      const spec = getSpec(key);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'he-tray-item';
      item.setAttribute('role', 'menuitem');
      item.innerHTML = '<span class="he-tray-name"></span><span class="he-tray-hint"></span>';
      item.querySelector('.he-tray-name').textContent = spec.label || key;
      const cols = spec.defaultCols || 6;
      const rows = spec.defaultRows || 4;
      item.querySelector('.he-tray-hint').textContent = `${cols}×${rows} · Add`;
      item.addEventListener('click', () => { closeTray(); addWidget(key); });
      tray.appendChild(item);
    }
    bar?.appendChild(tray);
  }

  /** @param {string} key */
  function addWidget(key) {
    enableWidgetFeature(key);
    const spec = getSpec(key);
    const defaultW = clamp((spec.defaultCols || 6) * GRID_CELL_WIDTH, spec.minW, spec.maxW);
    const defaultH = clamp((spec.defaultRows || 4) * GRID_CELL_HEIGHT, spec.minH, spec.maxH);
    session[key] = {
      ...(session[key] || {}),
      hidden: false,
      x: null,
      y: null,
      w: FONT_SCALED.has(key) ? null : defaultW,
      h: FONT_SCALED.has(key) || spec.resizeMode === 'horizontal' ? null : defaultH
    };
    writeWidgets(clone(session));
    applySession();
    requestAnimationFrame(() => {
      const el = getEl(key);
      let r = el ? liveRect(el) : null;
      if (!el || !r || r.width < 20 || r.height < 10) {
        r = { left: 0, top: 0, width: defaultW, height: defaultH };
      }
      const p = panelRect();
      const spot = findFreeSpot(
        { left: p.width / 2 - r.width / 2, top: p.height / 2 - r.height / 2, width: r.width, height: r.height },
        otherRects(key),
        getBounds()
      );
      if (!spot) {
        session[key].hidden = true;
        syncFeatureFlagDisabled(key);
        writeWidgets(clone(session));
        applySession();
        showToast('No free space — make another widget smaller first');
        return;
      }
      setSessionRect(key, spot, !FONT_SCALED.has(key));
      commit();
      setSelected(key, { focusFrame: true });
    });
  }

  function resetLayout() {
    history.push(storedWidgets());
    const cleared = {};
    for (const { key } of WIDGETS) {
      cleared[key] = { x: null, y: null, w: null, h: null, hidden: Boolean(session[key]?.hidden) };
    }
    session = cleared;
    writeWidgets(clone(cleared));
    dirty = false;
    applySession();
    requestAnimationFrame(() => {
      if (!active) return;
      pinLayout();
      ensureFrames();
      renderBar();
    });
    showToast('Home screen reset to default layout');
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    restore(previous);
  }

  /**
   * Wires roving tabindex + arrow-key navigation when native `focusgroup` is unavailable.
   * @param {HTMLElement} toolbar
   */
  function wireToolbarFocusFallback(toolbar) {
    if ('focusGroup' in HTMLElement.prototype) return;
    const items = () => Array.from(toolbar.querySelectorAll('button'));
    const syncTabs = () => {
      const list = items();
      const focused = list.find((b) => b === document.activeElement);
      list.forEach((b, i) => {
        b.tabIndex = focused ? (b === focused ? 0 : -1) : (i === 0 ? 0 : -1);
      });
    };
    syncTabs();
    toolbar.addEventListener('focusin', (e) => {
      const target = /** @type {HTMLElement | null} */ (e.target);
      if (!target || target.tagName !== 'BUTTON') return;
      items().forEach((b) => { b.tabIndex = b === target ? 0 : -1; });
    });
    toolbar.addEventListener('keydown', (e) => {
      const list = items();
      const idx = list.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
      if (idx === -1 || list.length === 0) return;
      const rtl = typeof getComputedStyle === 'function' && getComputedStyle(toolbar).direction === 'rtl';
      let nextIdx = -1;
      if (e.key === 'ArrowRight') nextIdx = (idx + (rtl ? -1 : 1) + list.length) % list.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx + (rtl ? 1 : -1) + list.length) % list.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = list.length - 1;
      if (nextIdx !== -1) {
        e.preventDefault();
        list.forEach((b, i) => { b.tabIndex = i === nextIdx ? 0 : -1; });
        list[nextIdx].focus();
      }
    });
  }

  function renderBar() {
    if (!active) return;
    const prevAction = document.activeElement?.closest?.('#home-editor-bar button')?.getAttribute?.('data-he-action') || null;
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'home-editor-bar';
      bar.className = 'he-bar';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('focusgroup', 'toolbar wrap');
      bar.setAttribute('aria-label', 'Home screen editor');
      wireToolbarFocusFallback(bar);
      document.body.appendChild(bar);
    }
    closeTray();
    bar.textContent = '';

    const dot = document.createElement('span');
    dot.className = 'he-dot';
    dot.setAttribute('aria-hidden', 'true');
    bar.append(dot);

    /**
     * @param {object} opts
     * @param {string} opts.action
     * @param {string} opts.cls
     * @param {(e: MouseEvent) => void} opts.onclick
     * @param {string} [opts.text]
     * @param {string} [opts.icon]
     * @param {string} [opts.ariaLabel]
     * @param {string} [opts.title]
     * @param {boolean} [opts.disabled]
     * @param {boolean} [opts.pressed]
     */
    const mk = ({ action, cls, onclick, text = '', icon = '', ariaLabel = '', title = '', disabled = false, pressed }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `he-btn ${cls}`;
      b.dataset.heAction = action;
      if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'he-btn-icon';
        iconSpan.innerHTML = icon;
        b.appendChild(iconSpan);
      }
      if (text) {
        const labelSpan = document.createElement('span');
        labelSpan.className = 'he-btn-label';
        labelSpan.textContent = text;
        b.appendChild(labelSpan);
      }
      if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
      if (title) b.title = title;
      if (disabled) b.setAttribute('aria-disabled', 'true');
      if (typeof pressed === 'boolean') b.setAttribute('aria-pressed', String(pressed));
      b.addEventListener('click', (e) => {
        if (b.getAttribute('aria-disabled') === 'true') {
          e.preventDefault();
          return;
        }
        onclick(e);
      });
      return b;
    };

    if (selectedKey && isVisible(selectedKey)) {
      const spec = getSpec(selectedKey);
      const selEl = getEl(selectedKey);
      const r = selEl ? liveRect(selEl) : { width: 0, height: 0 };
      const cols = Math.max(1, Math.round(r.width / GRID_CELL_WIDTH));
      const rows = Math.max(1, Math.round(r.height / GRID_CELL_HEIGHT));

      const selBadge = document.createElement('div');
      selBadge.className = 'he-selected-badge';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'he-selected-name';
      nameSpan.textContent = spec.label || selectedKey;
      const dimsSpan = document.createElement('span');
      dimsSpan.className = 'he-selected-dims';
      dimsSpan.textContent = `${cols}×${rows}`;
      selBadge.append(nameSpan, dimsSpan);
      bar.append(selBadge);

      const activePreset = getMatchingPreset(selectedKey);
      const presetWrap = document.createElement('div');
      presetWrap.className = 'he-preset-group';
      presetWrap.setAttribute('role', 'group');
      presetWrap.setAttribute('aria-label', 'Widget size');
      for (const name of Object.keys(spec.presets || {})) {
        const isActive = activePreset === name;
        presetWrap.appendChild(
          mk({
            action: `preset-${name}`,
            text: name,
            cls: `he-btn-mini${isActive ? ' is-active' : ''}`,
            pressed: isActive,
            title: `Resize ${spec.label || selectedKey} to ${name}`,
            ariaLabel: `Size ${name}`,
            onclick: () => applyPreset(selectedKey, name)
          })
        );
      }

      const widgetActions = document.createElement('div');
      widgetActions.className = 'he-group';
      widgetActions.setAttribute('role', 'group');
      widgetActions.setAttribute('aria-label', 'Widget actions');
      widgetActions.append(
        mk({
          action: 'center',
          icon: ICON_ALIGN_CENTER,
          text: 'Center',
          cls: 'he-btn-ghost',
          title: 'Center horizontally',
          onclick: () => centerWidget(selectedKey)
        }),
        mk({
          action: 'reset-size',
          icon: ICON_RESET_SIZE,
          text: 'Reset Size',
          cls: 'he-btn-ghost',
          title: 'Restore default widget size',
          onclick: () => resetWidgetSize(selectedKey)
        }),
        mk({
          action: 'remove',
          icon: ICON_TRASH,
          cls: 'he-btn-icon-only he-btn-danger-ghost',
          ariaLabel: `Remove ${spec.label || selectedKey}`,
          title: 'Remove widget (Del)',
          onclick: () => hideWidget(selectedKey)
        })
      );

      const sep = document.createElement('span');
      sep.className = 'he-sep';
      sep.setAttribute('role', 'separator');
      sep.setAttribute('aria-orientation', 'vertical');

      bar.append(presetWrap, widgetActions, sep);
    } else {
      const hint = document.createElement('span');
      hint.className = 'he-hint';
      hint.textContent = 'Select a widget to adjust · drag to move';
      bar.append(hint);
    }

    const globalActions = document.createElement('div');
    globalActions.className = 'he-group';
    globalActions.setAttribute('role', 'group');
    globalActions.setAttribute('aria-label', 'Editor actions');

    const addBtn = mk({
      action: 'add-widget',
      icon: ICON_PLUS,
      text: 'Widget',
      cls: 'he-btn-ghost',
      title: 'Add a hidden widget back',
      onclick: toggleTray
    });
    addBtn.setAttribute('aria-haspopup', 'menu');
    addBtn.setAttribute('aria-expanded', 'false');

    globalActions.append(
      addBtn,
      mk({
        action: 'undo',
        icon: ICON_UNDO,
        cls: 'he-btn-icon-only he-btn-ghost',
        ariaLabel: 'Undo last change',
        title: 'Undo last change',
        disabled: history.length === 0,
        onclick: undo
      }),
      mk({
        action: 'reset-layout',
        icon: ICON_REFRESH,
        text: 'Reset',
        cls: 'he-btn-ghost',
        title: 'Restore the default layout',
        onclick: resetLayout
      }),
      mk({
        action: 'back-to-menu',
        icon: ICON_ARROW_LEFT,
        text: 'Menu',
        cls: 'he-btn-ghost',
        ariaLabel: 'Back to Settings menu',
        title: 'Return to Settings menu',
        onclick: () => {
          const targetTab = getReturnToMenuTab() || 'widgets';
          setEditMode(false);
          import('../ui/drawer.js')
            .then((m) => m.openDrawer(targetTab))
            .catch((err) => console.error('Failed to open settings menu', err));
        }
      }),
      mk({
        action: 'done',
        icon: ICON_CHECK,
        text: 'Done',
        cls: 'he-btn-primary',
        title: 'Finish editing (Esc)',
        onclick: () => setEditMode(false)
      })
    );

    bar.append(globalActions);

    if (!('focusGroup' in HTMLElement.prototype)) {
      const btns = Array.from(bar.querySelectorAll('button'));
      const restore = prevAction ? btns.find((b) => b.dataset.heAction === prevAction) : null;
      btns.forEach((b, i) => {
        b.tabIndex = restore ? (b === restore ? 0 : -1) : (i === 0 ? 0 : -1);
      });
      if (restore) restore.focus({ preventScroll: true });
    } else if (prevAction) {
      const restore = bar.querySelector(`button[data-he-action="${prevAction}"]`);
      if (restore instanceof HTMLElement) restore.focus({ preventScroll: true });
    }
  }

  /* ---------- lifecycle ---------- */

  function enter() {
    if (active) return;
    active = true;
    dirty = false;
    history = [];
    selectedKey = null;
    session = storedWidgets();
    for (const { key } of WIDGETS) {
      if (!session[key]) session[key] = { x: null, y: null, w: null, h: null, hidden: false };
    }
    pinLayout();
    ensureFrames();
    const pendingKey = consumePendingWidgetSelection();
    if (pendingKey && isVisible(pendingKey)) {
      setSelected(pendingKey, { focusFrame: true });
    } else {
      renderBar();
    }
    observer?.observe(heroPanel, { childList: true, subtree: true });
  }

  function exit() {
    if (!active) return;
    active = false;
    selectedKey = null;
    observer?.disconnect();
    closeTray();
    hideGhost();
    bar?.remove();
    bar = null;
    ensureFrames();
    // Re-apply what is actually stored (reverts the temporary pin if nothing changed)
    applyWidgetPositions(heroPanel, getSettings().hero?.widgets);
  }

  const onPanelPointerDown = (/** @type {PointerEvent} */ e) => {
    if (!active) return;
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.closest('.widget-drag-frame')) {
      setSelected(null);
    }
  };
  heroPanel.addEventListener('pointerdown', onPanelPointerDown);

  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (active && e.key === 'Escape' && !document.querySelector('dialog[open]')) {
      if (tray) closeTray();
      else if (selectedKey) setSelected(null);
      else setEditMode(false);
    }
  };
  const onResize = () => {
    if (!active) return;
    applySession();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
  }

  const unsubscribe = onEditModeChange((enabled) => (enabled ? enter() : exit()));
  const unsubscribeFocus = onWidgetFocusRequest((key) => {
    if (!active || !key) return;
    requestAnimationFrame(() => {
      if (active && isVisible(key)) {
        setSelected(key, { focusFrame: true });
      }
    });
  });
  if (getEditMode()) enter();

  return {
    destroy() {
      exit();
      unsubscribe();
      unsubscribeFocus();
      heroPanel.removeEventListener('pointerdown', onPanelPointerDown);
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('resize', onResize);
      }
    }
  };
}
