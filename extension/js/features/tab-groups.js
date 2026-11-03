// @ts-check
import { generateId, VALID_TAB_GROUP_COLORS } from '../core/schema.js';
import { normalizeUrl } from '../utils/url.js';
import { getCanonicalUrlForDeduplication } from './duplicates.js';
import { ensurePermissions } from './permissions.js';
import { store } from '../core/state.js';
import { showToast } from '../ui/toasts.js';
import { createSnapshot } from '../core/snapshots.js';
import { openAllCollectionLinks } from './pinned.js';

/**
 * Filter tabs down to savable web URLs.
 * Drops internal browser pages (chrome://, brave://, about:, file:, etc.) and duplicates.
 *
 * @param {Array<any>} tabs
 * @returns {Array<{ id: number, url: string, title: string, groupId?: number }>}
 */
export function filterSavableTabs(tabs) {
  if (!Array.isArray(tabs)) return [];

  const seenCanonical = new Set();
  const results = [];

  for (const tab of tabs) {
    if (!tab || !tab.url || typeof tab.url !== 'string') continue;
    const trimmedUrl = tab.url.trim();

    // Skip internal schemes
    const lowerUrl = trimmedUrl.toLowerCase();
    if (
      lowerUrl.startsWith('chrome://') ||
      lowerUrl.startsWith('chrome-extension://') ||
      lowerUrl.startsWith('brave://') ||
      lowerUrl.startsWith('edge://') ||
      lowerUrl.startsWith('about:') ||
      lowerUrl.startsWith('file:') ||
      lowerUrl.startsWith('devtools://') ||
      lowerUrl.startsWith('view-source:')
    ) {
      continue;
    }

    const norm = normalizeUrl(trimmedUrl);
    if (!norm.valid) continue;

    const canonical = getCanonicalUrlForDeduplication(norm.url);
    if (seenCanonical.has(canonical)) continue;
    seenCanonical.add(canonical);

    results.push({
      id: tab.id,
      url: norm.url,
      title: (tab.title || norm.url).trim(),
      groupId: typeof tab.groupId === 'number' ? tab.groupId : -1
    });
  }

  return results;
}

/**
 * Maps a category's color property to a valid Chrome Tab Group color.
 * Defaults to 'grey'.
 *
 * @param {{ color?: string | null }} category
 * @returns {string}
 */
export function chromeColorFor(category) {
  if (category?.color && VALID_TAB_GROUP_COLORS.includes(category.color)) {
    return category.color;
  }
  return 'grey';
}

/**
 * Formats a savedAt ISO string into a concise badge date (e.g. "5 Oct").
 * @param {string} isoString
 * @returns {string}
 */
export function formatSavedBadgeDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/**
 * Converts tabs and optional native group info into category definitions.
 * Grouped tabs become individual collections; ungrouped tabs become a Session collection
 * or are designated for a target category.
 *
 * @param {Array<any>} rawTabs
 * @param {Array<any>} [nativeGroups=[]]
 * @param {object} [options={}]
 * @param {string} [options.spaceId]
 * @param {string} [options.targetCategoryId]
 * @returns {{ newCategories: Array<import('../core/schema.js').Category>, targetCategoryBookmarks: Array<import('../core/schema.js').Bookmark>, totalCount: number, tabIds: number[] }}
 */
