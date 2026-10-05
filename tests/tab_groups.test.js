// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSavableTabs,
  chromeColorFor,
  formatSavedBadgeDate,
  tabsToCollections,
  saveCurrentTabs,
  openCollectionAsGroup
} from '../extension/js/features/tab-groups.js';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import { renderCategoryCard } from '../extension/js/ui/components.js';

let origDocument;
let origChrome;
let origWindow;

beforeEach(() => {
  origDocument = globalThis.document;
  origChrome = globalThis.chrome;
  origWindow = globalThis.window;

  // DOM Mock
  globalThis.document = {
    body: {
      appendChild: () => {},
      removeChild: () => {},
      contains: () => true
    },
    createElement: (tag) => {
      const attrs = {};
      const classListSet = new Set();
      const listeners = new Map();
      const el = {
        tagName: tag.toUpperCase(),
        attrs,
        children: [],
        style: {},
        dataset: {},
        get className() { return Array.from(classListSet).join(' '); },
        set className(v) {
          classListSet.clear();
          String(v).split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
        },
        classList: {
          add: (...cls) => cls.forEach(c => classListSet.add(c)),
          remove: (...cls) => cls.forEach(c => classListSet.delete(c)),
          contains: (c) => classListSet.has(c)
        },
        addEventListener(evt, handler) {
          if (!listeners.has(evt)) listeners.set(evt, []);
          listeners.get(evt).push(handler);
        },
        dispatchEvent(evt) {
          const arr = listeners.get(evt.type) || [];
          arr.forEach(fn => fn(evt));
        },
        setAttribute(k, v) {
          attrs[k] = String(v);
          if (k === 'id') el.id = String(v);
        },
        getAttribute(k) { return attrs[k] ?? null; },
        hasAttribute(k) { return k in attrs; },
        appendChild(c) {
          if (c) {
            c.parentNode = el;
            el.children.push(c);
          }
          return c;
        },
        removeChild(c) {
          const idx = el.children.indexOf(c);
          if (idx !== -1) el.children.splice(idx, 1);
          return c;
        },
        querySelector: (sel) => {
          function search(node) {
            for (const child of node.children || []) {
              if (sel.startsWith('.') && child.classList?.contains(sel.slice(1))) return child;
              if (sel.startsWith('#') && child.id === sel.slice(1)) return child;
              if (child.tagName?.toLowerCase() === sel.toLowerCase()) return child;
              const found = search(child);
              if (found) return found;
            }
            return null;
          }
          return search(el);
        },
        querySelectorAll: (sel) => {
          const found = [];
          function search(node) {
            for (const child of node.children || []) {
              if (sel.startsWith('.') && child.classList?.contains(sel.slice(1))) found.push(child);
              else if (sel.startsWith('#') && child.id === sel.slice(1)) found.push(child);
              else if (child.tagName?.toLowerCase() === sel.toLowerCase()) found.push(child);
              search(child);
            }
          }
          search(el);
          return found;
        },
        getBoundingClientRect: () => ({ top: 100, bottom: 200, left: 50, right: 250, width: 200, height: 100 }),
        focus: () => {},
        blur: () => {}
      };
      return el;
    }
  };

  globalThis.window = {
    innerWidth: 1200,
    innerHeight: 800,
    scrollX: 0,
    scrollY: 0,
    confirm: () => true,
    open: () => {}
  };
});

afterEach(() => {
  globalThis.document = origDocument;
  globalThis.chrome = origChrome;
  globalThis.window = origWindow;
});

test('filterSavableTabs filters out internal browser tabs and duplicates', () => {
  const tabs = [
    { id: 1, url: 'https://example.com/page1', title: 'Page 1', groupId: 10 },
    { id: 2, url: 'chrome://settings', title: 'Settings' },
    { id: 3, url: 'brave://rewards', title: 'Rewards' },
    { id: 4, url: 'about:blank', title: 'Blank' },
    { id: 5, url: 'https://www.example.com/page1', title: 'Page 1 copy' }, // duplicate of page1
    { id: 6, url: 'https://github.com/brave', title: 'GitHub' },
    { id: 7, url: 'file:///C:/test.html', title: 'Local File' }
  ];

  const filtered = filterSavableTabs(tabs);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].url, 'https://example.com/page1');
  assert.equal(filtered[0].groupId, 10);
  assert.equal(filtered[1].url, 'https://github.com/brave');
});

test('chromeColorFor maps colors and defaults safely', () => {
  assert.equal(chromeColorFor({ color: 'blue' }), 'blue');
  assert.equal(chromeColorFor({ color: 'purple' }), 'purple');
  assert.equal(chromeColorFor({ color: 'invalidColor' }), 'grey');
  assert.equal(chromeColorFor(null), 'grey');
  assert.equal(chromeColorFor({}), 'grey');
});

test('formatSavedBadgeDate formats date safely', () => {
  const dateStr = formatSavedBadgeDate('2026-10-05T12:00:00.000Z');
  assert.ok(dateStr.length > 0);
  assert.equal(formatSavedBadgeDate(''), '');
  assert.equal(formatSavedBadgeDate('not-a-date'), '');
});

