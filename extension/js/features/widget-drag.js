// @ts-check

/** Grid unit dimensions (Android-style cell increments in px) */
export const GRID_CELL_WIDTH = 60;
export const GRID_CELL_HEIGHT = 40;

/** Widget resizing specifications and constraints */
export const WIDGET_GRID_SPECS = {
  search: {
    label: 'Search',
    resizeMode: 'horizontal', // Android-style: Search bar only resizes width
    minW: 240,
    maxW: 960,
    minH: 44,
    maxH: 80,
    defaultCols: 7,
    defaultRows: 1,
    presets: { S: [5, 1], M: [7, 1], L: [10, 1] }
  },
  clock: {
    label: 'Clock',
    resizeMode: 'both',
    minW: 220,
    maxW: 1000,
    minH: 80,
    maxH: 600,
    defaultCols: 7,
    defaultRows: 4,
    presets: { S: [5, 3], M: [7, 4], L: [10, 5] }
  },
  speeddial: {
    label: 'Speed Dial',
    resizeMode: 'both',
    minW: 240,
    maxW: 1000,
    minH: 120,
    maxH: 700,
    defaultCols: 7,
    defaultRows: 5,
    presets: { S: [5, 4], M: [7, 5], L: [9, 6] }
  },
  timer: {
    label: 'Timer',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 160,
    maxH: 500,
    defaultCols: 6,
    defaultRows: 5,
    presets: { S: [5, 4], M: [6, 5], L: [8, 6] }
  },
  tasks: {
    label: 'To-do',
    resizeMode: 'both',
    minW: 220,
    maxW: 800,
    minH: 140,
    maxH: 800,
    defaultCols: 6,
    defaultRows: 6,
    presets: { S: [5, 4], M: [6, 6], L: [8, 8] }
  },
  notes: {
    label: 'Notes',
    resizeMode: 'both',
    minW: 220,
    maxW: 800,
    minH: 140,
    maxH: 800,
    defaultCols: 6,
    defaultRows: 6,
    presets: { S: [5, 4], M: [6, 6], L: [8, 8] }
  },
  weather: {
    label: 'Weather',
    resizeMode: 'both',
    minW: 220,
    maxW: 700,
    minH: 80,
    maxH: 400,
    defaultCols: 6,
    defaultRows: 2,
    presets: { S: [5, 2], M: [6, 2], L: [8, 3] }
  },
  quote: {
    label: 'Focus Quote',
    resizeMode: 'both',
    minW: 220,
    maxW: 800,
    minH: 120,
    maxH: 400,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 4], M: [6, 4], L: [8, 5] }
  },
  glance: {
    label: 'At a Glance',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 120,
    maxH: 380,
    defaultCols: 6,
    defaultRows: 3,
    presets: { S: [5, 3], M: [6, 4], L: [8, 4] }
  },
  habits: {
    label: 'Habit Grid',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 140,
    maxH: 520,
    defaultCols: 6,
    defaultRows: 5,
    presets: { S: [5, 4], M: [6, 5], L: [8, 6] }
  },
  worldclock: {
    label: 'World Clock',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 120,
    maxH: 480,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 3], M: [6, 4], L: [8, 5] }
  },
  countdown: {
    label: 'Countdown',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 130,
    maxH: 480,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 3], M: [6, 4], L: [8, 5] }
  },
  soundscapes: {
    label: 'Soundscapes',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 160,
    maxH: 420,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 4], M: [6, 5], L: [8, 6] }
  },
  voicememo: {
    label: 'Voice & Scratch',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 140,
    maxH: 520,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 4], M: [6, 4], L: [8, 6] }
  },
  pulse: {
    label: 'Device Pulse',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 150,
    maxH: 420,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 4], M: [6, 4], L: [8, 5] }
  },
  clipboard: {
    label: 'Clipboard Pins',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 130,
    maxH: 480,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 3], M: [6, 4], L: [8, 5] }
  },
  calculator: {
    label: 'Calculator',
    resizeMode: 'both',
    minW: 240,
    maxW: 720,
    minH: 220,
    maxH: 540,
    defaultCols: 5,
    defaultRows: 7,
    presets: { S: [4, 6], M: [5, 7], L: [7, 8] }
  },
  readlater: {
    label: 'Reading Queue',
    resizeMode: 'both',
    minW: 240,
    maxW: 800,
    minH: 140,
    maxH: 520,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [5, 4], M: [6, 4], L: [8, 6] }
  }
};

/**
 * Converts a percentage [0, 100] to pixels.
 * @param {number} pct
 * @param {number} totalPx
 * @returns {number}
 */
