// @ts-check
import { createDefaultDashboardData, CURRENT_SCHEMA_VERSION, validateDashboardData } from './schema.js';
import { migrate } from './migrate.js';
import { createSnapshot, checkAndTriggerDailySnapshot } from './snapshots.js';

const STORAGE_KEY = 'dashboard';
const RECOVERY_KEY = 'dashboard:recovery';
export const EMERGENCY_RECOVERY_KEY = 'dashboard:emergency_recovery';
const BOOT_CACHE_KEY = 'ntd:boot';
const DEBOUNCE_DELAY_MS = 300;

let pendingData = null;
let saveTimeout = null;
let lastSerializedWrite = null;
let deferredExternalUpdate = null;
let dragEndListenerBound = false;

/**
 * Resets internal state for unit test isolation.
 */
export function _resetSyncStateForTests() {
  pendingData = null;
  lastSerializedWrite = null;
  deferredExternalUpdate = null;
  dragEndListenerBound = false;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

/**
 * Returns current pending data for testing save queue behavior.
 */
export function _getPendingDataForTests() {
  return pendingData;
}

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
    // Check if an emergency recovery backup exists from an abrupt tab termination
    let emergencyData = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const rawEmergency = localStorage.getItem(EMERGENCY_RECOVERY_KEY);
        if (rawEmergency) {
          const parsed = JSON.parse(rawEmergency);
          if (parsed && parsed.data && validateDashboardData(parsed.data).valid) {
            emergencyData = parsed.data;
          } else {
            // Corrupt or invalid emergency data can be removed safely
            localStorage.removeItem(EMERGENCY_RECOVERY_KEY);
          }
        }
      }
    } catch (e) {}

    if (emergencyData) {
      console.warn('[NTD Storage] Recovered unsaved dashboard state from emergency recovery slot');
      await saveDashboardDataImmediately(emergencyData);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(EMERGENCY_RECOVERY_KEY);
        }
      } catch (e) {}
      checkAndTriggerDailySnapshot(emergencyData).catch(() => {});
      return migrate(emergencyData);
    }

    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      raw = result[STORAGE_KEY];
    } else if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          raw = JSON.parse(stored);
        } catch {
          raw = stored; // string payload
        }
      }
    }

    if (!raw) {
      // First run: initialize and persist defaults
      const defaults = createDefaultDashboardData();
      await saveDashboardDataImmediately(defaults);
      return defaults;
    }

    // Check if stored data is truly unreadable or a future version
    const isUnreadable = typeof raw !== 'object' || raw === null || (raw.categories !== undefined && !Array.isArray(raw.categories));
    const isFutureVersion = raw && typeof raw === 'object' && typeof raw.version === 'number' && raw.version > CURRENT_SCHEMA_VERSION;

    if (isUnreadable || isFutureVersion) {
      // Copy raw value to recovery key before falling back to defaults
      try {
        if (hasChromeStorage()) {
          await chrome.storage.local.set({ [RECOVERY_KEY]: raw });
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(RECOVERY_KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
        }
      } catch (e) {
        console.warn('Failed to save recovery backup:', e);
      }

      if (isUnreadable) {
        if (typeof window !== 'undefined') {
          // @ts-ignore
          window.__ntd_data_unreadable_warning = true;
        }
        // Do NOT overwrite storage with defaults!
        return createDefaultDashboardData();
      }
    }

    if (raw && typeof raw === 'object' && raw.version !== CURRENT_SCHEMA_VERSION && Array.isArray(raw.categories)) {
      try {
        await createSnapshot('Before migration', raw);
      } catch (e) {
        // Ignored in environments without IDB support
      }
    }

    const migratedData = migrate(raw);
    checkAndTriggerDailySnapshot(migratedData).catch(() => {});
    return migratedData;
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

  updateBootCache(data);

  const serialized = JSON.stringify(data);

  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    if (chrome.runtime?.lastError) {
      throw new Error(chrome.runtime.lastError.message || String(chrome.runtime.lastError));
    }
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, serialized);
  }

  lastSerializedWrite = serialized;
  if (pendingData === data) {
    pendingData = null;
  }
}

/**
 * Debounced save operation to optimize disk I/O.
 * Retains pendingData and reschedules on failure.
 * @param {import('./schema.js').DashboardData} data
 */
