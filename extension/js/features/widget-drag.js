// @ts-check
import { onEditModeChange, getEditMode } from './edit-mode.js';
import { showToast } from '../ui/toasts.js';
import { ICON_REFRESH, ICON_CLOSE, ICON_GRIP_VERTICAL } from '../ui/icons.js';

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
    minW: 220,
    maxW: 800,
    minH: 120,
    maxH: 500,
    defaultCols: 6,
    defaultRows: 4,
    presets: { S: [4, 4], M: [6, 4], L: [8, 5] }
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
    minH: 100,
    maxH: 400,
    defaultCols: 6,
    defaultRows: 3,
    presets: { S: [5, 3], M: [6, 3], L: [8, 4] }
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
    quote: '#hero-quote-slot'
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
        const w = conf.w || 400;
        const h = conf.h || 160;
        const autoFontSize = Math.max(32, Math.min(140, Math.round(Math.min(w / 6.2, h * 0.65))));
        if (typeof el.style.setProperty === 'function') {
          el.style.setProperty('--hero-clock-size', `${autoFontSize}px`);
        } else {
          el.style['--hero-clock-size'] = `${autoFontSize}px`;
        }
      } else {
        if (typeof el.style.removeProperty === 'function') {
          el.style.removeProperty('--hero-clock-size');
        } else {
          delete el.style['--hero-clock-size'];
        }
      }
    }

    // Dynamic timer digits scaling when timer widget is resized on the Android grid
    if (key === 'timer') {
      if (typeof conf.w === 'number' || typeof conf.h === 'number') {
        const w = conf.w || 320;
        const h = conf.h || 180;
        const autoTimerSize = Math.max(24, Math.min(72, Math.round(Math.min(w / 7, h * 0.28))));
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

/**
 * Initializes Android-style grid widget dragging & resizing on the hero panel.
 * Active when edit mode (`e`) is on.
 *
 * @param {HTMLElement} heroPanel
 * @param {any} store
 */
export function initWidgetDrag(heroPanel, store) {
  if (!heroPanel || typeof heroPanel.querySelector !== 'function' || !store || typeof document === 'undefined') return;

  const widgetSelectors = {
    clock: '.dashboard-header',
    search: '.search-container',
    weather: '#hero-weather-slot',
    tasks: '#hero-tasks-slot',
    notes: '#hero-notes-slot',
    timer: '#hero-timer-slot',
    speeddial: '#hero-speeddial-slot',
    quote: '#hero-quote-slot'
  };

  function updateEditFrames(isEditMode) {
    for (const [key, sel] of Object.entries(widgetSelectors)) {
      const widgetEl = heroPanel.querySelector(sel);
      if (!widgetEl) continue;

      const spec = WIDGET_GRID_SPECS[key] || {
        label: key,
        resizeMode: 'both',
        minW: 200,
        maxW: 800,
        minH: 80,
        maxH: 500,
        presets: { S: [4, 3], M: [6, 4], L: [8, 6] }
      };

      let frame = widgetEl.querySelector('.widget-drag-frame');

      if (isEditMode) {
        if (!frame) {
          frame = document.createElement('div');
          frame.className = 'widget-drag-frame';
          frame.setAttribute('tabindex', '0');
          frame.setAttribute('role', 'region');
          frame.setAttribute('aria-label', `${key} widget layout: arrows move, + / - width, [ / ] height, R reset, Delete hide`);

          // Drag handle pill at top with widget label + Android grid presets + Reset/Hide
          const dragHandle = document.createElement('div');
          dragHandle.className = 'widget-drag-handle';
          dragHandle.setAttribute('title', 'Drag to reposition widget on the grid');

          const gripSpan = document.createElement('span');
          gripSpan.className = 'widget-drag-grip';
          gripSpan.innerHTML = ICON_GRIP_VERTICAL;
          dragHandle.appendChild(gripSpan);

          const labelSpan = document.createElement('span');
          labelSpan.className = 'widget-drag-label';
          labelSpan.textContent = spec.label || key;
          dragHandle.appendChild(labelSpan);

          // Action buttons group (Presets S/M/L + Reset & Hide)
          const btnGroup = document.createElement('span');
          btnGroup.className = 'widget-drag-btn-group';

          if (spec.presets) {
            for (const [presetName, [cols, rows]] of Object.entries(spec.presets)) {
              const presetBtn = document.createElement('button');
              presetBtn.type = 'button';
              presetBtn.className = 'widget-drag-mini-btn widget-preset-btn';
              presetBtn.textContent = presetName;
              const targetW = Math.max(spec.minW, Math.min(spec.maxW, cols * GRID_CELL_WIDTH));
              const targetH = spec.resizeMode === 'horizontal'
                ? null
                : Math.max(spec.minH, Math.min(spec.maxH, rows * GRID_CELL_HEIGHT));
              presetBtn.title = spec.resizeMode === 'horizontal'
                ? `Resize to ${presetName} (${cols} cols • ${targetW}px)`
                : `Resize to ${presetName} (${cols}×${rows} cells • ${targetW}×${targetH}px)`;
              presetBtn.setAttribute('aria-label', `Resize ${key} to ${presetName}`);
              presetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const s = store.getState ? store.getState().settings : store.get().settings;
                const previous = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
                const cur = previous[key] || {};
                /** @type {any} */
                const nextConf = { ...cur, w: targetW };
                if (targetH !== null) {
                  nextConf.h = targetH;
                }
                store.updateSettings({
                  hero: {
                    ...(s.hero || {}),
                    widgets: {
                      ...previous,
                      [key]: nextConf
                    }
                  }
                });
                const dimLabel = targetH !== null ? `${cols} × ${rows} (${targetW}×${targetH}px)` : `${cols} cols (${targetW}px)`;
                showToast(`Resized ${spec.label || key} to ${dimLabel}`, () => {
                  store.updateSettings({ hero: { ...(s.hero || {}), widgets: previous } });
                });
              });
              btnGroup.appendChild(presetBtn);
            }
          }

          const resetBtn = document.createElement('button');
          resetBtn.type = 'button';
          resetBtn.className = 'widget-drag-mini-btn';
          resetBtn.title = 'Reset to default slot and size (R)';
          resetBtn.setAttribute('aria-label', `Reset ${key} widget`);
          resetBtn.innerHTML = ICON_REFRESH;
          resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = store.getState ? store.getState().settings : store.get().settings;
            const previous = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
            store.updateSettings({
              hero: {
                ...(s.hero || {}),
                widgets: {
                  ...previous,
                  [key]: { x: null, y: null, w: null, h: null, hidden: false }
                }
              }
            });
            showToast(`Reset ${key} to default slot & size`);
          });

          const hideBtn = document.createElement('button');
          hideBtn.type = 'button';
          hideBtn.className = 'widget-drag-mini-btn widget-hide-btn';
          hideBtn.title = 'Hide widget (Delete)';
          hideBtn.setAttribute('aria-label', `Hide ${key} widget`);
          hideBtn.innerHTML = ICON_CLOSE;
          hideBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = store.getState ? store.getState().settings : store.get().settings;
            const previous = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
            store.updateSettings({
              hero: {
                ...(s.hero || {}),
                widgets: {
                  ...previous,
                  [key]: { ...(previous[key] || {}), hidden: true }
                }
              }
            });
            showToast(`Hidden ${key}`, () => {
              store.updateSettings({ hero: { ...(s.hero || {}), widgets: previous } });
            });
          });

          btnGroup.appendChild(resetBtn);
          btnGroup.appendChild(hideBtn);
          dragHandle.appendChild(btnGroup);
          frame.appendChild(dragHandle);

          // Live Android grid badge
          const sizeBadge = document.createElement('div');
          sizeBadge.className = 'widget-size-badge';
          frame.appendChild(sizeBadge);

          // Android Grid Resize Handles
          // 1. Right handle (Width)
          const handleRight = document.createElement('div');
          handleRight.className = 'widget-resize-handle widget-resize-handle-right';
          handleRight.setAttribute('title', 'Drag to resize width (+ / -)');
          frame.appendChild(handleRight);
          setupPointerResize(widgetEl, handleRight, 'right', key, sizeBadge, spec);

          // 2. Left handle (Width)
          const handleLeft = document.createElement('div');
          handleLeft.className = 'widget-resize-handle widget-resize-handle-left';
          handleLeft.setAttribute('title', 'Drag to resize width (+ / -)');
          frame.appendChild(handleLeft);
          setupPointerResize(widgetEl, handleLeft, 'left', key, sizeBadge, spec);

          // 3. Height handles (for widgets that allow vertical resizing)
          if (spec.resizeMode !== 'horizontal') {
            const handleBottom = document.createElement('div');
            handleBottom.className = 'widget-resize-handle widget-resize-handle-bottom';
            handleBottom.setAttribute('title', 'Drag to resize height ([ / ])');
            frame.appendChild(handleBottom);
            setupPointerResize(widgetEl, handleBottom, 'bottom', key, sizeBadge, spec);

            const handleTop = document.createElement('div');
            handleTop.className = 'widget-resize-handle widget-resize-handle-top';
            handleTop.setAttribute('title', 'Drag to resize height ([ / ])');
            frame.appendChild(handleTop);
            setupPointerResize(widgetEl, handleTop, 'top', key, sizeBadge, spec);

            const handleCorner = document.createElement('div');
            handleCorner.className = 'widget-resize-handle widget-resize-handle-corner';
            handleCorner.setAttribute('title', 'Drag corner to resize width & height');
            frame.appendChild(handleCorner);
            setupPointerResize(widgetEl, handleCorner, 'corner', key, sizeBadge, spec);
          }

          widgetEl.appendChild(frame);
          setupPointerDrag(widgetEl, dragHandle, frame, key, sizeBadge, spec);
          setupKeyboardControl(widgetEl, frame, key, spec);
        }
        frame.style.display = 'block';
      } else {
        if (frame) {
          frame.style.display = 'none';
        }
      }
    }
  }

  function setupPointerDrag(widgetEl, dragHandle, frame, widgetKey, sizeBadge, spec) {
    let startX = 0;
    let startY = 0;
    let startXPct = 50;
    let startYPct = 50;
    let isDragging = false;
    let lastClampedXPct = 50;
    let lastClampedYPct = 50;

    const startDrag = (e) => {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.widget-drag-mini-btn')) return;
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.widget-resize-handle')) return;
      e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
      isDragging = true;
      if (typeof dragHandle.setPointerCapture === 'function' && e.pointerId !== undefined) {
        try { dragHandle.setPointerCapture(e.pointerId); } catch {}
      }

      startX = e.clientX || 0;
      startY = e.clientY || 0;

      const rect = widgetEl.getBoundingClientRect ? widgetEl.getBoundingClientRect() : { left: 0, top: 0, width: 300, height: 100 };
      const parentRect = heroPanel.getBoundingClientRect ? heroPanel.getBoundingClientRect() : { left: 0, top: 0, width: 1000, height: 800 };
      const cx = (rect.left + rect.width / 2) - parentRect.left;
      const cy = (rect.top + rect.height / 2) - parentRect.top;

      startXPct = pxToPct(cx, parentRect.width);
      startYPct = pxToPct(cy, parentRect.height);
      lastClampedXPct = startXPct;
      lastClampedYPct = startYPct;

      widgetEl.classList.add('is-dragging');
    };

    dragHandle.addEventListener('pointerdown', startDrag);
    if (frame) {
      frame.addEventListener('pointerdown', (e) => {
        if (e.target === frame) {
          startDrag(e);
        }
      });
    }

    const moveDrag = (e) => {
      if (!isDragging) return;
      e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();

      const deltaX = (e.clientX || 0) - startX;
      const deltaY = (e.clientY || 0) - startY;

      const parentRect = heroPanel.getBoundingClientRect ? heroPanel.getBoundingClientRect() : { left: 0, top: 0, width: 1000, height: 800 };
      let newCx = pctToPx(startXPct, parentRect.width) + deltaX;
      let newCy = pctToPx(startYPct, parentRect.height) + deltaY;

      const disableSnap = Boolean(e.altKey);

      // Snap to Android grid cell positions (30px / 20px sub-grid) or center axis guides
      const snapX = snapToGuides({
        targetPx: newCx,
        guides: [parentRect.width / 2],
        threshold: 12,
        disabled: disableSnap
      });
      if (snapX.snapped) {
        newCx = snapX.value;
      } else if (!disableSnap) {
        const stepX = GRID_CELL_WIDTH / 2;
        newCx = Math.round(newCx / stepX) * stepX;
      }

      const snapY = snapToGuides({
        targetPx: newCy,
        guides: [parentRect.height / 2],
        threshold: 12,
        disabled: disableSnap
      });
      if (snapY.snapped) {
        newCy = snapY.value;
      } else if (!disableSnap) {
        const stepY = GRID_CELL_HEIGHT / 2;
        newCy = Math.round(newCy / stepY) * stepY;
      }

      const newXPct = pxToPct(newCx, parentRect.width);
      const newYPct = pxToPct(newCy, parentRect.height);

      const s = store.getState ? store.getState().settings : store.get().settings;
      const dockPos = s.dock?.position || 'off';
      const curW = widgetEl.offsetWidth || 300;
      const curH = widgetEl.offsetHeight || 100;

      const clamped = clampPosition({
        xPct: newXPct,
        yPct: newYPct,
        widthPx: curW,
        heightPx: curH,
        viewportWidth: parentRect.width,
        viewportHeight: parentRect.height,
        dockPosition: dockPos
      });

      lastClampedXPct = clamped.xPct;
      lastClampedYPct = clamped.yPct;

      widgetEl.style.position = 'absolute';
      widgetEl.style.left = `${clamped.xPct}%`;
      widgetEl.style.top = `${clamped.yPct}%`;
      widgetEl.style.transform = 'translate(-50%, -50%)';
      widgetEl.style.margin = '0';
      widgetEl.dataset.freeDrag = 'true';

      if (sizeBadge) {
        const { cols, rows } = getGridUnits(curW, curH);
        const gridCol = Math.max(1, Math.round(pctToPx(clamped.xPct, parentRect.width) / GRID_CELL_WIDTH));
        const gridRow = Math.max(1, Math.round(pctToPx(clamped.yPct, parentRect.height) / GRID_CELL_HEIGHT));
        sizeBadge.textContent = `Col ${gridCol}, Row ${gridRow} • ${cols}×${rows} cells`;
        sizeBadge.style.display = 'block';
      }
    };

    dragHandle.addEventListener('pointermove', moveDrag);
    if (frame) frame.addEventListener('pointermove', moveDrag);

    const finishDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      widgetEl.classList.remove('is-dragging');
      if (sizeBadge) {
        sizeBadge.style.display = 'none';
      }

      if (typeof dragHandle.releasePointerCapture === 'function' && e?.pointerId !== undefined) {
        try { dragHandle.releasePointerCapture(e.pointerId); } catch {}
      }

      const parentRect = heroPanel.getBoundingClientRect ? heroPanel.getBoundingClientRect() : { left: 0, top: 0, width: 1000, height: 800 };
      const rect = widgetEl.getBoundingClientRect ? widgetEl.getBoundingClientRect() : { left: 0, top: 0, width: widgetEl.offsetWidth || 300, height: widgetEl.offsetHeight || 100 };

      const s = store.getState ? store.getState().settings : store.get().settings;
      const dockPos = s.dock?.position || 'off';

      const clamped = clampPosition({
        xPct: lastClampedXPct,
        yPct: lastClampedYPct,
        widthPx: rect.width || widgetEl.offsetWidth || 300,
        heightPx: rect.height || widgetEl.offsetHeight || 100,
        viewportWidth: parentRect.width,
        viewportHeight: parentRect.height,
        dockPosition: dockPos
      });

      const previousWidgets = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
      const updatedWidgets = {
        ...previousWidgets,
        [widgetKey]: {
          ...(previousWidgets[widgetKey] || {}),
          x: clamped.xPct,
          y: clamped.yPct
        }
      };

      store.updateSettings({
        hero: {
          ...(s.hero || {}),
          widgets: updatedWidgets
        }
      });

      showToast(`Repositioned ${spec?.label || widgetKey}`, () => {
        store.updateSettings({ hero: { ...(s.hero || {}), widgets: previousWidgets } });
      });
    };

    dragHandle.addEventListener('pointerup', finishDrag);
    dragHandle.addEventListener('pointercancel', finishDrag);
    if (frame) {
      frame.addEventListener('pointerup', finishDrag);
      frame.addEventListener('pointercancel', finishDrag);
    }
  }

  function setupPointerResize(widgetEl, resizeHandle, direction, widgetKey, sizeBadge, spec) {
    let startX = 0;
    let startY = 0;
    let startWidth = 300;
    let startHeight = 150;
    let lastWidth = 300;
    let lastHeight = 150;
    let startXPct = 50;
    let startYPct = 50;
    let isResizing = false;

    resizeHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
      isResizing = true;
      if (typeof resizeHandle.setPointerCapture === 'function' && e.pointerId !== undefined) {
        try { resizeHandle.setPointerCapture(e.pointerId); } catch {}
      }

      const rect = widgetEl.getBoundingClientRect ? widgetEl.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const parentRect = heroPanel.getBoundingClientRect ? heroPanel.getBoundingClientRect() : { left: 0, top: 0, width: 1000, height: 800 };

      startX = e.clientX || 0;
      startY = e.clientY || 0;
      startWidth = widgetEl.offsetWidth || Math.round(rect.width) || spec.minW;
      startHeight = widgetEl.offsetHeight || Math.round(rect.height) || spec.minH;
      lastWidth = startWidth;
      lastHeight = startHeight;

      const s = store.getState ? store.getState().settings : store.get().settings;
      const widgetConf = s.hero?.widgets?.[widgetKey] || {};
      if (typeof widgetConf.x === 'number') {
        startXPct = widgetConf.x;
      } else if (rect.width > 0 && parentRect.width > 0) {
        startXPct = pxToPct((rect.left + rect.width / 2) - parentRect.left, parentRect.width);
      } else {
        startXPct = 50;
      }

      if (typeof widgetConf.y === 'number') {
        startYPct = widgetConf.y;
      } else if (rect.height > 0 && parentRect.height > 0) {
        startYPct = pxToPct((rect.top + rect.height / 2) - parentRect.top, parentRect.height);
      } else {
        startYPct = 50;
      }

      widgetEl.classList.add('is-resizing');
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.add('is-widget-resizing');
      }

      if (sizeBadge) {
        const { cols, rows } = getGridUnits(startWidth, startHeight);
        sizeBadge.textContent = spec.resizeMode === 'horizontal'
          ? `${cols} cols • ${startWidth}px`
          : `${cols} × ${rows} cells • ${startWidth}×${startHeight}px`;
        sizeBadge.style.display = 'block';
      }
    });

    resizeHandle.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();

      const deltaX = (e.clientX || 0) - startX;
      const deltaY = (e.clientY || 0) - startY;
      const isAlt = Boolean(e.altKey);

      let currentW = startWidth;
      let currentH = startHeight;
      const isFreeDrag = widgetEl.dataset.freeDrag === 'true';
      const parentRect = heroPanel.getBoundingClientRect ? heroPanel.getBoundingClientRect() : { width: 1000, height: 800 };

      // Calculate width
      if (direction === 'right' || direction === 'corner') {
        const rawW = startWidth + deltaX;
        currentW = snapToGridDimension(rawW, GRID_CELL_WIDTH, spec.minW, spec.maxW, isAlt);
      } else if (direction === 'left') {
        const rawW = startWidth - deltaX;
        currentW = snapToGridDimension(rawW, GRID_CELL_WIDTH, spec.minW, spec.maxW, isAlt);
      }

      // Calculate height
      if (spec.resizeMode !== 'horizontal') {
        if (direction === 'bottom' || direction === 'corner') {
          const rawH = startHeight + deltaY;
          currentH = snapToGridDimension(rawH, GRID_CELL_HEIGHT, spec.minH, spec.maxH, isAlt);
        } else if (direction === 'top') {
          const rawH = startHeight - deltaY;
          currentH = snapToGridDimension(rawH, GRID_CELL_HEIGHT, spec.minH, spec.maxH, isAlt);
        }
      }

      lastWidth = currentW;
      lastHeight = currentH;

      // Apply width
      widgetEl.style.width = `${currentW}px`;
      widgetEl.style.maxWidth = `${currentW}px`;
      widgetEl.dataset.resizedW = 'true';

      // Apply height
      if (spec.resizeMode !== 'horizontal') {
        widgetEl.style.height = `${currentH}px`;
        widgetEl.style.minHeight = `${currentH}px`;
        widgetEl.dataset.resizedH = 'true';
      }

      // Scale clock font on the fly
      if (widgetKey === 'clock') {
        const autoFontSize = Math.max(32, Math.min(140, Math.round(Math.min(currentW / 6.2, currentH * 0.65))));
        if (typeof widgetEl.style.setProperty === 'function') {
          widgetEl.style.setProperty('--hero-clock-size', `${autoFontSize}px`);
        } else {
          widgetEl.style['--hero-clock-size'] = `${autoFontSize}px`;
        }
      }

      // Scale timer digits on the fly
      if (widgetKey === 'timer') {
        const autoTimerSize = Math.max(24, Math.min(72, Math.round(Math.min(currentW / 7, currentH * 0.28))));
        if (typeof widgetEl.style.setProperty === 'function') {
          widgetEl.style.setProperty('--timer-digits-size', `${autoTimerSize}px`);
        } else {
          widgetEl.style['--timer-digits-size'] = `${autoTimerSize}px`;
        }
      }

      // If free-dragged, smoothly keep the opposite edge pinned
      if (isFreeDrag) {
        let newXPct = startXPct;
        let newYPct = startYPct;

        if (direction === 'right') {
          const deltaWPx = currentW - startWidth;
          newXPct = pxToPct(pctToPx(startXPct, parentRect.width) + deltaWPx / 2, parentRect.width);
        } else if (direction === 'left') {
          const deltaWPx = currentW - startWidth;
          newXPct = pxToPct(pctToPx(startXPct, parentRect.width) - deltaWPx / 2, parentRect.width);
        }

        if (direction === 'bottom') {
          const deltaHPx = currentH - startHeight;
          newYPct = pxToPct(pctToPx(startYPct, parentRect.height) + deltaHPx / 2, parentRect.height);
        } else if (direction === 'top') {
          const deltaHPx = currentH - startHeight;
          newYPct = pxToPct(pctToPx(startYPct, parentRect.height) - deltaHPx / 2, parentRect.height);
        } else if (direction === 'corner') {
          const deltaWPx = currentW - startWidth;
          const deltaHPx = currentH - startHeight;
          newXPct = pxToPct(pctToPx(startXPct, parentRect.width) + deltaWPx / 2, parentRect.width);
          newYPct = pxToPct(pctToPx(startYPct, parentRect.height) + deltaHPx / 2, parentRect.height);
        }

        widgetEl.style.left = `${newXPct}%`;
        widgetEl.style.top = `${newYPct}%`;
      }

      if (sizeBadge) {
        const { cols, rows } = getGridUnits(currentW, currentH);
        sizeBadge.textContent = spec.resizeMode === 'horizontal'
          ? `${cols} cols • ${currentW}px`
          : `${cols} × ${rows} cells • ${currentW}×${currentH}px`;
      }
    });

    const finishResize = (e) => {
      if (!isResizing) return;
      isResizing = false;
      widgetEl.classList.remove('is-resizing');
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.remove('is-widget-resizing');
      }
      if (sizeBadge) {
        sizeBadge.style.display = 'none';
      }

      if (typeof resizeHandle.releasePointerCapture === 'function' && e?.pointerId !== undefined) {
        try { resizeHandle.releasePointerCapture(e.pointerId); } catch {}
      }

      const finalWidth = lastWidth || widgetEl.offsetWidth || startWidth;
      const finalHeight = spec.resizeMode === 'horizontal' ? null : (lastHeight || widgetEl.offsetHeight || startHeight);

      const s = store.getState ? store.getState().settings : store.get().settings;
      const previousWidgets = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
      const existingWidget = previousWidgets[widgetKey] || {};

      let finalXPct = existingWidget.x;
      let finalYPct = existingWidget.y;

      if (widgetEl.dataset.freeDrag === 'true' && widgetEl.style.left) {
        const parsedX = parseFloat(widgetEl.style.left);
        const parsedY = parseFloat(widgetEl.style.top);
        if (!isNaN(parsedX)) finalXPct = Math.round(parsedX * 10) / 10;
        if (!isNaN(parsedY)) finalYPct = Math.round(parsedY * 10) / 10;
      }

      /** @type {any} */
      const updatedWidget = {
        ...existingWidget,
        x: finalXPct,
        y: finalYPct,
        w: finalWidth
      };
      if (finalHeight != null) {
        updatedWidget.h = finalHeight;
      }

      store.updateSettings({
        hero: {
          ...(s.hero || {}),
          widgets: {
            ...previousWidgets,
            [widgetKey]: updatedWidget
          }
        }
      });

      const { cols, rows } = getGridUnits(finalWidth, finalHeight || spec.minH);
      const label = spec.resizeMode === 'horizontal' ? `${cols} cols (${finalWidth}px)` : `${cols} × ${rows} (${finalWidth}×${finalHeight}px)`;
      showToast(`Resized ${widgetKey} to ${label}`, () => {
        store.updateSettings({ hero: { ...(s.hero || {}), widgets: previousWidgets } });
      });
    };

    resizeHandle.addEventListener('pointerup', finishResize);
    resizeHandle.addEventListener('pointercancel', finishResize);
  }

  function setupKeyboardControl(widgetEl, frame, widgetKey, spec) {
    frame.addEventListener('keydown', (e) => {
      const s = store.getState ? store.getState().settings : store.get().settings;
      const widgetConf = s.hero?.widgets?.[widgetKey] || {};

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        // Reset widget to default fluid flow & size
        const previous = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
        store.updateSettings({
          hero: {
            ...(s.hero || {}),
            widgets: {
              ...previous,
              [widgetKey]: { x: null, y: null, w: null, h: null, hidden: false }
            }
          }
        });
        showToast(`Reset ${widgetKey} to default slot`);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const previous = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
        store.updateSettings({
          hero: {
            ...(s.hero || {}),
            widgets: {
              ...previous,
              [widgetKey]: { ...(previous[widgetKey] || {}), hidden: true }
            }
          }
        });
        showToast(`Hidden ${widgetKey}`, () => {
          store.updateSettings({ hero: { ...(s.hero || {}), widgets: previous } });
        });
        return;
      }

      // Width resizing: + / = to grow, - / _ to shrink
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        e.preventDefault();
        const delta = (e.key === '+' || e.key === '=') ? (e.shiftKey ? 40 : 20) : (e.shiftKey ? -40 : -20);
        const currentW = typeof widgetConf.w === 'number' ? widgetConf.w : (widgetEl.offsetWidth || spec.minW);
        const newW = Math.max(spec.minW, Math.min(spec.maxW, currentW + delta));
        widgetEl.style.width = `${newW}px`;
        widgetEl.style.maxWidth = `${newW}px`;

        if (widgetKey === 'clock') {
          const currentH = typeof widgetConf.h === 'number' ? widgetConf.h : (widgetEl.offsetHeight || 160);
          const autoFontSize = Math.max(32, Math.min(140, Math.round(Math.min(newW / 6.2, currentH * 0.65))));
          if (typeof widgetEl.style.setProperty === 'function') {
            widgetEl.style.setProperty('--hero-clock-size', `${autoFontSize}px`);
          } else {
            widgetEl.style['--hero-clock-size'] = `${autoFontSize}px`;
          }
        }

        store.updateSettings({
          hero: {
            ...(s.hero || {}),
            widgets: {
              ...(s.hero?.widgets || {}),
              [widgetKey]: {
                ...widgetConf,
                w: newW
              }
            }
          }
        });
        showToast(`Resized ${widgetKey} width to ${newW}px`);
        return;
      }

      // Height resizing: [ to shrink height, ] to grow height
      if (spec.resizeMode !== 'horizontal' && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        const delta = e.key === ']' ? (e.shiftKey ? 40 : 20) : (e.shiftKey ? -40 : -20);
        const currentH = typeof widgetConf.h === 'number' ? widgetConf.h : (widgetEl.offsetHeight || spec.minH);
        const newH = Math.max(spec.minH, Math.min(spec.maxH, currentH + delta));
        widgetEl.style.height = `${newH}px`;
        widgetEl.style.minHeight = `${newH}px`;

        if (widgetKey === 'clock') {
          const currentW = typeof widgetConf.w === 'number' ? widgetConf.w : (widgetEl.offsetWidth || 300);
          const autoFontSize = Math.max(32, Math.min(140, Math.round(Math.min(currentW / 6.2, newH * 0.65))));
          if (typeof widgetEl.style.setProperty === 'function') {
            widgetEl.style.setProperty('--hero-clock-size', `${autoFontSize}px`);
          } else {
            widgetEl.style['--hero-clock-size'] = `${autoFontSize}px`;
          }
        }

        store.updateSettings({
          hero: {
            ...(s.hero || {}),
            widgets: {
              ...(s.hero?.widgets || {}),
              [widgetKey]: {
                ...widgetConf,
                h: newH
              }
            }
          }
        });
        showToast(`Resized ${widgetKey} height to ${newH}px`);
        return;
      }

      // Reposition with arrow keys
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const parentRect = heroPanel.getBoundingClientRect ? heroPanel.getBoundingClientRect() : { width: 1000, height: 800 };
        const currentXPct = typeof widgetConf.x === 'number' ? widgetConf.x : 50;
        const currentYPct = typeof widgetConf.y === 'number' ? widgetConf.y : 50;

        const clamped = clampPosition({
          xPct: currentXPct + dx,
          yPct: currentYPct + dy,
          widthPx: widgetEl.offsetWidth || 300,
          heightPx: widgetEl.offsetHeight || 100,
          viewportWidth: parentRect.width,
          viewportHeight: parentRect.height,
          dockPosition: s.dock?.position || 'off'
        });

        store.updateSettings({
          hero: {
            ...(s.hero || {}),
            widgets: {
              ...(s.hero?.widgets || {}),
              [widgetKey]: {
                ...widgetConf,
                x: clamped.xPct,
                y: clamped.yPct
              }
            }
          }
        });
      }
    });
  }

  // Subscribe to edit mode state
  onEditModeChange((enabled) => {
    updateEditFrames(enabled);
  });

  // Re-verify edit frames whenever store updates
  if (typeof store.subscribe === 'function') {
    store.subscribe(() => {
      if (getEditMode()) {
        updateEditFrames(true);
      }
    });
  }

  // Apply initial positions
  const currentSettings = store.getState ? store.getState().settings : store.get().settings;
  applyWidgetPositions(heroPanel, currentSettings.hero?.widgets);
  updateEditFrames(getEditMode());
}