export function tabsToCollections(rawTabs, nativeGroups = [], options = {}) {
  const tabs = filterSavableTabs(rawTabs);
  if (tabs.length === 0) {
    return { newCategories: [], targetCategoryBookmarks: [], totalCount: 0, tabIds: [] };
  }

  const spaceId = options.spaceId || store.getState().activeSpaceId || 'default';
  const nowIso = new Date().toISOString();
  const tabIds = tabs.map((t) => t.id).filter((id) => typeof id === 'number');

  // Partition by groupId
  const groupedTabsMap = new Map();
  const ungroupedTabs = [];

  for (const tab of tabs) {
    if (tab.groupId && tab.groupId !== -1) {
      if (!groupedTabsMap.has(tab.groupId)) {
        groupedTabsMap.set(tab.groupId, []);
      }
      groupedTabsMap.get(tab.groupId).push(tab);
    } else {
      ungroupedTabs.push(tab);
    }
  }

  const newCategories = [];

  // 1. Convert native tab groups to collections
  for (const [groupId, groupTabs] of groupedTabsMap.entries()) {
    const groupInfo = Array.isArray(nativeGroups) ? nativeGroups.find((g) => g.id === groupId) : null;
    const name = groupInfo?.title?.trim() || 'Tab Group';
    const color = groupInfo?.color && VALID_TAB_GROUP_COLORS.includes(groupInfo.color) ? groupInfo.color : 'blue';

    const bookmarks = groupTabs.map((t, idx) => ({
      id: generateId(),
      name: t.title,
      url: t.url,
      order: idx,
      icon: null
    }));

    newCategories.push({
      id: generateId(),
      spaceId,
      name,
      icon: 'layers',
      color,
      source: 'tabs',
      savedAt: nowIso,
      collapsed: false,
      displayMode: null,
      accent: null,
      order: 0,
      bookmarks
    });
  }

  // 2. Ungrouped tabs
  let targetCategoryBookmarks = [];
  if (ungroupedTabs.length > 0) {
    if (options.targetCategoryId) {
      targetCategoryBookmarks = ungroupedTabs.map((t, idx) => ({
        id: generateId(),
        name: t.title,
        url: t.url,
        order: idx,
        icon: null
      }));
    } else {
      const now = new Date();
      const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      const dateStr = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const name = `Session · ${dateStr}, ${timeStr}`;

      const bookmarks = ungroupedTabs.map((t, idx) => ({
        id: generateId(),
        name: t.title,
        url: t.url,
        order: idx,
        icon: null
      }));

      newCategories.push({
        id: generateId(),
        spaceId,
        name,
        icon: 'layers',
        color: 'blue',
        source: 'tabs',
        savedAt: nowIso,
        collapsed: false,
        displayMode: null,
        accent: null,
        order: 0,
        bookmarks
      });
    }
  }

  return {
    newCategories,
    targetCategoryBookmarks,
    totalCount: tabs.length,
    tabIds
  };
}

/**
 * Saves current window tabs into dashboard collections.
 * Requests optional 'tabs' & 'tabGroups' permissions first.
 *
 * @param {object} [options={}]
 * @param {string} [options.targetCategoryId]
 * @returns {Promise<{ success: boolean, count: number, tabIds: number[] }>}
 */
export async function saveCurrentTabs(options = {}) {
  // Ensure permissions
  const hasPerm = await ensurePermissions(['tabs', 'tabGroups']);
  if (!hasPerm) {
    showToast('Tabs permission required to save open tabs');
    return { success: false, count: 0, tabIds: [] };
  }

  if (typeof chrome === 'undefined' || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
    showToast('Tabs API not available in this environment');
    return { success: false, count: 0, tabIds: [] };
  }

  try {
    const rawTabs = await new Promise((resolve, reject) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (chrome.runtime?.lastError) reject(chrome.runtime.lastError);
        else resolve(tabs || []);
      });
    });

    let nativeGroups = [];
    if (chrome.tabGroups && typeof chrome.tabGroups.query === 'function') {
      try {
        nativeGroups = await new Promise((resolve) => {
          chrome.tabGroups.query({}, (groups) => {
            if (chrome.runtime?.lastError) resolve([]);
            else resolve(groups || []);
          });
        });
      } catch {
        nativeGroups = [];
      }
    }

    const { newCategories, targetCategoryBookmarks, totalCount, tabIds } = tabsToCollections(rawTabs, nativeGroups, options);

    if (totalCount === 0) {
      showToast('No savable web tabs found in this window');
      return { success: false, count: 0, tabIds: [] };
    }

    const currentState = store.getState();
    const undoSnapshot = JSON.parse(JSON.stringify(currentState));

    // Save snapshot in snapshot history
    createSnapshot('Before saving tabs', currentState).catch(() => {});

    if (options.targetCategoryId) {
      const cat = currentState.categories?.find((c) => c.id === options.targetCategoryId);
      if (cat) {
        if (!Array.isArray(cat.bookmarks)) cat.bookmarks = [];
        const startOrder = cat.bookmarks.length;
        targetCategoryBookmarks.forEach((bm, i) => {
          bm.order = startOrder + i;
          cat.bookmarks.push(bm);
        });
        cat.source = 'tabs';
        cat.savedAt = new Date().toISOString();
        store.updateCategory(cat.id, { bookmarks: cat.bookmarks, source: 'tabs', savedAt: cat.savedAt });
      }
    } else {
      newCategories.forEach((cat) => {
        store.addCategory(cat);
      });
    }

    const closeAfterSave = Boolean(currentState.settings?.tabs?.closeAfterSave);
    if (closeAfterSave && tabIds.length > 0 && typeof chrome.tabs.remove === 'function') {
      try {
        chrome.tabs.remove(tabIds);
      } catch {}
    }

    const toastMsg = `Saved ${totalCount} tab${totalCount === 1 ? '' : 's'}`;
    const undoAction = () => {
      store.replaceData(undoSnapshot);
      showToast('Restored previous collections');
    };

    showToast(toastMsg, undoAction);

    return { success: true, count: totalCount, tabIds };
  } catch (err) {
    console.error('saveCurrentTabs failed:', err);
    showToast('Could not save current tabs');
    return { success: false, count: 0, tabIds: [] };
  }
}

