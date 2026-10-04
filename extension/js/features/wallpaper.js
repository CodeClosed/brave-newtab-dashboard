// @ts-check
import {
  saveWallpaperRecord,
  getWallpaperRecord,
  getAllWallpaperRecords,
  deleteWallpaperRecord,
  getWallpaperCountAndSize
} from '../core/idb.js';

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
