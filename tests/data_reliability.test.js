// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeChecksum,
  createSnapshot,
  restoreSnapshot,
  registerSnapshotStore,
  checkAndTriggerDailySnapshot
} from '../extension/js/core/snapshots.js';
import {
  flushPendingSave,
  loadDashboardData,
  queueSaveDashboardData,
  EMERGENCY_RECOVERY_KEY
} from '../extension/js/core/storage.js';
import { createDefaultDashboardData, CURRENT_SCHEMA_VERSION } from '../extension/js/core/schema.js';
import { closeDB, saveSnapshotRecord } from '../extension/js/core/idb.js';

let mockStorage = new Map();

beforeEach(async () => {
  mockStorage.clear();
  await closeDB();

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
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    }
  };
});

afterEach(async () => {
  await closeDB();
  delete globalThis.indexedDB;
});

test('Reliability: computeChecksum produces deterministic 8-char hex and detects bit corruption', () => {
  const original = JSON.stringify({ a: 1, b: 'test-data', c: [1, 2, 3] });
  const cs1 = computeChecksum(original);
  const cs2 = computeChecksum(original);
  assert.equal(cs1, cs2, 'Checksum must be deterministic');
  assert.equal(cs1.length, 8, 'Checksum must be 8-character hex string');

  // Corrupted data
  const corrupted = original.replace('test-data', 'test-data-corrupted');
  const csCorrupted = computeChecksum(corrupted);
  assert.notEqual(cs1, csCorrupted, 'Checksum must change when payload is modified');
});

test('Reliability: createSnapshot enriches records with schemaVersion, dataSize, and checksum', async () => {
  const data = createDefaultDashboardData();
  const snapshot = await createSnapshot('Pre-migration backup', data);

  assert.ok(snapshot.id);
  assert.equal(snapshot.reason, 'Pre-migration backup');
  assert.equal(snapshot.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(snapshot.dataSize > 0);
  assert.ok(snapshot.checksum);
  assert.equal(snapshot.checksum.length, 8);
  assert.equal(computeChecksum(JSON.stringify(snapshot.data)), snapshot.checksum);
});

test('Reliability: restoreSnapshot rejects corrupted snapshot when checksum mismatches', async () => {
  const data = createDefaultDashboardData();
  const snapshot = await createSnapshot('Integrity test', data);

  // Deliberately corrupt snapshot data payload while keeping old checksum
  snapshot.data.version = 999;
  snapshot.data.corruptedField = 'bad payload';
  await saveSnapshotRecord(snapshot);

  let replaced = false;
  const mockStore = {
    get: () => data,
    replaceData: async () => { replaced = true; }
  };
  registerSnapshotStore(mockStore);

  const res = await restoreSnapshot(snapshot.id);
  assert.equal(res.success, false, 'Should fail when data does not match checksum');
  assert.ok(res.error.includes('integrity check failed'));
  assert.equal(replaced, false, 'Store must not be replaced with corrupted data');
});

test('Reliability: restoreSnapshot rejects snapshot with invalid schema structure', async () => {
  const invalidData = {
    version: CURRENT_SCHEMA_VERSION,
    categories: 'not-an-array', // Corrupted structure
    settings: null
  };

  const serialized = JSON.stringify(invalidData);
  const snapshot = {
    id: 'invalid-schema-snap',
    createdAt: new Date().toISOString(),
    reason: 'Corrupt snapshot',
    checksum: computeChecksum(serialized),
    data: invalidData
  };

  await saveSnapshotRecord(snapshot);

  let replaced = false;
  const mockStore = {
    get: () => createDefaultDashboardData(),
    replaceData: async () => { replaced = true; }
  };
  registerSnapshotStore(mockStore);

  const res = await restoreSnapshot(snapshot.id);
  assert.equal(res.success, false);
  assert.ok(res.error.toLowerCase().includes('schema validation'));
  assert.equal(replaced, false);
});

test('Reliability: restoreSnapshot safely auto-migrates older schema snapshots (v1 -> v3)', async () => {
  const v1Data = {
    version: 1,
    settings: { theme: 'dark', accent: 'blue', layout: 'grid' },
    categories: [
      { id: 'cat1', name: 'Dev Tools', bookmarks: [{ id: 'b1', name: 'GitHub', url: 'https://github.com' }] }
    ]
  };

  const serialized = JSON.stringify(v1Data);
  const snapshot = {
    id: 'v1-legacy-snap',
    createdAt: new Date().toISOString(),
    reason: 'Legacy snapshot',
    checksum: computeChecksum(serialized),
    data: v1Data
  };

  await saveSnapshotRecord(snapshot);

  let restoredData = null;
  const mockStore = {
    get: () => createDefaultDashboardData(),
    replaceData: async (d) => { restoredData = d; }
  };
  registerSnapshotStore(mockStore);

  const res = await restoreSnapshot(snapshot.id);
  assert.equal(res.success, true);
  assert.ok(restoredData);
  assert.equal(restoredData.version, CURRENT_SCHEMA_VERSION);
  assert.ok(Array.isArray(restoredData.spaces));
});

test('Reliability: flushPendingSave writes to emergency recovery slot and loadDashboardData recovers it', async () => {
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
    get length() { return storageMap.size; },
    key: (i) => Array.from(storageMap.keys())[i] || null
  };

  const testState = createDefaultDashboardData();
  testState.categories.push({
    id: 'emergency-cat',
    name: 'Emergency Unsaved Work',
    order: 99,
    bookmarks: [{ id: 'b99', name: 'Important Doc', url: 'https://emergency.example.com', order: 0 }]
  });

  queueSaveDashboardData(testState);
  flushPendingSave();

  const emergencyRaw = globalThis.localStorage.getItem(EMERGENCY_RECOVERY_KEY);
  assert.ok(emergencyRaw, 'Emergency recovery key must be written synchronously during flush');
  const parsed = JSON.parse(emergencyRaw);
  assert.equal(parsed.data.categories.some(c => c.id === 'emergency-cat'), true);

  const recovered = await loadDashboardData();
  assert.ok(recovered);
  assert.equal(recovered.categories.some(c => c.id === 'emergency-cat'), true);
  assert.equal(globalThis.localStorage.getItem(EMERGENCY_RECOVERY_KEY), null);
});

test('Reliability: checkAndTriggerDailySnapshot captures baseline state upon initialization', async () => {
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
    get length() { return storageMap.size; },
    key: (i) => Array.from(storageMap.keys())[i] || null
  };

  const baseline = createDefaultDashboardData();
  const created = await checkAndTriggerDailySnapshot(baseline);
  assert.equal(created, true, 'First boot of the day should create a baseline snapshot');

  const skipped = await checkAndTriggerDailySnapshot(baseline);
  assert.equal(skipped, false, 'Subsequent call within 24 hours must be skipped');
});
