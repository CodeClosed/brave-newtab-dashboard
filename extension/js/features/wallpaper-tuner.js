// @ts-check
import { BUNDLED_WALLPAPERS } from './wallpaper.js';
import { showToast } from '../ui/toasts.js';

let activeTunerPopover = null;

/**
 * Closes the active wallpaper tuner popover if currently open.
 */
export function closeWallpaperTuner() {
  if (activeTunerPopover && activeTunerPopover.parentNode) {
    activeTunerPopover.parentNode.removeChild(activeTunerPopover);
  }
  activeTunerPopover = null;
}

/**
 * Opens or toggles the Wallpaper Tuner popover anchored near the anchor element.
 * Provides live previews for wallpapers, dim, blur, and glass opacity with full undo.
 *
 * @param {HTMLElement} anchorBtn
 * @param {any} store
 * @returns {HTMLElement | null}
 */
export function toggleWallpaperTuner(anchorBtn, store) {
  if (activeTunerPopover) {
    closeWallpaperTuner();
    return null;
  }

  if (typeof document === 'undefined') return null;

  const currentSettings = store.getState ? store.getState().settings : store.get().settings;
  const initialSnapshot = {
    background: JSON.parse(JSON.stringify(currentSettings.background || { type: 'none', value: null, dim: 0.35 })),
    glass: JSON.parse(JSON.stringify(currentSettings.glass || { blur: 16, opacity: 0.62 }))
  };

  const popover = document.createElement('div');
  popover.className = 'wallpaper-tuner-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Wallpaper and Glass Tuner');

  // Header
  const header = document.createElement('div');
  header.className = 'wallpaper-tuner-header';

  const title = document.createElement('span');
  title.className = 'wallpaper-tuner-title';
  title.textContent = 'Wallpaper & Glass';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'wallpaper-tuner-close-btn';
  closeBtn.setAttribute('aria-label', 'Close tuner');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeWallpaperTuner());

  header.appendChild(title);
  header.appendChild(closeBtn);
  popover.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'wallpaper-tuner-body';

  // 1. Wallpaper Thumbnails Row
  const thumbSection = document.createElement('div');
  thumbSection.className = 'wallpaper-tuner-section';

  const thumbLabel = document.createElement('label');
  thumbLabel.className = 'wallpaper-tuner-label';
  thumbLabel.textContent = 'Presets';
  thumbSection.appendChild(thumbLabel);

  const thumbGrid = document.createElement('div');
  thumbGrid.className = 'wallpaper-tuner-thumbs-grid';

  const activeId = currentSettings.background?.activeId || '';

  BUNDLED_WALLPAPERS.forEach((wp) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `wallpaper-thumb-card${activeId === wp.id ? ' is-active' : ''}`;
    card.title = wp.name;

    const img = document.createElement('img');
    const assetUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL(`assets/wallpapers/${wp.file}`)
      : `assets/wallpapers/${wp.file}`;
    img.src = assetUrl;
    img.alt = wp.name;
    img.className = 'wallpaper-thumb-img';

    const cardTitle = document.createElement('span');
    cardTitle.className = 'wallpaper-thumb-title';
    cardTitle.textContent = wp.name;

    card.appendChild(img);
    card.appendChild(cardTitle);

    card.addEventListener('click', () => {
      const s = store.getState ? store.getState().settings : store.get().settings;
      store.updateSettings({
        background: {
          ...(s.background || {}),
          type: 'image',
          activeId: wp.id,
          autoReadability: true
        }
      });
      thumbGrid.querySelectorAll('.wallpaper-thumb-card').forEach(c => c.classList.remove('is-active'));
      card.classList.add('is-active');
    });

    thumbGrid.appendChild(card);
  });

  thumbSection.appendChild(thumbGrid);
  body.appendChild(thumbSection);

  // 2. Dim Slider
  const dimSection = document.createElement('div');
  dimSection.className = 'wallpaper-tuner-section';
  const dimValue = Math.round((currentSettings.background?.dim ?? 0.35) * 100);

  const dimHeader = document.createElement('div');
  dimHeader.className = 'wallpaper-tuner-slider-header';
  const dimLabel = document.createElement('label');
  dimLabel.className = 'wallpaper-tuner-label';
  dimLabel.textContent = 'Wallpaper Dimming';
  const dimValSpan = document.createElement('span');
  dimValSpan.className = 'wallpaper-tuner-val';
  dimValSpan.textContent = `${dimValue}%`;
  dimHeader.appendChild(dimLabel);
  dimHeader.appendChild(dimValSpan);

  const dimSlider = document.createElement('input');
  dimSlider.type = 'range';
  dimSlider.min = '0';
  dimSlider.max = '80';
  dimSlider.value = String(dimValue);
  dimSlider.className = 'wallpaper-tuner-slider';
  dimSlider.addEventListener('input', () => {
    const val = parseInt(dimSlider.value, 10);
    dimValSpan.textContent = `${val}%`;
    const s = store.getState ? store.getState().settings : store.get().settings;
    store.updateSettings({
      background: {
        ...(s.background || {}),
        dim: val / 100
      }
    });
  });

  dimSection.appendChild(dimHeader);
  dimSection.appendChild(dimSlider);
  body.appendChild(dimSection);

  // 3. Blur Slider
  const blurSection = document.createElement('div');
  blurSection.className = 'wallpaper-tuner-section';
  const blurValue = currentSettings.background?.blur ?? 0;

  const blurHeader = document.createElement('div');
  blurHeader.className = 'wallpaper-tuner-slider-header';
  const blurLabel = document.createElement('label');
  blurLabel.className = 'wallpaper-tuner-label';
  blurLabel.textContent = 'Wallpaper Blur';
  const blurValSpan = document.createElement('span');
  blurValSpan.className = 'wallpaper-tuner-val';
  blurValSpan.textContent = `${blurValue}px`;
  blurHeader.appendChild(blurLabel);
  blurHeader.appendChild(blurValSpan);

  const blurSlider = document.createElement('input');
  blurSlider.type = 'range';
  blurSlider.min = '0';
  blurSlider.max = '20';
  blurSlider.value = String(blurValue);
  blurSlider.className = 'wallpaper-tuner-slider';
  blurSlider.addEventListener('input', () => {
    const val = parseInt(blurSlider.value, 10);
    blurValSpan.textContent = `${val}px`;
    const s = store.getState ? store.getState().settings : store.get().settings;
    store.updateSettings({
      background: {
        ...(s.background || {}),
        blur: val
      }
    });
  });

  blurSection.appendChild(blurHeader);
  blurSection.appendChild(blurSlider);
  body.appendChild(blurSection);

  // 4. Glass Opacity Slider
  const glassSection = document.createElement('div');
  glassSection.className = 'wallpaper-tuner-section';
  const glassOpacityVal = Math.round((currentSettings.glass?.opacity ?? 0.62) * 100);

  const glassHeader = document.createElement('div');
  glassHeader.className = 'wallpaper-tuner-slider-header';
  const glassLabel = document.createElement('label');
  glassLabel.className = 'wallpaper-tuner-label';
  glassLabel.textContent = 'Glass Opacity';
  const glassValSpan = document.createElement('span');
  glassValSpan.className = 'wallpaper-tuner-val';
  glassValSpan.textContent = `${glassOpacityVal}%`;
  glassHeader.appendChild(glassLabel);
  glassHeader.appendChild(glassValSpan);

  const glassSlider = document.createElement('input');
  glassSlider.type = 'range';
  glassSlider.min = '40';
  glassSlider.max = '95';
  glassSlider.value = String(glassOpacityVal);
  glassSlider.className = 'wallpaper-tuner-slider';
  glassSlider.addEventListener('input', () => {
    const val = parseInt(glassSlider.value, 10);
    glassValSpan.textContent = `${val}%`;
    const s = store.getState ? store.getState().settings : store.get().settings;
    store.updateSettings({
      glass: {
        ...(s.glass || {}),
        opacity: val / 100
      }
    });
  });

  glassSection.appendChild(glassHeader);
  glassSection.appendChild(glassSlider);
  body.appendChild(glassSection);

  popover.appendChild(body);

  // Footer: Undo & Reset
  const footer = document.createElement('div');
  footer.className = 'wallpaper-tuner-footer';

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'btn-quiet';
  undoBtn.textContent = '↺ Revert changes';
  undoBtn.addEventListener('click', () => {
    store.updateSettings(initialSnapshot);
    closeWallpaperTuner();
    showToast('Reverted wallpaper adjustments');
  });

  footer.appendChild(undoBtn);
  popover.appendChild(footer);

  // Position popover near anchorBtn
  document.body.appendChild(popover);
  activeTunerPopover = popover;

  const rect = anchorBtn.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.left = `${Math.max(16, rect.left)}px`;
  popover.style.bottom = `${Math.max(16, (window.innerHeight - rect.top) + 8)}px`;

  // Close on outside click
  const handleOutsideClick = (e) => {
    if (activeTunerPopover && !activeTunerPopover.contains(e.target) && !anchorBtn.contains(e.target)) {
      closeWallpaperTuner();
      document.removeEventListener('pointerdown', handleOutsideClick);
    }
  };
  setTimeout(() => {
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('pointerdown', handleOutsideClick);
    }
  }, 50);

  return popover;
}