export function pctToPx(pct, totalPx) {
  if (typeof pct !== 'number' || typeof totalPx !== 'number') return 0;
  return (pct / 100) * totalPx;
}

/**
 * Converts pixels to a percentage [0, 100].
 * @param {number} px
 * @param {number} totalPx
 * @returns {number}
 */
export function pxToPct(px, totalPx) {
  if (typeof px !== 'number' || typeof totalPx !== 'number' || totalPx <= 0) return 0;
  return (px / totalPx) * 100;
}

/**
 * Snaps a target pixel coordinate to nearby guide lines within a threshold.
 *
 * @param {object} params
 * @param {number} params.targetPx
 * @param {number[]} [params.guides=[]]
 * @param {number} [params.threshold=8]
 * @param {boolean} [params.disabled=false]
 * @returns {{ snapped: boolean, value: number }}
 */
export function snapToGuides({ targetPx, guides = [], threshold = 8, disabled = false }) {
  if (disabled || !Array.isArray(guides) || guides.length === 0) {
    return { snapped: false, value: targetPx };
  }

  let closestGuide = null;
  let minDiff = Infinity;

  for (const g of guides) {
    const diff = Math.abs(targetPx - g);
    if (diff <= threshold && diff < minDiff) {
      minDiff = diff;
      closestGuide = g;
    }
  }

  if (closestGuide !== null) {
    return { snapped: true, value: closestGuide };
  }

  return { snapped: false, value: targetPx };
}

/**
 * Snaps a pixel dimension to the nearest grid cell increment.
 * @param {number} px
 * @param {number} cellSize
 * @param {number} minPx
 * @param {number} maxPx
 * @param {boolean} [disabled=false]
 * @returns {number}
 */
export function snapToGridDimension(px, cellSize, minPx, maxPx, disabled = false) {
  if (disabled) {
    return Math.max(minPx, Math.min(maxPx, Math.round(px)));
  }
  const cells = Math.max(1, Math.round(px / cellSize));
  const snapped = cells * cellSize;
  return Math.max(minPx, Math.min(maxPx, snapped));
}

/**
 * Calculates Android-style grid columns and rows for a given width and height.
 * @param {number} w
 * @param {number} h
 * @param {number} [cellW=GRID_CELL_WIDTH]
 * @param {number} [cellH=GRID_CELL_HEIGHT]
 * @returns {{ cols: number, rows: number }}
 */
export function getGridUnits(w, h, cellW = GRID_CELL_WIDTH, cellH = GRID_CELL_HEIGHT) {
  const cols = Math.max(1, Math.round(w / cellW));
  const rows = Math.max(1, Math.round(h / cellH));
  return { cols, rows };
}

/**
 * Clamps widget center percentage coordinates so the widget stays entirely on screen
 * and respects floating dock safe zones.
 *
 * @param {object} params
 * @param {number} params.xPct Viewport center X percentage
 * @param {number} params.yPct Viewport center Y percentage
 * @param {number} params.widthPx Widget width in px
 * @param {number} params.heightPx Widget height in px
 * @param {number} params.viewportWidth Viewport width in px
 * @param {number} params.viewportHeight Viewport height in px
 * @param {'top'|'bottom'|'left'|'right'|'off'} [params.dockPosition='off']
 * @param {number} [params.dockSize=64] Dock margin reservation
 * @returns {{ xPct: number, yPct: number }} Clamped center percentages rounded to 1 decimal
 */
export function clampPosition({
  xPct,
  yPct,
  widthPx,
  heightPx,
  viewportWidth,
  viewportHeight,
  dockPosition = 'off',
  dockSize = 64
}) {
  const vW = Math.max(1, viewportWidth || 1024);
  const vH = Math.max(1, viewportHeight || 768);
  const w = Math.max(10, widthPx || 100);
  const h = Math.max(10, heightPx || 100);

  const halfW = w / 2;
  const halfH = h / 2;

  let minX = halfW;
  let maxX = vW - halfW;
  let minY = halfH;
  let maxY = vH - halfH;

  // Dock avoidance bounds
  if (dockPosition === 'top') {
    minY = Math.max(minY, dockSize + halfH);
  } else if (dockPosition === 'bottom') {
    maxY = Math.min(maxY, vH - dockSize - halfH);
  } else if (dockPosition === 'left') {
    minX = Math.max(minX, dockSize + halfW);
  } else if (dockPosition === 'right') {
    maxX = Math.min(maxX, vW - dockSize - halfW);
  }

  // Handle small viewports gracefully
  if (minX > maxX) maxX = minX;
  if (minY > maxY) maxY = minY;

  const currentCx = pctToPx(xPct, vW);
  const currentCy = pctToPx(yPct, vH);

  const clampedCx = Math.max(minX, Math.min(maxX, currentCx));
  const clampedCy = Math.max(minY, Math.min(maxY, currentCy));

  const finalXPct = Math.round(pxToPct(clampedCx, vW) * 10) / 10;
  const finalYPct = Math.round(pxToPct(clampedCy, vH) * 10) / 10;

  return { xPct: finalXPct, yPct: finalYPct };
}

