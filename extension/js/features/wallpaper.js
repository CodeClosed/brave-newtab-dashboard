// @ts-check
import {
  saveWallpaperRecord,
  getWallpaperRecord,
  getAllWallpaperRecords,
  deleteWallpaperRecord,
  getWallpaperCountAndSize
} from '../core/idb.js';
import { el, clearChildren } from '../utils/dom.js';
import { calculateDownscaleDimensions } from './theme.js';

export const MAX_WALLPAPERS = 10;
export const MAX_WALLPAPER_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const MAX_WALLPAPER_DIMENSION = 2560;
export const THUMBNAIL_MAX_DIMENSION = 160;

/**
 * Calculates relative luminance for an sRGB pixel according to WCAG 2.1 specs.
 * @param {number} r 0..255
 * @param {number} g 0..255
 * @param {number} b 0..255
 * @returns {number} 0..1
 */
export function calculatePixelLuminance(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map(val => {
    const sRGB = Math.max(0, Math.min(255, val)) / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * Computes mean, 10th percentile, and 90th percentile from luminance array.
 * @param {number[]} luminanceValues
 * @returns {{ mean: number, p10: number, p90: number }}
 */
export function computeLuminanceStats(luminanceValues) {
  if (!Array.isArray(luminanceValues) || luminanceValues.length === 0) {
    return { mean: 0.5, p10: 0.5, p90: 0.5 };
  }

  const sorted = [...luminanceValues].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Math.round((sum / sorted.length) * 1000) / 1000;

  const p10Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.1));
  const p90Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));

  const p10 = Math.round(sorted[p10Index] * 1000) / 1000;
  const p90 = Math.round(sorted[p90Index] * 1000) / 1000;

  return { mean, p10, p90 };
}

/**
 * Computes the recommended dimming overlay factor [0.15, 0.85] for auto-readability.
 * @param {{ mean?: number, p10?: number, p90?: number } | null} luminanceData
 * @param {boolean} [isDark=true]
 * @returns {number}
 */
export function calculateAutoReadabilityDim(luminanceData, isDark = true) {
  if (!luminanceData) return isDark ? 0.35 : 0.25;
  const p90 = typeof luminanceData.p90 === 'number' ? luminanceData.p90 : 0.5;
  const p10 = typeof luminanceData.p10 === 'number' ? luminanceData.p10 : 0.5;

  let requiredDim = 0.15;
  if (isDark) {
    const targetLuminance = 0.1833;
    if (p90 > targetLuminance) {
      requiredDim = 1 - (targetLuminance / p90);
    } else {
      requiredDim = 0.15;
    }
  } else {
    const targetLuminance = 0.175;
    if (p10 < targetLuminance) {
      requiredDim = (targetLuminance - p10) / (1 - p10);
    } else {
      requiredDim = 0.15;
    }
  }

  const clamped = Math.max(0.15, Math.min(0.85, requiredDim));
  return Math.round(clamped * 100) / 100;
}

/**
 * Processes a wallpaper image: downscales <= 2560px, compresses under 1.5MB,
 * generates 160px thumbnail, and extracts 32x32 luminance stats.
 *
 * @param {Blob | File} fileOrBlob
 * @returns {Promise<{ blob: Blob, thumbnailUrl: string, luminanceData: { mean: number, p10: number, p90: number }, width: number, height: number }>}
 */
