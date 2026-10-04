import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDashboardData, generateId } from '../extension/js/core/schema.js';
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  checkAndTriggerDailySnapshot,
  _resetSnapshotStorageForTests
} from '../extension/js/core/snapshots.js';
import { store } from '../extension/js/core/state.js';
import { closeDB } from '../extension/js/core/idb.js';

let mockStorage = new Map();

beforeEach(async () => {
  mockStorage.clear();

  // Mock IndexedDB in memory for snapshot tests
  globalThis.indexedDB = {
    open: (dbName, version) => {
      const req = {
        result: {
          objectStoreNames: {
            contains: (name) => true
          },
          transaction: (storeName, mode) => {
            return {
              objectStore: (sName) => ({
                put: (val, key) => {
                  const id = val.id || key;
                  mockStorage.set(id, JSON.parse(JSON.stringify(val)));
                  const r = { result: id };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                },
                get: (key) => {
                  const r = { result: mockStorage.get(key) ? JSON.parse(JSON.stringify(mockStorage.get(key))) : null };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                },
                getAll: () => {
                  const items = Array.from(mockStorage.values()).map(v => JSON.parse(JSON.stringify(v)));
                  const r = { result: items };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                },
                delete: (key) => {
                  mockStorage.delete(key);
                  const r = { result: undefined };
                  setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
                  return r;
                }
              })
            };
          },
          close: () => {}
        }
      };
      setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 0);
      return req;
    }
  };

  // Reset store with clean data
  await store.replaceData(createDefaultDashboardData(), true);
  if (_resetSnapshotStorageForTests) {
    _resetSnapshotStorageForTests();
  }
});

afterEach(async () => {
  if (closeDB) {
    await closeDB();
  }
  delete globalThis.indexedDB;
  delete globalThis.localStorage;
});

test('1.2 Snapshots: creates and retrieves snapshot with reason, counts, and data', async () => {
  const current = store.get();
  const snap = await createSnapshot('Manual snapshot', current);

  assert.ok(snap.id);
  assert.equal(snap.reason, 'Manual snapshot');
  assert.equal(snap.counts.categories, current.categories.length);
  assert.equal(typeof snap.createdAt, 'string');
  assert.deepEqual(snap.data.categories, current.categories);

  const list = await listSnapshots();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, snap.id);
  assert.equal(list[0].reason, 'Manual snapshot');
});

test('1.2 Snapshots: enforces maximum 10 snapshots by pruning older entries', async () => {
  const base = store.get();
  for (let i = 1; i <= 13; i++) {
    await createSnapshot(`Snapshot #${i}`, base);
  }

  const list = await listSnapshots();
  assert.equal(list.length, 10, 'Must keep at most latest 10 snapshots');
  // First item should be the newest
  assert.equal(list[0].reason, 'Snapshot #13');
  // Oldest remaining item should be #4
  assert.equal(list[9].reason, 'Snapshot #4');
});

test('1.2 Snapshots: restores snapshot, restoring full state and creating a before-restore snapshot', async () => {
  const initialCount = store.get().categories.length;
  const snap = await createSnapshot('Initial state', store.get());

  // Modify current state by adding a category
  store.addCategory({ name: 'Work Project', icon: '🚀' });
  assert.equal(store.get().categories.length, initialCount + 1);

  // Restore previous snapshot
  const restored = await restoreSnapshot(snap.id);
  assert.equal(restored.success, true);
  assert.equal(store.get().categories.length, initialCount);
  assert.ok(!store.get().categories.some(c => c.name === 'Work Project'));

  // Verify that an automatic "Before restore" snapshot was created
  const list = await listSnapshots();
  assert.ok(list.some(s => s.reason === 'Before restore'));
});

test('1.2 Snapshots: checkAndTriggerDailySnapshot triggers at most once every 24 hours', async () => {
  let mockStorageStore = {};
  globalThis.localStorage = {
    getItem: (k) => mockStorageStore[k] || null,
    setItem: (k, v) => { mockStorageStore[k] = String(v); }
  };

  // First call should create a snapshot
  const didCreate1 = await checkAndTriggerDailySnapshot();
  assert.equal(didCreate1, true);

  const list1 = await listSnapshots();
  assert.equal(list1.length, 1);
  assert.equal(list1[0].reason, 'Periodic backup');

  // Immediate second call should be skipped (within 24 hours)
  const didCreate2 = await checkAndTriggerDailySnapshot();
  assert.equal(didCreate2, false);
  const list2 = await listSnapshots();
  assert.equal(list2.length, 1);

  // Simulate 25 hours passed
  const pastTime = Date.now() - (25 * 60 * 60 * 1000);
  globalThis.localStorage.setItem('ntd_last_daily_snapshot', String(pastTime));

  const didCreate3 = await checkAndTriggerDailySnapshot();
  assert.equal(didCreate3, true);
  const list3 = await listSnapshots();
  assert.equal(list3.length, 2);
});
