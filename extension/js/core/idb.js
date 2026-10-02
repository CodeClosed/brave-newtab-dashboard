// @ts-check

const DB_NAME = 'ntd_storage';
const DB_VERSION = 1;
const STORE_NAME = 'backgrounds';
const WALLPAPER_KEY = 'custom_wallpaper';

/**
 * Opens or initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a wallpaper Blob into IndexedDB.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function saveBackgroundImage(blob) {
  const db = await openDB();
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
    const db = await openDB();
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
    const db = await openDB();
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