export async function processWallpaperImage(fileOrBlob) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Canvas and Image not available'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const origWidth = img.width;
        const origHeight = img.height;

        // 1. Calculate main image dimensions (<= 2560px)
        let { width, height } = calculateDownscaleDimensions(origWidth, origHeight, MAX_WALLPAPER_DIMENSION);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Compress WebP / JPEG under 1.5MB
        const compressToBlob = async (q = 0.85) => {
          return new Promise((resBlob) => {
            canvas.toBlob((blob) => {
              if (blob) {
                resBlob(blob);
              } else {
                // Fallback to JPEG
                canvas.toBlob((jpegBlob) => {
                  resBlob(jpegBlob);
                }, 'image/jpeg', q);
              }
            }, 'image/webp', q);
          });
        };

        let quality = 0.85;
        let blob = await compressToBlob(quality);

        // If larger than MAX_WALLPAPER_BYTES, step down quality
        while (blob && blob.size > MAX_WALLPAPER_BYTES && quality > 0.4) {
          quality -= 0.15;
          blob = await compressToBlob(quality);
        }

        // If still too big, downscale dimension further
        while (blob && blob.size > MAX_WALLPAPER_BYTES && width > 800) {
          width = Math.round(width * 0.8);
          height = Math.round(height * 0.8);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          quality = 0.75;
          blob = await compressToBlob(quality);
        }

        if (!blob) {
          blob = fileOrBlob;
        }

        // 3. Generate 160px thumbnail
        const thumbDims = calculateDownscaleDimensions(origWidth, origHeight, THUMBNAIL_MAX_DIMENSION);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbDims.width;
        thumbCanvas.height = thumbDims.height;
        const thumbCtx = thumbCanvas.getContext('2d');
        let thumbnailUrl = '';
        if (thumbCtx) {
          thumbCtx.drawImage(img, 0, 0, thumbDims.width, thumbDims.height);
          thumbnailUrl = thumbCanvas.toDataURL('image/webp', 0.8);
          if (!thumbnailUrl || !thumbnailUrl.startsWith('data:')) {
            thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);
          }
        }

        // 4. Downsample to 32x32 for luminance stats
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 32;
        sampleCanvas.height = 32;
        const sampleCtx = sampleCanvas.getContext('2d');
        let luminanceData = { mean: 0.5, p10: 0.5, p90: 0.5 };
        if (sampleCtx) {
          sampleCtx.drawImage(img, 0, 0, 32, 32);
          const imgData = sampleCtx.getImageData(0, 0, 32, 32);
          const lumValues = [];
          if (imgData && imgData.data) {
            for (let i = 0; i < imgData.data.length; i += 4) {
              const r = imgData.data[i];
              const g = imgData.data[i + 1];
              const b = imgData.data[i + 2];
              lumValues.push(calculatePixelLuminance(r, g, b));
            }
          }
          luminanceData = computeLuminanceStats(lumValues);
        }

        resolve({
          blob,
          thumbnailUrl,
          luminanceData,
          width,
          height
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for processing'));
    };

    img.src = url;
  });
}

/**
 * Formats a byte number into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * Generates a random alphanumeric ID.
 * @param {string} [prefix='wp_']
 * @returns {string}
 */
export function generateWallpaperId(prefix = 'wp_') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Adds a new wallpaper to IndexedDB and the store's settings.
 * Enforces the MAX_WALLPAPERS cap.
 *
 * @param {Blob | File} fileOrBlob
 * @param {string} name
 * @param {any} storeInstance
 * @param {{ luminanceData?: any, focal?: { x: number, y: number }, thumbnailUrl?: string }} [options]
 * @returns {Promise<{ success: boolean, id?: string, reason?: string }>}
 */
export async function addWallpaperToLibrary(fileOrBlob, name, storeInstance, options = {}) {
  const currentSettings = storeInstance.get().settings;
  const bgConfig = currentSettings.background || {};
  const existingWallpapers = Array.isArray(bgConfig.wallpapers) ? bgConfig.wallpapers : [];

  if (existingWallpapers.length >= MAX_WALLPAPERS) {
    return {
      success: false,
      reason: `Wallpaper library full (maximum ${MAX_WALLPAPERS} wallpapers)`
    };
  }

  let finalBlob = fileOrBlob;
  let finalThumbnail = options.thumbnailUrl || null;
  let finalLuminance = options.luminanceData || null;

  if (typeof document !== 'undefined' && typeof Image !== 'undefined' && !options.thumbnailUrl) {
    try {
      const processed = await processWallpaperImage(fileOrBlob);
      finalBlob = processed.blob;
      finalThumbnail = processed.thumbnailUrl;
      finalLuminance = processed.luminanceData;
    } catch {
      // Graceful fallback to raw blob if canvas isn't available
    }
  }

  const id = generateWallpaperId();
  const size = finalBlob.size || fileOrBlob.size || 0;
  const createdAt = new Date().toISOString();

  const record = {
    id,
    name: name || 'wallpaper',
    blob: finalBlob,
    size,
    createdAt,
    luminanceData: finalLuminance,
    focal: options.focal || { x: 0.5, y: 0.5 },
    thumbnailUrl: finalThumbnail
  };

  try {
    await saveWallpaperRecord(record);

    const newMetadata = {
      id,
      name: record.name,
      size,
      createdAt,
      luminanceData: record.luminanceData,
      focal: record.focal,
      thumbnailUrl: record.thumbnailUrl
    };

    const nextWallpapers = [newMetadata, ...existingWallpapers];

    storeInstance.updateSettings({
      background: {
        ...bgConfig,
        type: 'image',
        activeId: id,
        wallpapers: nextWallpapers,
        focal: record.focal
      }
    });

    return { success: true, id };
  } catch (err) {
    return { success: false, reason: err?.message || 'Failed to save wallpaper' };
  }
}