function setCssVar(el, name, value) {
  if (!el || !el.style) return;
  if (typeof el.style.setProperty === 'function') {
    if (el.style.getPropertyValue?.(name) !== value) {
      el.style.setProperty(name, value);
    }
  } else {
    el.style[name] = value;
  }
}

function clearCssVar(el, name) {
  if (!el || !el.style) return;
  if (typeof el.style.removeProperty === 'function') {
    el.style.removeProperty(name);
  } else {
    delete el.style[name];
  }
}

function getClockWidthFactor(text, isMono) {
  if (!text) return isMono ? 6.6 : 5.15;
  const hasAmPm = /\b(AM|PM)\b/i.test(text);
  const hasSeconds = (text.match(/:/g) || []).length >= 2;
  if (isMono) {
    if (hasAmPm && hasSeconds) return 6.7;
    if (!hasAmPm && hasSeconds) return 5.1;
    if (hasAmPm && !hasSeconds) return 5.1;
    return 3.4;
  }
  if (hasAmPm && hasSeconds) return 5.15;
  if (!hasAmPm && hasSeconds) return 4.05;
  if (hasAmPm && !hasSeconds) return 3.95;
  return 2.75;
}

/**
 * Scales the resized clock widget's typography, spacing, and padding to fill its box cleanly.
 * @param {HTMLElement | null} headerEl
 * @param {number | null} [wOverride]
 * @param {number | null} [hOverride]
 */
export function syncClockBoxScale(headerEl, wOverride = null, hOverride = null) {
  if (!headerEl || !headerEl.style) return;
  const hasResizedAttr = headerEl.dataset?.resizedW === 'true' || headerEl.dataset?.resizedH === 'true';
  if (typeof wOverride !== 'number' && typeof hOverride !== 'number' && !hasResizedAttr) return;

  const parsedW = parseFloat(headerEl.style.width);
  const parsedH = parseFloat(headerEl.style.height);
  const w = typeof wOverride === 'number' ? wOverride : (Number.isFinite(parsedW) && parsedW > 0 ? parsedW : 400);
  const h = typeof hOverride === 'number' ? hOverride : (Number.isFinite(parsedH) && parsedH > 0 ? parsedH : 160);

  const padX = Math.max(12, Math.min(28, Math.round(w * 0.04)));
  const padY = Math.max(8, Math.min(20, Math.round(h * 0.06)));
  const innerW = Math.max(120, w - padX * 2);
  const innerH = Math.max(48, h - padY * 2);

  const clockEl = typeof headerEl.querySelector === 'function' ? headerEl.querySelector('#clock-display') : null;
  const secondTzEl = typeof headerEl.querySelector === 'function' ? headerEl.querySelector('#clock-second-tz') : null;
  const countdownEl = typeof headerEl.querySelector === 'function' ? headerEl.querySelector('#countdown-display') : null;

  const isMono = typeof document !== 'undefined' && document.documentElement?.getAttribute?.('data-font') === 'mono';
  const wFactor = getClockWidthFactor(clockEl?.textContent?.trim() || '', isMono);
  const extraRows =
    (secondTzEl && secondTzEl.style?.display !== 'none' ? 1 : 0) +
    (countdownEl && countdownEl.style?.display !== 'none' ? 1 : 0);
  const hFactor = 1.36 + extraRows * 0.24;

  let fontSize = Math.max(24, Math.min(180, Math.round(Math.min(innerW / wFactor, innerH / hFactor))));

  const applyClockVars = (size) => {
    const metaSize = Math.max(11, Math.min(24, Math.round(size * 0.19)));
    const gap = Math.max(4, Math.min(18, Math.round(size * 0.11)));
    setCssVar(headerEl, '--hero-clock-size', `${size}px`);
    setCssVar(headerEl, '--clock-meta-size', `${metaSize}px`);
    setCssVar(headerEl, '--clock-box-gap', `${gap}px`);
    setCssVar(headerEl, '--clock-box-pad-x', `${padX}px`);
    setCssVar(headerEl, '--clock-box-pad-y', `${padY}px`);
  };

  applyClockVars(fontSize);

  // Guard against wider OS/locale fonts overflowing horizontally in a live browser
  if (clockEl && typeof clockEl.scrollWidth === 'number' && clockEl.scrollWidth > innerW) {
    fontSize = Math.max(24, Math.floor(fontSize * (innerW / clockEl.scrollWidth) * 0.98));
    applyClockVars(fontSize);
  }
}