export function queueSaveDashboardData(data) {
  pendingData = data;
  updateBootCache(data);

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  const scheduleSave = (delayMs) => {
    saveTimeout = setTimeout(async () => {
      saveTimeout = null;
      if (pendingData) {
        const dataToSave = pendingData;
        try {
          await saveDashboardDataImmediately(dataToSave);
        } catch (err) {
          console.error('[NTD Storage] Debounced write failed, scheduling retry:', err);
          // If pendingData was not replaced or cleared, reschedule retry
          if (pendingData && !saveTimeout) {
            scheduleSave(1000);
          }
        }
      }
    }, delayMs);
  };

  scheduleSave(DEBOUNCE_DELAY_MS);
}

/**
 * Synchronously flushes any queued save operation before page unload.
 */
export function flushPendingSave() {
  if (pendingData) {
    updateBootCache(pendingData);
    const serialized = JSON.stringify(pendingData);
    lastSerializedWrite = serialized;

    // Synchronously mirror to localStorage emergency recovery slot
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(EMERGENCY_RECOVERY_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: pendingData
        }));
      }
    } catch (e) {}

    if (hasChromeStorage()) {
      let resolved = false;
      const onDone = () => {
        if (resolved) return;
        resolved = true;
        try {
          if (chrome.runtime?.lastError) {
            console.error('[NTD Storage] Failed to flush to chrome.storage.local during unload:', chrome.runtime.lastError);
            return;
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(EMERGENCY_RECOVERY_KEY);
          }
        } catch (e) {}
      };

      try {
        const maybePromise = chrome.storage.local.set({ [STORAGE_KEY]: pendingData }, onDone);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(onDone).catch(() => {});
        }
      } catch (e) {
        console.error('[NTD Storage] Failed to invoke chrome.storage.local.set during flush:', e);
      }
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
      } catch (e) {
        console.error('[NTD Storage] Failed to write to localStorage during flush:', e);
      }
    }
  }
}

// Hook page unload to ensure pending writes are never lost
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingSave);
}

/**
 * Sets up dragend listener to apply any deferred external updates once dragging ends.
 * @param {(newData: import('./schema.js').DashboardData) => void} onChange
 */
function ensureDragEndListener(onChange) {
  if (dragEndListenerBound || typeof document === 'undefined') return;
  dragEndListenerBound = true;
  document.addEventListener('dragend', () => {
    setTimeout(() => {
      if (deferredExternalUpdate) {
        const toApply = deferredExternalUpdate;
        deferredExternalUpdate = null;
        const stillDragging = typeof document !== 'undefined' && Boolean(document.querySelector?.('.is-dragging'));
        if (!stillDragging && pendingData === null) {
          onChange(migrate(toApply));
        }
      }
    }, 0);
  }, true);
}

/**
 * Processes an incoming storage update from another context or tab.
 * @param {any} updated
 * @param {(newData: import('./schema.js').DashboardData) => void} onChange
 */
function processExternalUpdate(updated, onChange) {
  if (!updated) return;
  const serialized = typeof updated === 'string' ? updated : JSON.stringify(updated);

  // 1. Ignore change events produced by this tab's own writes
  if (lastSerializedWrite && serialized === lastSerializedWrite) {
    return;
  }

  // 2. While a local save is pending, do not overwrite local state
  if (pendingData !== null) {
    return;
  }

  // 3. Defer applying an external update while a drag is active
  const isDragging = typeof document !== 'undefined' && Boolean(document.querySelector?.('.is-dragging'));
  if (isDragging) {
    deferredExternalUpdate = updated;
    ensureDragEndListener(onChange);
    return;
  }

  onChange(migrate(updated));
}

/**
 * Registers a callback for changes emitted by other open tabs.
 * @param {(newData: import('./schema.js').DashboardData) => void} onChange
 */
export function onExternalStorageChange(onChange) {
  ensureDragEndListener(onChange);

  if (hasChromeStorage()) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        processExternalUpdate(changes[STORAGE_KEY].newValue, onChange);
      }
    });
  } else if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          processExternalUpdate(JSON.parse(e.newValue), onChange);
        } catch {}
      }
    });
  }
}