/**
 * Opens all links in a collection and groups them into a native Chrome Tab Group.
 * Prompts confirmation if bookmarks exceed 10.
 * Falls back to plain openAllCollectionLinks if permissions are refused or tabGroups unavailable.
 *
 * @param {import('../core/schema.js').Category} category
 * @param {object} [options={}]
 * @param {(msg: string) => boolean} [options.confirmFn]
 * @returns {Promise<void>}
 */
export async function openCollectionAsGroup(category, options = {}) {
  if (!category || !Array.isArray(category.bookmarks) || category.bookmarks.length === 0) {
    return;
  }

  const bookmarks = category.bookmarks.filter((b) => b && b.url);
  if (bookmarks.length === 0) return;

  if (bookmarks.length > 10) {
    const confirmFn = options.confirmFn || (typeof window !== 'undefined' ? window.confirm.bind(window) : () => true);
    const confirmed = confirmFn(`Open all ${bookmarks.length} links as a tab group?`);
    if (!confirmed) return;
  }

  // Check tab & tabGroups permissions
  const hasPerm = await ensurePermissions(['tabs', 'tabGroups']);
  const canGroup = hasPerm &&
    typeof chrome !== 'undefined' &&
    chrome.tabs &&
    typeof chrome.tabs.group === 'function' &&
    chrome.tabGroups &&
    typeof chrome.tabGroups.update === 'function';

  if (!canGroup) {
    // Fall back to plain open all
    await openAllCollectionLinks(bookmarks, options);
    showToast(`Opened ${bookmarks.length} tabs`);
    return;
  }

  try {
    const createdTabIds = [];
    for (const bm of bookmarks) {
      const tab = await new Promise((resolve) => {
        chrome.tabs.create({ url: bm.url, active: false }, (t) => {
          resolve(t);
        });
      });
      if (tab?.id) createdTabIds.push(tab.id);
    }

    if (createdTabIds.length > 0) {
      const groupId = await new Promise((resolve, reject) => {
        chrome.tabs.group({ tabIds: createdTabIds }, (gId) => {
          if (chrome.runtime?.lastError) reject(chrome.runtime.lastError);
          else resolve(gId);
        });
      });

      if (typeof groupId === 'number') {
        const groupColor = chromeColorFor(category);
        await new Promise((resolve) => {
          chrome.tabGroups.update(groupId, {
            title: category.name,
            color: groupColor,
            collapsed: false
          }, () => resolve(true));
        });
      }
    }

    showToast(`Opened tab group "${category.name}"`);
  } catch (err) {
    console.warn('Failed to group tabs, falling back:', err);
    await openAllCollectionLinks(bookmarks, options);
  }
}