/**
 * Applies saved widget positions to hero elements.
 *
 * @param {HTMLElement | null} heroPanel
 * @param {Record<string, { x: number|null, y: number|null, w: number|null, h?: number|null, hidden?: boolean }>} [widgetsConfig]
 */
export function applyWidgetPositions(heroPanel, widgetsConfig) {
  if (!heroPanel || typeof heroPanel.querySelector !== 'function' || !widgetsConfig) return;

  const widgetSelectors = {
    clock: '.dashboard-header',
    search: '.search-container',
    weather: '#hero-weather-slot',
    tasks: '#hero-tasks-slot',
    notes: '#hero-notes-slot',
    timer: '#hero-timer-slot',
    speeddial: '#hero-speeddial-slot',
    quote: '#hero-quote-slot',
    glance: '#hero-glance-slot',
    habits: '#hero-habits-slot',
    worldclock: '#hero-worldclock-slot',
    countdown: '#hero-countdown-slot',
    soundscapes: '#hero-soundscapes-slot',
    voicememo: '#hero-voicememo-slot',
    pulse: '#hero-pulse-slot',
    clipboard: '#hero-clipboard-slot',
    calculator: '#hero-calculator-slot',
    readlater: '#hero-readlater-slot'
  };

  for (const [key, sel] of Object.entries(widgetSelectors)) {
    const el = heroPanel.querySelector(sel);
    if (!el) continue;

    const conf = widgetsConfig[key];
    if (!conf) continue;

    if (conf.hidden) {
      el.style.display = 'none';
      continue;
    } else if (el.style.display === 'none') {
      el.style.display = '';
    }

    if (typeof conf.x === 'number' && typeof conf.y === 'number') {
      el.dataset.freeDrag = 'true';
      el.style.position = 'absolute';
      el.style.left = `${conf.x}%`;
      el.style.top = `${conf.y}%`;
      el.style.transform = 'translate(-50%, -50%)';
      el.style.margin = '0';
      el.style.zIndex = '15';
    } else {
      delete el.dataset.freeDrag;
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.transform = '';
      el.style.margin = '';
      el.style.zIndex = '';
    }

    if (typeof conf.w === 'number') {
      el.style.width = `${conf.w}px`;
      el.style.maxWidth = `${conf.w}px`;
      el.dataset.resizedW = 'true';
    } else {
      el.style.width = '';
      el.style.maxWidth = '';
      delete el.dataset.resizedW;
    }

    if (typeof conf.h === 'number') {
      el.style.height = `${conf.h}px`;
      el.style.minHeight = `${conf.h}px`;
      el.dataset.resizedH = 'true';
    } else {
      el.style.height = '';
      el.style.minHeight = '';
      delete el.dataset.resizedH;
    }

    // Dynamic clock font scaling so digits expand or contract proportionally with widget dimensions
    if (key === 'clock') {
      if (typeof conf.w === 'number' || typeof conf.h === 'number') {
        syncClockBoxScale(el, conf.w, conf.h);
      } else {
        clearCssVar(el, '--hero-clock-size');
        clearCssVar(el, '--clock-meta-size');
        clearCssVar(el, '--clock-box-gap');
        clearCssVar(el, '--clock-box-pad-x');
        clearCssVar(el, '--clock-box-pad-y');
      }
    }

    // Dynamic timer digits scaling when timer widget is resized on the Android grid
    if (key === 'timer') {
      if (typeof conf.w === 'number' || typeof conf.h === 'number') {
        const w = conf.w || 320;
        const h = conf.h || 180;
        const autoTimerSize = Math.max(24, Math.min(72, Math.round(Math.min(w / 7, h * 0.22))));
        if (typeof el.style.setProperty === 'function') {
          el.style.setProperty('--timer-digits-size', `${autoTimerSize}px`);
        } else {
          el.style['--timer-digits-size'] = `${autoTimerSize}px`;
        }
      } else {
        if (typeof el.style.removeProperty === 'function') {
          el.style.removeProperty('--timer-digits-size');
        } else {
          delete el.style['--timer-digits-size'];
        }
      }
    }
  }
}
