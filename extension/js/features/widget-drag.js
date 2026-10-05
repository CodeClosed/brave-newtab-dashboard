// @ts-check
import { onEditModeChange, getEditMode } from './edit-mode.js';
import { showToast } from '../ui/toasts.js';

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
 * @param {Record<string, { x: number|null, y: number|null, w: number|null, hidden?: boolean }>} [widgetsConfig]
 */
export function applyWidgetPositions(heroPanel, widgetsConfig) {
  if (!heroPanel || !widgetsConfig) return;

  const widgetSelectors = {
    clock: '.dashboard-header',
    search: '.search-container',
    quote: '#quote-display',
    weather: '#hero-weather-slot',
    tasks: '#hero-tasks-slot'
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
    } else {
      el.style.width = '';
      el.style.maxWidth = '';
    }
  }
}

/**
 * Initializes free-drag widget editing on the hero panel.
 * Active when edit mode (`e`) is on.
 *
 * @param {HTMLElement} heroPanel
 * @param {any} store
 */
export function initWidgetDrag(heroPanel, store) {
  if (!heroPanel || !store || typeof document === 'undefined') return;

  const widgetSelectors = {
    clock: '.dashboard-header',
    search: '.search-container',
    quote: '#quote-display',
    weather: '#hero-weather-slot',
    tasks: '#hero-tasks-slot'
  };

  function updateEditFrames(isEditMode) {
    for (const [key, sel] of Object.entries(widgetSelectors)) {
      const widgetEl = heroPanel.querySelector(sel);
      if (!widgetEl) continue;

      let frame = widgetEl.querySelector('.widget-drag-frame');

      if (isEditMode) {
        if (!frame) {
          frame = document.createElement('div');
          frame.className = 'widget-drag-frame';
          frame.setAttribute('tabindex', '0');
          frame.setAttribute('role', 'region');
          frame.setAttribute('aria-label', `${key} widget layout: arrows move, + / - resize, R reset, Delete hide`);

          // Drag handle
          const dragHandle = document.createElement('div');
          dragHandle.className = 'widget-drag-handle';
          dragHandle.setAttribute('title', 'Drag anywhere to reposition');
          dragHandle.textContent = '⋮⋮';

          // Resize handle
          const resizeHandle = document.createElement('div');
          resizeHandle.className = 'widget-resize-handle';
          resizeHandle.setAttribute('title', 'Drag to resize width');

          frame.appendChild(dragHandle);
          frame.appendChild(resizeHandle);
          widgetEl.appendChild(frame);

          setupPointerDrag(widgetEl, dragHandle, key);
          setupPointerResize(widgetEl, resizeHandle, key);
          setupKeyboardControl(widgetEl, frame, key);
        }
        frame.style.display = 'block';
      } else {
        if (frame) {
          frame.style.display = 'none';
        }
      }
    }
  }

  function setupPointerDrag(widgetEl, dragHandle, widgetKey) {
    let startX = 0;
    let startY = 0;
    let startXPct = 50;
    let startYPct = 50;
    let isDragging = false;

    dragHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDragging = true;
      if (typeof dragHandle.setPointerCapture === 'function') {
        try { dragHandle.setPointerCapture(e.pointerId); } catch {}
      }

      startX = e.clientX;
      startY = e.clientY;

      const rect = widgetEl.getBoundingClientRect();
      const parentRect = heroPanel.getBoundingClientRect();
      const cx = (rect.left + rect.width / 2) - parentRect.left;
      const cy = (rect.top + rect.height / 2) - parentRect.top;

      startXPct = pxToPct(cx, parentRect.width);
      startYPct = pxToPct(cy, parentRect.height);

      widgetEl.classList.add('is-dragging');
    });

    dragHandle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      e.stopPropagation();
      e.preventDefault();

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const parentRect = heroPanel.getBoundingClientRect();
      const newCx = pctToPx(startXPct, parentRect.width) + deltaX;
      const newCy = pctToPx(startYPct, parentRect.height) + deltaY;

      let newXPct = pxToPct(newCx, parentRect.width);
      let newYPct = pxToPct(newCy, parentRect.height);

      const disableSnap = e.altKey;
      const snapX = snapToGuides({
        targetPx: newCx,
        guides: [parentRect.width / 2],
        threshold: 10,
        disabled: disableSnap
      });
      if (snapX.snapped) {
        newXPct = pxToPct(snapX.value, parentRect.width);
      }

      const snapY = snapToGuides({
        targetPx: newCy,
        guides: [parentRect.height / 2],
        threshold: 10,
        disabled: disableSnap
      });
      if (snapY.snapped) {
        newYPct = pxToPct(snapY.value, parentRect.height);
      }

      const s = store.getState ? store.getState().settings : store.get().settings;
      const dockPos = s.dock?.position || 'off';

      const clamped = clampPosition({
        xPct: newXPct,
        yPct: newYPct,
        widthPx: widgetEl.offsetWidth || 300,
        heightPx: widgetEl.offsetHeight || 100,
        viewportWidth: parentRect.width,
        viewportHeight: parentRect.height,
        dockPosition: dockPos
      });

      widgetEl.style.position = 'absolute';
      widgetEl.style.left = `${clamped.xPct}%`;
      widgetEl.style.top = `${clamped.yPct}%`;
      widgetEl.style.transform = 'translate(-50%, -50%)';
      widgetEl.style.margin = '0';
      widgetEl.dataset.freeDrag = 'true';
    });

    const finishDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      widgetEl.classList.remove('is-dragging');

      if (typeof dragHandle.releasePointerCapture === 'function') {
        try { dragHandle.releasePointerCapture(e.pointerId); } catch {}
      }

      const parentRect = heroPanel.getBoundingClientRect();
      const rect = widgetEl.getBoundingClientRect();
      const cx = (rect.left + rect.width / 2) - parentRect.left;
      const cy = (rect.top + rect.height / 2) - parentRect.top;

      const s = store.getState ? store.getState().settings : store.get().settings;
      const dockPos = s.dock?.position || 'off';

      const clamped = clampPosition({
        xPct: pxToPct(cx, parentRect.width),
        yPct: pxToPct(cy, parentRect.height),
        widthPx: rect.width,
        heightPx: rect.height,
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

      showToast(`Repositioned ${widgetKey}`, () => {
        store.updateSettings({ hero: { ...(s.hero || {}), widgets: previousWidgets } });
      });
    };

    dragHandle.addEventListener('pointerup', finishDrag);
    dragHandle.addEventListener('pointercancel', finishDrag);
  }

  function setupPointerResize(widgetEl, resizeHandle, widgetKey) {
    let startX = 0;
    let startWidth = 300;
    let isResizing = false;

    resizeHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isResizing = true;
      if (typeof resizeHandle.setPointerCapture === 'function') {
        try { resizeHandle.setPointerCapture(e.pointerId); } catch {}
      }

      startX = e.clientX;
      startWidth = widgetEl.offsetWidth || 300;
      widgetEl.classList.add('is-resizing');
    });

    resizeHandle.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      e.stopPropagation();
      e.preventDefault();

      const deltaX = (e.clientX - startX) * 2;
      const newWidth = Math.max(180, Math.min(800, Math.round(startWidth + deltaX)));

      widgetEl.style.width = `${newWidthpx(newWidth)}`;
      widgetEl.style.maxWidth = `${newWidthpx(newWidth)}`;
    });

    const finishResize = (e) => {
      if (!isResizing) return;
      isResizing = false;
      widgetEl.classList.remove('is-resizing');

      if (typeof resizeHandle.releasePointerCapture === 'function') {
        try { resizeHandle.releasePointerCapture(e.pointerId); } catch {}
      }

      const finalWidth = Math.max(180, Math.min(800, widgetEl.offsetWidth));
      const s = store.getState ? store.getState().settings : store.get().settings;
      const previousWidgets = JSON.parse(JSON.stringify(s.hero?.widgets || {}));

      store.updateSettings({
        hero: {
          ...(s.hero || {}),
          widgets: {
            ...previousWidgets,
            [widgetKey]: {
              ...(previousWidgets[widgetKey] || {}),
              w: finalWidth
            }
          }
        }
      });
    };

    resizeHandle.addEventListener('pointerup', finishResize);
    resizeHandle.addEventListener('pointercancel', finishResize);
  }

  function setupKeyboardControl(widgetEl, frame, widgetKey) {
    frame.addEventListener('keydown', (e) => {
      const s = store.getState ? store.getState().settings : store.get().settings;
      const widgetConf = s.hero?.widgets?.[widgetKey] || {};

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        // Reset widget to default fluid flow
        const previous = JSON.parse(JSON.stringify(s.hero?.widgets || {}));
        store.updateSettings({
          hero: {
            ...(s.hero || {}),
            widgets: {
              ...previous,
              [widgetKey]: { x: null, y: null, w: null, hidden: false }
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

      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const parentRect = heroPanel.getBoundingClientRect();
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

  function newWidthpx(w) {
    return `${w}px`;
  }

  // Subscribe to edit mode state
  onEditModeChange((enabled) => {
    updateEditFrames(enabled);
  });

  // Apply initial positions
  const currentSettings = store.getState ? store.getState().settings : store.get().settings;
  applyWidgetPositions(heroPanel, currentSettings.hero?.widgets);
  updateEditFrames(getEditMode());
}
