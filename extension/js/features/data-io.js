// @ts-check
import { store } from '../core/state.js';
import { migrate, repairSettings, repairCategories } from '../core/migrate.js';
import { CURRENT_SCHEMA_VERSION, validateDashboardData } from '../core/schema.js';

/**
 * Serializes dashboard state into a formatted JSON backup string.
 * Strips out device-specific image keys by default for portability.
 * @returns {string}
 */
export function serializeDashboardExport() {
  const current = store.get();
  const exportData = JSON.parse(JSON.stringify(current));

  // If background is custom image, sanitize value in export
  if (exportData.settings?.background?.type === 'image') {
    exportData.settings.background.value = null;
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Triggers a browser file download of the JSON backup.
 */
export function exportDashboardToFile() {
  const jsonString = serializeDashboardExport();
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `newtab-dashboard-backup-${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Validates, repairs, migrates, and deduplicates an imported JSON string.
 * Never blindly trusts incoming user data.
 *
 * @param {string} jsonString
 * @returns {{
 *   success: boolean,
 *   data?: import('../core/schema.js').DashboardData,
 *   summary?: { categoryCount: number, bookmarkCount: number, skippedBookmarksCount: number },
 *   error?: string
 * }}
 */
export function parseAndValidateImport(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Empty file contents' };
  }

  let raw;
  try {
    raw = JSON.parse(jsonString);
  } catch (err) {
    return { success: false, error: 'File is not valid JSON' };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'File is not a valid dashboard backup (must be a JSON object)' };
  }

  // Must have a usable categories array to be considered a dashboard backup
  if (!Array.isArray(raw.categories)) {
    return { success: false, error: 'File is not a valid dashboard backup (missing categories array)' };
  }

  // Count incoming raw bookmarks before filtering
  let totalRawBookmarks = 0;
  raw.categories.forEach(cat => {
    if (cat && Array.isArray(cat.bookmarks)) {
      totalRawBookmarks += cat.bookmarks.length;
    }
  });

  // Repair settings and categories item by item
  const repairedSettings = repairSettings(raw.settings);
  const repairedCategories = repairCategories(raw.categories);

  let totalValidBookmarks = 0;
  repairedCategories.forEach(cat => {
    totalValidBookmarks += cat.bookmarks.length;
  });

  const skippedBookmarksCount = Math.max(0, totalRawBookmarks - totalValidBookmarks);

  const targetVersion = (typeof raw.version === 'number' && raw.version > CURRENT_SCHEMA_VERSION)
    ? raw.version
    : CURRENT_SCHEMA_VERSION;

  const data = {
    version: targetVersion,
    settings: repairedSettings,
    categories: repairedCategories
  };

  return {
    success: true,
    data,
    summary: {
      categoryCount: data.categories.length,
      bookmarkCount: totalValidBookmarks,
      skippedBookmarksCount
    }
  };
}

/**
 * Optional Stretch Feature: Dynamically requests the optional 'bookmarks' permission
 * and imports browser bookmark folders into collections.
 *
 * @returns {Promise<{ success: boolean, count?: number, error?: string }>}
 */
export async function importFromBrowserBookmarks() {
  if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.bookmarks) {
    return { success: false, error: 'Browser bookmarks API is not available in this environment' };
  }

  // Request permission dynamically at user interaction time (least privilege principle)
  const granted = await chrome.permissions.request({ permissions: ['bookmarks'] });
  if (!granted) {
    return { success: false, error: 'Permission to access browser bookmarks was declined' };
  }

  try {
    const tree = await chrome.bookmarks.getTree();
    const newCategories = [];
    let importedBookmarks = 0;

    /**
     * Recursively traverses chrome bookmark tree nodes.
     * @param {chrome.bookmarks.BookmarkTreeNode[]} nodes
     */
    function traverse(nodes) {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          const links = node.children.filter(c => Boolean(c.url));
          if (links.length > 0 && node.title) {
            const bookmarks = [];
            for (const link of links) {
              const norm = normalizeUrl(link.url || '');
              if (norm.valid) {
                bookmarks.push({
                  id: generateId(),
                  name: link.title || norm.domain,
                  url: norm.url,
                  order: bookmarks.length
                });
                importedBookmarks++;
              }
            }
            if (bookmarks.length > 0) {
              newCategories.push({
                id: generateId(),
                name: node.title,
                icon: '🔖',
                order: newCategories.length,
                collapsed: false,
                bookmarks
              });
            }
          }
          traverse(node.children);
        }
      }
    }

    traverse(tree);

    if (newCategories.length === 0) {
      return { success: false, error: 'No bookmark folders with links were found' };
    }

    // Merge into current categories
    const current = store.get();
    const updatedCategories = [...current.categories, ...newCategories];
    updatedCategories.forEach((cat, idx) => { cat.order = idx; });
    store.setCategories(updatedCategories);

    return { success: true, count: importedBookmarks };
  } catch (err) {
    return { success: false, error: 'Failed to read browser bookmarks' };
  }
}