test('tabsToCollections converts grouped and ungrouped tabs into collections', () => {
  const rawTabs = [
    { id: 101, url: 'https://github.com', title: 'GitHub', groupId: 1 },
    { id: 102, url: 'https://gitlab.com', title: 'GitLab', groupId: 1 },
    { id: 103, url: 'https://news.ycombinator.com', title: 'HN', groupId: -1 }
  ];

  const nativeGroups = [
    { id: 1, title: 'Dev Tools', color: 'green' }
  ];

  const result = tabsToCollections(rawTabs, nativeGroups, { spaceId: 'work-space' });
  assert.equal(result.totalCount, 3);
  assert.equal(result.newCategories.length, 2);

  // Grouped collection
  const devGroup = result.newCategories.find((c) => c.name === 'Dev Tools');
  assert.ok(devGroup);
  assert.equal(devGroup.color, 'green');
  assert.equal(devGroup.source, 'tabs');
  assert.equal(devGroup.spaceId, 'work-space');
  assert.equal(devGroup.bookmarks.length, 2);

  // Ungrouped session collection
  const sessionGroup = result.newCategories.find((c) => c.name.startsWith('Session ·'));
  assert.ok(sessionGroup);
  assert.equal(sessionGroup.source, 'tabs');
  assert.equal(sessionGroup.bookmarks.length, 1);
});

test('tabsToCollections supports appending to targetCategoryId', () => {
  const rawTabs = [
    { id: 201, url: 'https://wikipedia.org', title: 'Wiki', groupId: -1 }
  ];

  const result = tabsToCollections(rawTabs, [], { targetCategoryId: 'cat-target' });
  assert.equal(result.newCategories.length, 0);
  assert.equal(result.targetCategoryBookmarks.length, 1);
  assert.equal(result.targetCategoryBookmarks[0].url, 'https://wikipedia.org/');
});

test('saveCurrentTabs requests permissions and populates collections with undo support', async () => {
  const initial = createDefaultDashboardData();
  initial.categories = [];
  store.replaceData(initial);

  // Mock chrome permissions & tabs
  globalThis.chrome = {
    permissions: {
      contains: (query, cb) => cb(true),
      request: (query, cb) => cb(true)
    },
    tabs: {
      query: (filter, cb) => {
        cb([
          { id: 1, url: 'https://site-a.com', title: 'Site A', groupId: 5 },
          { id: 2, url: 'https://site-b.com', title: 'Site B', groupId: -1 }
        ]);
      },
      remove: () => {}
    },
    tabGroups: {
      query: (filter, cb) => {
        cb([{ id: 5, title: 'Work', color: 'blue' }]);
      }
    }
  };

  const res = await saveCurrentTabs();
  assert.equal(res.success, true);
  assert.equal(res.count, 2);

  const state = store.getState();
  assert.equal(state.categories.length, 2);
  const workCat = state.categories.find(c => c.name === 'Work');
  assert.ok(workCat);
  assert.equal(workCat.source, 'tabs');
  assert.equal(workCat.color, 'blue');
});

test('saveCurrentTabs fails gracefully when permission is denied', async () => {
  globalThis.chrome = {
    permissions: {
      contains: (query, cb) => cb(false),
      request: (query, cb) => cb(false)
    }
  };

  const res = await saveCurrentTabs();
  assert.equal(res.success, false);
  assert.equal(res.count, 0);
});

test('openCollectionAsGroup groups tabs via chrome.tabs.group and updates title/color', async () => {
  let createdUrls = [];
  let groupedIds = [];
  let updatedGroup = null;

  globalThis.chrome = {
    permissions: {
      contains: (query, cb) => cb(true),
      request: (query, cb) => cb(true)
    },
    tabs: {
      create: (opts, cb) => {
        createdUrls.push(opts.url);
        cb({ id: createdUrls.length });
      },
      group: (opts, cb) => {
        groupedIds = opts.tabIds;
        cb(42);
      }
    },
    tabGroups: {
      update: (groupId, opts, cb) => {
        updatedGroup = { groupId, ...opts };
        cb({ id: groupId });
      }
    }
  };

  const category = {
    id: 'test-cat',
    name: 'Research Papers',
    color: 'yellow',
    bookmarks: [
      { id: 'b1', name: 'Paper 1', url: 'https://arxiv.org/abs/1' },
      { id: 'b2', name: 'Paper 2', url: 'https://arxiv.org/abs/2' }
    ]
  };

  await openCollectionAsGroup(category);

  assert.equal(createdUrls.length, 2);
  assert.deepEqual(groupedIds, [1, 2]);
  assert.ok(updatedGroup);
  assert.equal(updatedGroup.groupId, 42);
  assert.equal(updatedGroup.title, 'Research Papers');
  assert.equal(updatedGroup.color, 'yellow');
});

test('renderCategoryCard shows saved-from-tabs-badge when source is tabs', () => {
  const categoryWithBadge = {
    id: 'cat-badge',
    name: 'Saved Session',
    color: 'blue',
    source: 'tabs',
    savedAt: '2026-10-05T12:00:00.000Z',
    bookmarks: []
  };

  const card = renderCategoryCard(categoryWithBadge, 0, 1);
  const badge = card.querySelector('.saved-from-tabs-badge');
  assert.ok(badge, 'Badge should be present when source is tabs');

  const categoryNormal = {
    id: 'cat-normal',
    name: 'Normal Category',
    bookmarks: []
  };
  const normalCard = renderCategoryCard(categoryNormal, 0, 1);
  const normalBadge = normalCard.querySelector('.saved-from-tabs-badge');
  assert.equal(normalBadge, null, 'Badge should not be present on normal category');
});

test('store.updateCategory clears source when user modifies collection name or color', () => {
  const initial = createDefaultDashboardData();
  initial.categories = [{
    id: 'cat-tabs',
    spaceId: 'default',
    name: 'My Saved Tabs',
    color: 'blue',
    source: 'tabs',
    savedAt: '2026-10-05T12:00:00.000Z',
    bookmarks: []
  }];
  store.replaceData(initial);

  // User edits name
  store.updateCategory('cat-tabs', { name: 'Renamed Tabs' });
  const updated = store.getState().categories.find(c => c.id === 'cat-tabs');
  assert.equal(updated.name, 'Renamed Tabs');
  assert.equal(updated.source, null, 'Editing name should clear source: tabs');
});
