// @ts-check
import {
  saveWallpaperRecord,
  getWallpaperRecord,
  getAllWallpaperRecords,
  deleteWallpaperRecord,
  getWallpaperCountAndSize
} from '../core/idb.js';
import { el, clearChildren } from '../utils/dom.js';

export const MAX_WALLPAPERS = 10;

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

  const id = generateWallpaperId();
  const size = fileOrBlob.size || 0;
  const createdAt = new Date().toISOString();

  const record = {
    id,
    name: name || 'wallpaper',
    blob: fileOrBlob,
    size,
    createdAt,
    luminanceData: options.luminanceData || null,
    focal: options.focal || { x: 0.5, y: 0.5 },
    thumbnailUrl: options.thumbnailUrl || null
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
        alt: item.name || 'Wallpaper'
      });
      card.appendChild(thumb);

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

      // Select handler
      card.addEventListener('click', (e) => {
        setActiveWallpaper(item.id, storeInstance);
        if (options.onSelect) options.onSelect(item.id);
        if (options.onRefresh) options.onRefresh();
        renderWallpaperLibrary(container, storeInstance, options);
      });

      grid.appendChild(card);
    }
  }

  container.appendChild(grid);
}