/**
 * Removes a wallpaper from IndexedDB and the store's settings.
 *
 * @param {string} id
 * @param {any} storeInstance
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function removeWallpaperFromLibrary(id, storeInstance) {
  try {
    await deleteWallpaperRecord(id);

    const currentSettings = storeInstance.get().settings;
    const bgConfig = currentSettings.background || {};
    const existingWallpapers = Array.isArray(bgConfig.wallpapers) ? bgConfig.wallpapers : [];

    const nextWallpapers = existingWallpapers.filter(w => w.id !== id);
    let nextActiveId = bgConfig.activeId;
    let nextType = bgConfig.type;

    if (nextActiveId === id) {
      if (nextWallpapers.length > 0) {
        nextActiveId = nextWallpapers[0].id;
      } else {
        nextActiveId = null;
        if (nextType === 'image') {
          nextType = 'none';
        }
      }
    }

    storeInstance.updateSettings({
      background: {
        ...bgConfig,
        type: nextType,
        activeId: nextActiveId,
        wallpapers: nextWallpapers
      }
    });

    return { success: true };
  } catch (err) {
    return { success: false, reason: err?.message || 'Failed to delete wallpaper' };
  }
}

/**
 * Sets the focal point for a wallpaper and updates store settings.
 * @param {string} id
 * @param {{ x: number, y: number }} focal
 * @param {any} storeInstance
 */
export function setWallpaperFocalPoint(id, focal, storeInstance) {
  const currentSettings = storeInstance.get().settings;
  const bgConfig = currentSettings.background || {};
  const wallpapers = Array.isArray(bgConfig.wallpapers) ? bgConfig.wallpapers : [];

  const clampedFocal = {
    x: Math.max(0, Math.min(1, Math.round((focal?.x ?? 0.5) * 100) / 100)),
    y: Math.max(0, Math.min(1, Math.round((focal?.y ?? 0.5) * 100) / 100))
  };

  const nextWallpapers = wallpapers.map(w => {
    if (w.id === id) {
      return { ...w, focal: clampedFocal };
    }
    return w;
  });

  storeInstance.updateSettings({
    background: {
      ...bgConfig,
      focal: clampedFocal,
      wallpapers: nextWallpapers
    }
  });
}

/**
 * Sets the active wallpaper by id.
 *
 * @param {string} id
 * @param {any} storeInstance
 */
export function setActiveWallpaper(id, storeInstance) {
  const currentSettings = storeInstance.get().settings;
  const bgConfig = currentSettings.background || {};
  const existingWallpapers = Array.isArray(bgConfig.wallpapers) ? bgConfig.wallpapers : [];
  const found = existingWallpapers.find(w => w.id === id);

  storeInstance.updateSettings({
    background: {
      ...bgConfig,
      type: 'image',
      activeId: id,
      focal: found?.focal || bgConfig.focal || { x: 0.5, y: 0.5 }
    }
  });
}

/**
 * Renders the wallpaper library UI in the drawer:
 * stats, thumbnail grid, delete buttons, selection.
 *
 * @param {HTMLElement | any} container
 * @param {any} storeInstance
 * @param {{
 *   onSelect?: (id: string) => void,
 *   onDelete?: (id: string) => void,
 *   onUpload?: (file: File) => Promise<void>,
 *   onRefresh?: () => void
 * }} [options]
 */
