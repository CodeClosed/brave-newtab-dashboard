// @ts-check
import { createDefaultDashboardData } from './schema.js';
import { migrate } from './migrate.js';

const STORAGE_KEY = 'dashboard';
const BOOT_CACHE_KEY = 'ntd:boot';
const DEBOUNCE_DELAY_MS = 300;

let pendingData = null;
let saveTimeout = null;

/**
 * Checks if running inside an active Chrome/Brave Extension environment.
 * @returns {boolean}
 */
function hasChromeStorage() {
  return typeof chrome !== 'undefined' &&
         typeof chrome.storage !== 'undefined' &&
         typeof chrome.storage.local !== 'undefined';
}

/**
 * Loads dashboard data from storage, applying migrations and default fallbacks.
 * @returns {Promise<import('./schema.js').DashboardData>}
 */
export async function loadDashboardData() {
  try {
    let raw = null;
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      raw = result[STORAGE_KEY];
    } else if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) raw = JSON.parse(stored);
    }

    if (!raw) {
      // First run: initialize and persist defaults
      const defaults = createDefaultDashboardData();
      await saveDashboardDataImmediately(defaults);
      return defaults;
    }

    return migrate(raw);
  } catch (err) {
    console.error('Failed to load dashboard data from storage:', err);
    return createDefaultDashboardData();
  }
}

/**
 * Updates the synchronous localStorage boot cache for zero-FOWT startup.
 * @param {import('./schema.js').DashboardData} data
 */
function updateBootCache(data) {
  try {
    if (typeof localStorage !== 'undefined' && data && data.settings) {
      const bootInfo = {
        theme: data.settings.theme,
        accent: data.settings.accent,
        layout: data.settings.layout
      };
      localStorage.setItem(BOOT_CACHE_KEY, JSON.stringify(bootInfo));
    }
  } catch (err) {
    // Silently ignore storage quota or private browsing errors
  }
}

/**
 * Immediately persists data to storage without debouncing.
 * @param {import('./schema.js').DashboardData} data
 * @returns {Promise<void>}
 */
export async function saveDashboardDataImmediately(data) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingData = null;

  updateBootCache(data);

  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

/**
 * Debounced save operation to optimize disk I/O.
 * @param {import('./schema.js').DashboardData} data
 */
export function queueSaveDashboardData(data) {
  pendingData = data;
  updateBootCache(data);

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    if (pendingData) {
      await saveDashboardDataImmediately(pendingData);
    }
  }, DEBOUNCE_DELAY_MS);
}

/**
 * Synchronously flushes any queued save operation before page unload.
 */
export function flushPendingSave() {
  if (pendingData) {
    updateBootCache(pendingData);
    if (hasChromeStorage()) {
      // In Chromium MV3, chrome.storage.local.set is asynchronous,
      // but triggering it before pagehide initiates serialization.
      chrome.storage.local.set({ [STORAGE_KEY]: pendingData });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingData));
    }
    pendingData = null;
  }
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

// Hook page unload to ensure pending writes are never lost
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingSave);
}

/**
 * Registers a callback for changes emitted by other open tabs.
 * @param {(newData: import('./schema.js').DashboardData) => void} onChange
 */
export function onExternalStorageChange(onChange) {
  if (hasChromeStorage()) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const updated = changes[STORAGE_KEY].newValue;
        if (updated) {
          onChange(migrate(updated));
        }
      }
    });
  } else if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          onChange(migrate(JSON.parse(e.newValue)));
        } catch {}
      }
    });
  }
}
