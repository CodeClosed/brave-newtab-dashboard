// @ts-check
import { generateId, validateDashboardData, CURRENT_SCHEMA_VERSION } from './schema.js';
import { migrate } from './migrate.js';
import {
  saveSnapshotRecord,
  getAllSnapshotRecords,
  getSnapshotRecord,
  deleteSnapshotRecord
} from './idb.js';

let activeStore = null;

/**
 * Registers the active store instance for snapshot operations.
 * @param {any} storeInstance
 */
export function registerSnapshotStore(storeInstance) {
  activeStore = storeInstance;
}

const MAX_SNAPSHOTS = 10;
const DAILY_SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY_LAST_DAILY = 'ntd_last_daily_snapshot';

/**
 * Computes a fast 32-bit FNV-1a checksum of a serialized string for bitrot & corruption detection.
 * @param {string} str
 * @returns {string} 8-character hex checksum
 */
export function computeChecksum(str) {
  if (typeof str !== 'string') return '00000000';
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Creates and stores a snapshot of the current or specified dashboard data.
 * Prunes the store to keep at most the latest 10 snapshots.
 *
 * @param {string} reason
 * @param {import('./schema.js').DashboardData} [dataOverride]
 * @returns {Promise<{ id: string, createdAt: string, reason: string, schemaVersion: number, dataSize: number, checksum: string, counts: { categories: number, bookmarks: number }, data: any }>}
 */
export async function createSnapshot(reason, dataOverride = null) {
  const sourceData = dataOverride || (activeStore ? activeStore.get() : null);
  if (!sourceData) {
    throw new Error('Cannot create snapshot: no dashboard data available');
  }

  const clonedData = JSON.parse(JSON.stringify(sourceData));
  const serialized = JSON.stringify(clonedData);
  const checksum = computeChecksum(serialized);

  let totalBookmarks = 0;
  if (Array.isArray(clonedData.categories)) {
    for (const cat of clonedData.categories) {
      if (Array.isArray(cat?.bookmarks)) {
        totalBookmarks += cat.bookmarks.length;
      }
    }
  }

  const snapshot = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    reason: String(reason || 'Snapshot'),
    schemaVersion: Number(clonedData.version) || 1,
    dataSize: serialized.length,
    checksum,
    counts: {
      categories: Array.isArray(clonedData.categories) ? clonedData.categories.length : 0,
      bookmarks: totalBookmarks
    },
    data: clonedData
  };

  // Persist to IndexedDB (propagates any transaction/quota errors to the caller)
  await saveSnapshotRecord(snapshot);

  // Prune snapshots exceeding MAX_SNAPSHOTS limit
  try {
    const all = await getAllSnapshotRecords();
    if (Array.isArray(all) && all.length > MAX_SNAPSHOTS) {
      for (let i = MAX_SNAPSHOTS; i < all.length; i++) {
        if (all[i]?.id) {
          await deleteSnapshotRecord(all[i].id);
        }
      }
    }
  } catch (err) {
    // Pruning failure is non-fatal if current snapshot saved
    console.warn('[NTD Snapshots] Failed to prune older snapshots:', err);
  }

  return snapshot;
}

/**
 * Lists all available snapshots sorted newest first.
 * @returns {Promise<Array<{ id: string, createdAt: string, reason: string, schemaVersion?: number, dataSize?: number, checksum?: string, counts: { categories: number, bookmarks: number }, data: any }>>}
 */
export async function listSnapshots() {
  return getAllSnapshotRecords();
}

/**
 * Retrieves a single snapshot by id.
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function getSnapshot(id) {
  return getSnapshotRecord(id);
}

/**
 * Deletes a snapshot by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSnapshot(id) {
  return deleteSnapshotRecord(id);
}

/**
 * Restores state from a snapshot with full integrity verification and schema validation.
 * Takes a 'Before restore' snapshot of the current state before replacing.
 *
 * @param {string} id
 * @param {{ takeSnapshotBefore?: boolean }} [options]
 * @returns {Promise<{ success: boolean, data?: any, counts?: any, error?: string }>}
 */
export async function restoreSnapshot(id, options = { takeSnapshotBefore: true }) {
  const snap = await getSnapshotRecord(id);
  if (!snap || !snap.data) {
    return { success: false, error: 'Snapshot not found' };
  }

  // 1. Verify Checksum integrity if present
  if (snap.checksum) {
    const serialized = JSON.stringify(snap.data);
    const actualChecksum = computeChecksum(serialized);
    if (actualChecksum !== snap.checksum) {
      return {
        success: false,
        error: `Snapshot integrity check failed (expected checksum ${snap.checksum}, got ${actualChecksum})`
      };
    }
  }

  // 2. Migrate older schema versions if needed
  let cleanData = snap.data;
  if (cleanData && typeof cleanData === 'object' && cleanData.version !== CURRENT_SCHEMA_VERSION) {
    try {
      cleanData = migrate(cleanData);
    } catch (migErr) {
      return {
        success: false,
        error: `Failed to migrate snapshot from version ${cleanData?.version}: ${migErr.message || migErr}`
      };
    }
  }

  // 3. Validate Schema
  const validation = validateDashboardData(cleanData);
  if (!validation.valid) {
    return {
      success: false,
      error: `Snapshot failed schema validation: ${(validation.errors || []).join('; ') || 'corrupted structure'}`
    };
  }

  // 4. Capture safety snapshot of current state before replacing
  if (options.takeSnapshotBefore !== false) {
    try {
      await createSnapshot('Before restore', activeStore ? activeStore.get() : null);
    } catch (e) {
      console.warn('[NTD Snapshots] Pre-restore safety snapshot failed, proceeding with restore:', e);
    }
  }

  // 5. Apply validated data to store
  if (activeStore) {
    await activeStore.replaceData(cleanData);
  }
  return { success: true, data: cleanData, counts: snap.counts };
}

/**
 * Checks if 24 hours have passed since the last automatic snapshot and triggers one on clean baseline data.
 * @param {import('./schema.js').DashboardData} [baselineData] Clean baseline state to snapshot
 * @returns {Promise<boolean>} True if a periodic snapshot was created, false otherwise.
 */
export async function checkAndTriggerDailySnapshot(baselineData = null) {
  try {
    let lastTime = 0;
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(STORAGE_KEY_LAST_DAILY);
      if (val) lastTime = parseInt(val, 10);
    }

    const now = Date.now();
    if (!lastTime || (now - lastTime) >= DAILY_SNAPSHOT_INTERVAL_MS) {
      const targetData = baselineData || (activeStore ? activeStore.get() : null);
      if (targetData) {
        await createSnapshot('Periodic backup', targetData);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_LAST_DAILY, String(now));
        }
        return true;
      }
    }
  } catch (err) {
    console.warn('[NTD Snapshots] Daily snapshot skipped or failed:', err);
  }
  return false;
}

/**
 * Reset test helper.
 */
export function _resetSnapshotStorageForTests() {
  // No-op hook for testing
}