export async function renderWallpaperLibrary(container, storeInstance, options = {}) {
  clearChildren(container);

  const stats = await getWallpaperCountAndSize();
  const count = stats.count || 0;
  const totalBytes = stats.totalBytes || 0;

  const currentSettings = storeInstance.get().settings;
  const bgConfig = currentSettings.background || {};
  const activeId = bgConfig.activeId;
  const wallpapers = Array.isArray(bgConfig.wallpapers) ? bgConfig.wallpapers : [];

  // Stats text (e.g., "3 of 10 wallpapers, 4.2 MB")
  const statsEl = el('div', {
    className: 'wallpaper-stats',
    text: `${count} of ${MAX_WALLPAPERS} wallpapers, ${formatBytes(totalBytes)}`
  });
  container.appendChild(statsEl);

  // Hidden upload input and upload button
  const fileInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp',
    style: { display: 'none' }
  }));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = '';
    if (options.onUpload) {
      await options.onUpload(file);
    } else {
      const res = await addWallpaperToLibrary(file, file.name, storeInstance);
      if (res.success && options.onRefresh) {
        options.onRefresh();
      }
    }
    await renderWallpaperLibrary(container, storeInstance, options);
  });

  container.appendChild(fileInput);

  const isFull = count >= MAX_WALLPAPERS;
  const uploadBtn = el('button', {
    className: 'btn-secondary btn-sm wallpaper-upload-btn',
    type: 'button',
    text: isFull ? `Library Full (${MAX_WALLPAPERS}/${MAX_WALLPAPERS})` : '+ Add Wallpaper',
    disabled: isFull,
    onclick: () => {
      if (!isFull) fileInput.click();
    }
  });

  const actionsRow = el('div', { className: 'wallpaper-actions-row' }, [uploadBtn]);
  container.appendChild(actionsRow);

  // Grid of thumbnails
  const grid = el('div', { className: 'wallpaper-grid' });

  if (wallpapers.length === 0) {
    grid.appendChild(el('div', {
      className: 'wallpaper-empty',
      text: 'No wallpapers in library. Upload an image to get started.'
    }));
  } else {
    for (const item of wallpapers) {
      const isActive = item.id === activeId;
      const card = el('div', {
        className: `wallpaper-card${isActive ? ' active' : ''}`,
        'data-id': item.id,
        role: 'button',
        tabindex: '0',
        'aria-label': `${item.name}${isActive ? ' (active)' : ''}`
      });

      // Thumbnail
      const thumb = el('img', {
        className: 'wallpaper-thumb',
        src: item.thumbnailUrl || '',
        alt: item.name || 'Wallpaper',
        title: isActive ? 'Click thumbnail to set focal point' : item.name || 'Wallpaper'
      });

      const focalX = (item.focal && typeof item.focal.x === 'number') ? item.focal.x : 0.5;
      const focalY = (item.focal && typeof item.focal.y === 'number') ? item.focal.y : 0.5;

      const focalMarker = el('div', {
        className: 'wallpaper-focal-marker',
        style: {
          left: `${Math.round(focalX * 100)}%`,
          top: `${Math.round(focalY * 100)}%`,
          display: isActive ? 'block' : 'none'
        }
      });

      thumb.addEventListener('click', async (e) => {
        if (!isActive) return;
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const rect = typeof thumb.getBoundingClientRect === 'function' ? thumb.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
        const w = rect.width || 1;
        const h = rect.height || 1;
        const clientX = e.clientX ?? 0;
        const clientY = e.clientY ?? 0;
        const relX = Math.max(0, Math.min(1, (clientX - rect.left) / w));
        const relY = Math.max(0, Math.min(1, (clientY - rect.top) / h));
        const newFocal = {
          x: Math.round(relX * 100) / 100,
          y: Math.round(relY * 100) / 100
        };
        setWallpaperFocalPoint(item.id, newFocal, storeInstance);
        if (options.onRefresh) options.onRefresh();
        await renderWallpaperLibrary(container, storeInstance, options);
      });

      const thumbWrap = el('div', { className: 'wallpaper-thumb-wrap' }, [thumb, focalMarker]);
      card.appendChild(thumbWrap);

      // Info row
      const info = el('div', { className: 'wallpaper-card-info' }, [
        el('span', { className: 'wallpaper-card-name', text: item.name || 'Wallpaper' }),
        el('span', { className: 'wallpaper-card-size', text: formatBytes(item.size || 0) })
      ]);
      card.appendChild(info);

      // Delete button
      const delBtn = el('button', {
        className: 'wallpaper-card-del',
        type: 'button',
        title: 'Delete wallpaper',
        'aria-label': `Delete ${item.name || 'wallpaper'}`,
        text: '×'
      });
      delBtn.addEventListener('click', async (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        await removeWallpaperFromLibrary(item.id, storeInstance);
        if (options.onDelete) options.onDelete(item.id);
        if (options.onRefresh) options.onRefresh();
        await renderWallpaperLibrary(container, storeInstance, options);
      });
      card.appendChild(delBtn);

      // Day & Night assignment buttons
      const isDay = bgConfig.dayId === item.id;
      const isNight = bgConfig.nightId === item.id;

      const dayBtn = el('button', {
        className: `wallpaper-day-btn${isDay ? ' active' : ''}`,
        type: 'button',
        title: isDay ? 'Unset Day Wallpaper' : 'Set as Day Wallpaper',
        'aria-label': `Day wallpaper for ${item.name || 'image'}`,
        text: '☀️ Day'
      });
      dayBtn.addEventListener('click', async (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        setDayNightWallpaper('day', item.id, storeInstance);
        if (options.onRefresh) options.onRefresh();
        await renderWallpaperLibrary(container, storeInstance, options);
      });

      const nightBtn = el('button', {
        className: `wallpaper-night-btn${isNight ? ' active' : ''}`,
        type: 'button',
        title: isNight ? 'Unset Night Wallpaper' : 'Set as Night Wallpaper',
        'aria-label': `Night wallpaper for ${item.name || 'image'}`,
        text: '🌙 Night'
      });
      nightBtn.addEventListener('click', async (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        setDayNightWallpaper('night', item.id, storeInstance);
        if (options.onRefresh) options.onRefresh();
        await renderWallpaperLibrary(container, storeInstance, options);
      });

      const dayNightRow = el('div', { className: 'wallpaper-daynight-row' }, [dayBtn, nightBtn]);
      card.appendChild(dayNightRow);

      // Select handler
      card.addEventListener('click', async (e) => {
        setActiveWallpaper(item.id, storeInstance);
        if (options.onSelect) options.onSelect(item.id);
        if (options.onRefresh) options.onRefresh();
        await renderWallpaperLibrary(container, storeInstance, options);
      });

      grid.appendChild(card);
    }
  }

  container.appendChild(grid);
}

