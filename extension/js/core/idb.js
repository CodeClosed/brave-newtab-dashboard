// @ts-check

const DB_NAME = 'ntd_storage';
const DB_VERSION = 2;
const STORE_NAME = 'backgrounds';
const SNAPSHOTS_STORE = 'snapshots';
const WALLPAPERS_STORE = 'wallpapers';
const WALLPAPER_KEY = 'custom_wallpaper';

let cachedDBPromise = null;
let openCallCount = 0;

/**
 * For testing connection reuse.
 */
export function _getOpenCountForTests() {
  return openCallCount;
}

/**
 * Opens or reuses the IndexedDB database connection.
 * @returns {Promise<IDBDatabase>}
 */
function getDB() {
  if (cachedDBPromise) {
    return cachedDBPromise;
  }

  openCallCount++;
  cachedDBPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      cachedDBPromise = null;
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WALLPAPERS_STORE)) {
        db.createObjectStore(WALLPAPERS_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        cachedDBPromise = null;
      };
      db.onclose = () => {
        cachedDBPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      cachedDBPromise = null;
      reject(request.error);
    };
  });

  return cachedDBPromise;
}

/**
 * Closes the active IndexedDB connection if open.
 */
export async function closeDB() {
  if (cachedDBPromise) {
    try {
      const db = await cachedDBPromise;
      db.close();
    } catch {}
    cachedDBPromise = null;
  }
}

/**
 * Saves a wallpaper Blob into IndexedDB.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function saveBackgroundImage(blob) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, WALLPAPER_KEY);

    req.onsuccess = () => resolve(WALLPAPER_KEY);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves the stored wallpaper Blob from IndexedDB.
 * @returns {Promise<Blob | null>}
 */
export async function getBackgroundImage() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(WALLPAPER_KEY);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Deletes the stored wallpaper Blob from IndexedDB.
 * @returns {Promise<void>}
 */
export async function deleteBackgroundImage() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(WALLPAPER_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Ignore if DB not found
  }
}

/**
 * Saves a snapshot record into the snapshots object store.
 * @param {any} snapshot
 * @returns {Promise<any>}
 */
export async function saveSnapshotRecord(snapshot) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
    const store = tx.objectStore(SNAPSHOTS_STORE);
    const req = store.put(snapshot);
    req.onsuccess = () => resolve(snapshot);
    req.onerror = () => reject(req.error || new Error('Failed to save snapshot to IndexedDB'));
    tx.onerror = () => reject(tx.error || new Error('Transaction error saving snapshot'));
  });
}

/**
 * Retrieves all snapshot records sorted by createdAt descending.
 * @returns {Promise<any[]>}
 */
export async function getAllSnapshotRecords() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOTS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

/**
 * Retrieves a single snapshot by id.
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function getSnapshotRecord(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOTS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Deletes a snapshot record by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSnapshotRecord(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
    const store = tx.objectStore(SNAPSHOTS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to delete snapshot'));
    tx.onerror = () => reject(tx.error || new Error('Transaction error deleting snapshot'));
  });
}

/**
 * Saves a wallpaper record into the wallpapers object store.
 * @param {any} wallpaper
 * @returns {Promise<any>}
 */
export async function saveWallpaperRecord(wallpaper) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WALLPAPERS_STORE, 'readwrite');
      const store = tx.objectStore(WALLPAPERS_STORE);
      const req = store.put(wallpaper, wallpaper.id);
      req.onsuccess = () => resolve(wallpaper);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return wallpaper;
  }
}

/**
 * Retrieves a single wallpaper record by id.
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function getWallpaperRecord(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WALLPAPERS_STORE, 'readonly');
      const store = tx.objectStore(WALLPAPERS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Retrieves all wallpaper records sorted by createdAt descending.
 * @returns {Promise<any[]>}
 */
export async function getAllWallpaperRecords() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WALLPAPERS_STORE, 'readonly');
      const store = tx.objectStore(WALLPAPERS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

/**
 * Deletes a wallpaper record by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteWallpaperRecord(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WALLPAPERS_STORE, 'readwrite');
      const store = tx.objectStore(WALLPAPERS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Ignore error
  }
}

/**
 * Computes the number of stored wallpapers and their total size in bytes.
 * @returns {Promise<{ count: number, totalBytes: number }>}
 */
export async function getWallpaperCountAndSize() {
  const all = await getAllWallpaperRecords();
  const count = all.length;
  const totalBytes = all.reduce((sum, item) => sum + (item.size || (item.blob ? item.blob.size : 0) || 0), 0);
  return { count, totalBytes };
}

