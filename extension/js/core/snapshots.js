// @ts-check
import { generateId } from './schema.js';
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
 * Creates and stores a snapshot of the current or specified dashboard data.
 * Prunes the store to keep at most the latest 10 snapshots.
 *
 * @param {string} reason
 * @param {import('./schema.js').DashboardData} [dataOverride]
 * @returns {Promise<{ id: string, createdAt: string, reason: string, counts: { categories: number, bookmarks: number }, data: any } | null>}
 */
export async function createSnapshot(reason, dataOverride = null) {
  const sourceData = dataOverride || (activeStore ? activeStore.get() : null);
  if (!sourceData) return null;
  const clonedData = JSON.parse(JSON.stringify(sourceData));

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
    counts: {
      categories: Array.isArray(clonedData.categories) ? clonedData.categories.length : 0,
      bookmarks: totalBookmarks
    },
    data: clonedData
  };

  await saveSnapshotRecord(snapshot);

  // Prune snapshots exceeding MAX_SNAPSHOTS limit
  const all = await getAllSnapshotRecords();
  if (all.length > MAX_SNAPSHOTS) {
    for (let i = MAX_SNAPSHOTS; i < all.length; i++) {
      if (all[i]?.id) {
        await deleteSnapshotRecord(all[i].id);
      }
    }
  }

  return snapshot;
}

/**
 * Lists all available snapshots sorted newest first.
 * @returns {Promise<Array<{ id: string, createdAt: string, reason: string, counts: { categories: number, bookmarks: number }, data: any }>>}
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
 * Restores state from a snapshot.
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

  if (options.takeSnapshotBefore !== false) {
    await createSnapshot('Before restore', activeStore ? activeStore.get() : null);
  }

  if (activeStore) {
    await activeStore.replaceData(snap.data);
  }
  return { success: true, data: snap.data, counts: snap.counts };
}

/**
 * Checks if 24 hours have passed since the last automatic snapshot and triggers one if needed.
 * @returns {Promise<boolean>} True if a periodic snapshot was created, false otherwise.
 */
export async function checkAndTriggerDailySnapshot() {
  try {
    let lastTime = 0;
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(STORAGE_KEY_LAST_DAILY);
      if (val) lastTime = parseInt(val, 10);
    }

    const now = Date.now();
    if (!lastTime || (now - lastTime) >= DAILY_SNAPSHOT_INTERVAL_MS) {
      await createSnapshot('Periodic backup');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_LAST_DAILY, String(now));
      }
      return true;
    }
  } catch (err) {
    // Graceful degradation
  }
  return false;
}

/**
 * Reset test helper.
 */
export function _resetSnapshotStorageForTests() {
  // No-op hook for testing
}