/**
 * Resolves the active wallpaper ID, checking dayId/nightId preferences against the current theme.
 * @param {any} bgConfig
 * @param {boolean} isDark
 * @returns {string | null}
 */
export function resolveActiveWallpaperId(bgConfig, isDark) {
  if (!bgConfig) return null;
  if (!isDark && bgConfig.dayId) {
    return bgConfig.dayId;
  }
  if (isDark && bgConfig.nightId) {
    return bgConfig.nightId;
  }
  return bgConfig.activeId || null;
}

/**
 * Assigns or toggles a day/night wallpaper preference.
 * @param {'day' | 'night'} type
 * @param {string} wallpaperId
 * @param {any} storeInstance
 */
export function setDayNightWallpaper(type, wallpaperId, storeInstance) {
  const current = storeInstance.get().settings.background || {};
  let dayId = current.dayId || null;
  let nightId = current.nightId || null;

  if (type === 'day') {
    dayId = (dayId === wallpaperId ? null : wallpaperId);
  } else if (type === 'night') {
    nightId = (nightId === wallpaperId ? null : wallpaperId);
  }

  storeInstance.updateSettings({
    background: {
      ...current,
      dayId,
      nightId
    }
  });
}

/**
 * Resolves the next wallpaper ID when rotation is enabled (tab, hourly, daily).
 * Computed at load only without background timers.
 *
 * @param {any} bgConfig
 * @param {string | null} [lastActiveId]
 * @param {number} [currentTime=Date.now()]
 * @returns {string | null}
 */
export function resolveRotatedWallpaperId(bgConfig, lastActiveId = null, currentTime = Date.now()) {
  if (!bgConfig) return null;
  const rotation = bgConfig.rotation || 'off';
  const wallpapers = Array.isArray(bgConfig.wallpapers) ? bgConfig.wallpapers : [];

  if (rotation === 'off' || wallpapers.length <= 1) {
    return bgConfig.activeId || (wallpapers[0]?.id ?? null);
  }

  if (rotation === 'tab') {
    const currentId = lastActiveId || bgConfig.activeId;
    const curIdx = wallpapers.findIndex(w => w.id === currentId);
    const nextIdx = (curIdx >= 0) ? (curIdx + 1) % wallpapers.length : 0;
    return wallpapers[nextIdx].id;
  }

  if (rotation === 'hourly') {
    const hourBucket = Math.floor(currentTime / (1000 * 60 * 60));
    const idx = ((hourBucket % wallpapers.length) + wallpapers.length) % wallpapers.length;
    return wallpapers[idx].id;
  }

  if (rotation === 'daily') {
    const dayBucket = Math.floor(currentTime / (1000 * 60 * 60 * 24));
    const idx = ((dayBucket % wallpapers.length) + wallpapers.length) % wallpapers.length;
    return wallpapers[idx].id;
  }

  return bgConfig.activeId || null;
}



