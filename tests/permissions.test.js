import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  hasPermissions,
  requestPermissions,
  removePermissions,
  ensurePermissions
} from '../extension/js/features/permissions.js';

let grantedSet = new Set();
let requestHandler = null;

beforeEach(() => {
  grantedSet = new Set();
  requestHandler = null;

  globalThis.chrome = {
    permissions: {
      contains: ({ permissions }, callback) => {
        const hasAll = permissions.every(p => grantedSet.has(p));
        callback(hasAll);
      },
      request: ({ permissions }, callback) => {
        if (requestHandler) {
          const res = requestHandler(permissions);
          if (res) {
            permissions.forEach(p => grantedSet.add(p));
          }
          callback(res);
        } else {
          permissions.forEach(p => grantedSet.add(p));
          callback(true);
        }
      },
      remove: ({ permissions }, callback) => {
        permissions.forEach(p => grantedSet.delete(p));
        callback(true);
      }
    },
    runtime: {
      lastError: null
    }
  };
});

afterEach(() => {
  delete globalThis.chrome;
});

test('8.3 Manifest: defines bookmarks, tabs, and tabGroups in optional_permissions', () => {
  const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf-8'));
  assert.ok(Array.isArray(manifest.optional_permissions), 'optional_permissions must be an array');
  assert.ok(manifest.optional_permissions.includes('bookmarks'), 'Must include bookmarks');
  assert.ok(manifest.optional_permissions.includes('tabs'), 'Must include tabs');
  assert.ok(manifest.optional_permissions.includes('tabGroups'), 'Must include tabGroups');
});

test('8.3 Permissions wrapper: hasPermissions checks currently granted permissions', async () => {
  assert.equal(await hasPermissions([]), true);
  assert.equal(await hasPermissions(['tabs']), false);

  grantedSet.add('tabs');
  assert.equal(await hasPermissions(['tabs']), true);
  assert.equal(await hasPermissions(['tabs', 'tabGroups']), false);

  grantedSet.add('tabGroups');
  assert.equal(await hasPermissions(['tabs', 'tabGroups']), true);
});

test('8.3 Permissions wrapper: requestPermissions prompts and grants permissions', async () => {
  let requested = false;
  requestHandler = (perms) => {
    requested = true;
    return true;
  };

  const granted = await requestPermissions(['tabs', 'tabGroups']);
  assert.equal(granted, true);
  assert.equal(requested, true);
  assert.equal(await hasPermissions(['tabs', 'tabGroups']), true);
});

test('8.3 Permissions wrapper: requestPermissions handles user denial safely', async () => {
  requestHandler = () => false;

  const granted = await requestPermissions(['tabs']);
  assert.equal(granted, false);
  assert.equal(await hasPermissions(['tabs']), false);
});

test('8.3 Permissions wrapper: ensurePermissions skips prompt when already granted', async () => {
  grantedSet.add('tabs');
  grantedSet.add('tabGroups');

  let prompted = false;
  requestHandler = () => {
    prompted = true;
    return true;
  };

  const result = await ensurePermissions(['tabs', 'tabGroups']);
  assert.equal(result, true);
  assert.equal(prompted, false, 'Must not prompt user when permissions are already held');
});

test('8.3 Permissions wrapper: ensurePermissions prompts when permissions are not held', async () => {
  let prompted = false;
  requestHandler = () => {
    prompted = true;
    return true;
  };

  const result = await ensurePermissions(['tabs']);
  assert.equal(result, true);
  assert.equal(prompted, true, 'Must prompt when permissions are missing');
  assert.equal(await hasPermissions(['tabs']), true);
});

test('8.3 Permissions wrapper: handles environment without chrome.permissions gracefully', async () => {
  delete globalThis.chrome;

  assert.equal(await hasPermissions(['tabs']), false);
  assert.equal(await requestPermissions(['tabs']), false);
  assert.equal(await removePermissions(['tabs']), false);
  assert.equal(await ensurePermissions(['tabs']), false);
});
