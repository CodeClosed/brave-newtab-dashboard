// @ts-check
import { store } from '../core/state.js';
import { migrate } from '../core/migrate.js';
import { validateDashboardData, generateId } from '../core/schema.js';
import { normalizeUrl } from '../utils/url.js';

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
 *   summary?: { categoryCount: number, bookmarkCount: number },
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

  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'Backup root must be an object' };
  }

  // 1. Deep sanitize categories, deduplicate IDs, and strip dangerous URLs first
  const seenCatIds = new Set();
  const seenBmIds = new Set();
  let totalBookmarks = 0;

  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  const sanitizedCategories = categories.map((cat, cIdx) => {
    let catId = String(cat?.id || generateId());
    if (seenCatIds.has(catId)) catId = generateId();
    seenCatIds.add(catId);

    const bookmarks = Array.isArray(cat?.bookmarks) ? cat.bookmarks : [];
    const validBookmarks = [];

    bookmarks.forEach((bm, bIdx) => {
      let bmId = String(bm?.id || generateId());
      if (seenBmIds.has(bmId)) bmId = generateId();
      seenBmIds.add(bmId);

      const norm = normalizeUrl(bm?.url || '');
      // Only keep bookmarks with valid http/https URLs
      if (norm.valid) {
        validBookmarks.push({
          id: bmId,
          name: String(bm?.name || norm.domain).trim(),
          url: norm.url,
          order: typeof bm?.order === 'number' ? bm.order : bIdx
        });
        totalBookmarks++;
      }
    });

    return {
      id: catId,
      name: String(cat?.name || 'Collection').trim(),
      icon: String(cat?.icon || '📁'),
      order: typeof cat?.order === 'number' ? cat.order : cIdx,
      collapsed: Boolean(cat?.collapsed),
      bookmarks: validBookmarks
    };
  });

  raw.categories = sanitizedCategories;

  // 2. Run through migration runner to upgrade schema and fill missing settings
  const migrated = migrate(raw);

  // 3. Verify against schema validator
  const validation = validateDashboardData(migrated);
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] || 'Validation error' };
  }

  return {
    success: true,
    data: migrated,
    summary: {
      categoryCount: migrated.categories.length,
      bookmarkCount: totalBookmarks
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
