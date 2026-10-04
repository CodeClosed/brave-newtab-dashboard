// @ts-check
import { store } from '../core/state.js';
import { migrate, repairSettings, repairCategories, repairSpaces } from '../core/migrate.js';
import { CURRENT_SCHEMA_VERSION, validateDashboardData } from '../core/schema.js';

/**
 * Serializes dashboard state into a formatted JSON backup string.
 * Strips out device-specific image keys by default for portability.
 * @param {import('../core/schema.js').DashboardData} [data]
 * @returns {string}
 */
export function serializeDashboardExport(data = null) {
  const current = data || store.get();
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
 * Repairs and validates incoming raw dashboard data.
 * @param {any} raw
 * @returns {{
 *   success: boolean,
 *   data?: import('../core/schema.js').DashboardData,
 *   summary?: { categoryCount: number, bookmarkCount: number, skippedBookmarksCount: number },
 *   error?: string
 * }}
 */
export function repairAndValidateRawImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'File is not a valid dashboard backup (must be a JSON object)' };
  }

  // Must have a usable categories array to be considered a dashboard backup
  if (!Array.isArray(raw.categories)) {
    return { success: false, error: 'File is not a valid dashboard backup (missing categories array)' };
  }

  // Cap total bookmarks to 5,000
  let totalBookmarksInRaw = 0;
  for (const cat of raw.categories) {
    if (Array.isArray(cat?.bookmarks)) totalBookmarksInRaw += cat.bookmarks.length;
  }
  if (totalBookmarksInRaw > 5000) {
    return { success: false, error: 'Import exceeds maximum limit of 5,000 bookmarks' };
  }

  // Count incoming raw bookmarks before filtering
  let totalRawBookmarks = 0;
  raw.categories.forEach(cat => {
    if (cat && Array.isArray(cat.bookmarks)) {
      totalRawBookmarks += cat.bookmarks.length;
    }
  });

  // Spaces repair
  const { spaces, activeSpaceId } = repairSpaces(raw.spaces, raw.activeSpaceId);

  // Repair settings and categories item by item
  const repairedSettings = repairSettings(raw.settings);
  const repairedCategories = repairCategories(raw.categories, activeSpaceId);

  // Collect all valid bookmark IDs
  const allBmIds = new Set();
  let totalValidBookmarks = 0;
  repairedCategories.forEach(cat => {
    totalValidBookmarks += cat.bookmarks.length;
    cat.bookmarks.forEach(bm => allBmIds.add(bm.id));
  });

  // Prune pinned bookmarks in spaces that no longer exist
  spaces.forEach(sp => {
    sp.pinned = sp.pinned.filter(bmId => allBmIds.has(bmId));
  });

  const skippedBookmarksCount = Math.max(0, totalRawBookmarks - totalValidBookmarks);

  const targetVersion = (typeof raw.version === 'number' && raw.version > CURRENT_SCHEMA_VERSION)
    ? raw.version
    : CURRENT_SCHEMA_VERSION;

  const data = {
    version: targetVersion,
    activeSpaceId,
    spaces,
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

  // Cap import file size to 5 MB
  if (jsonString.length > 5 * 1024 * 1024) {
    return { success: false, error: 'Import file exceeds 5 MB limit' };
  }

  let raw;
  try {
    raw = JSON.parse(jsonString);
  } catch (err) {
    return { success: false, error: 'File is not valid JSON' };
  }

  return repairAndValidateRawImport(raw);
}

/**
 * Unescapes standard HTML entities.
 * @param {string} str
 * @returns {string}
 */
function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Parses Netscape bookmark HTML format using plain regex tokenizer fallback.
 * @param {string} htmlString
 * @returns {Array<{ name: string, bookmarks: Array<{ name: string, url: string }> }>}
 */
function parseNetscapeBookmarksHtmlPlain(htmlString) {
  /** @type {Map<string, Array<{ name: string, url: string }>>} */
  const categoriesMap = new Map();
  let currentFolder = 'Imported';

  const tokens = htmlString.split(/(<H3[^>]*>.*?<\/H3>|<A\s+[^>]*HREF=["'][^"']*["'][^>]*>.*?<\/A>)/is);

  for (const token of tokens) {
    const h3Match = token.match(/<H3[^>]*>(.*?)<\/H3>/i);
    if (h3Match) {
      currentFolder = unescapeHtml(h3Match[1].replace(/<[^>]+>/g, '').trim()) || 'Imported';
      continue;
    }

    const aMatch = token.match(/<A\s+[^>]*HREF=["']([^"']*)["'][^>]*>(.*?)<\/A>/i);
    if (aMatch) {
      const url = aMatch[1].trim();
      const name = unescapeHtml(aMatch[2].replace(/<[^>]+>/g, '').trim()) || url;
      if (!categoriesMap.has(currentFolder)) {
        categoriesMap.set(currentFolder, []);
      }
      categoriesMap.get(currentFolder)?.push({ name, url });
    }
  }

  /** @type {Array<{ name: string, bookmarks: Array<{ name: string, url: string }> }>} */
  const result = [];
  categoriesMap.forEach((bookmarks, name) => {
    if (bookmarks.length > 0) {
      result.push({ name, bookmarks });
    }
  });
  return result;
}

/**
 * Parses Netscape bookmarks HTML export file.
 * Uses DOMParser when available in browser, falling back to plain parser.
 *
 * @param {string} htmlString
 * @returns {Array<{ name: string, bookmarks: Array<{ name: string, url: string }> }>}
 */
export function parseNetscapeBookmarksHtml(htmlString) {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      /** @type {Map<string, Array<{ name: string, url: string }>>} */
      const categoriesMap = new Map();
      const defaultCatName = 'Imported';

      const h3s = Array.from(doc.querySelectorAll('h3'));
      if (h3s.length > 0) {
        h3s.forEach(h3 => {
          const folderName = (h3.textContent || '').trim() || defaultCatName;
          const nextDl = h3.parentElement?.querySelector('dl') || h3.nextElementSibling;
          const links = nextDl ? Array.from(nextDl.querySelectorAll('a')) : [];
          if (!categoriesMap.has(folderName)) {
            categoriesMap.set(folderName, []);
          }
          links.forEach(a => {
            const url = a.getAttribute('href') || '';
            const name = (a.textContent || '').trim() || url;
            if (url) categoriesMap.get(folderName)?.push({ name, url });
          });
        });
      }

      const allLinks = Array.from(doc.querySelectorAll('a'));
      const capturedLinks = new Set();
      categoriesMap.forEach(bms => bms.forEach(bm => capturedLinks.add(bm.url)));

      const uncaptured = allLinks.filter(a => !capturedLinks.has(a.getAttribute('href')));
      if (uncaptured.length > 0) {
        if (!categoriesMap.has(defaultCatName)) categoriesMap.set(defaultCatName, []);
        uncaptured.forEach(a => {
          const url = a.getAttribute('href') || '';
          const name = (a.textContent || '').trim() || url;
          if (url) categoriesMap.get(defaultCatName)?.push({ name, url });
        });
      }

      /** @type {Array<{ name: string, bookmarks: Array<{ name: string, url: string }> }>} */
      const result = [];
      categoriesMap.forEach((bookmarks, name) => {
        if (bookmarks.length > 0) {
          result.push({ name, bookmarks });
        }
      });
      if (result.length > 0) return result;
    } catch {}
  }

  return parseNetscapeBookmarksHtmlPlain(htmlString);
}

/**
 * Parses a single CSV line taking quotes and commas into account.
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses bookmarks from CSV format (name, url, collection).
 * @param {string} csvString
 * @returns {Array<{ name: string, bookmarks: Array<{ name: string, url: string }> }>}
 */
export function parseBookmarksCsv(csvString) {
  if (!csvString || typeof csvString !== 'string') return [];

  const rawLines = csvString.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  let nameIdx = 0;
  let urlIdx = 1;
  let colIdx = 2;
  let startIndex = 0;

  // Header detection
  const firstRow = parseCsvLine(rawLines[0]);
  const hasHeader = firstRow.some(col => {
    const lower = col.toLowerCase();
    return lower === 'url' || lower === 'name' || lower === 'collection' || lower === 'category';
  });

  if (hasHeader) {
    startIndex = 1;
    const lowerHeaders = firstRow.map(h => h.toLowerCase());
    const nIdx = lowerHeaders.findIndex(h => h.includes('name') || h.includes('title'));
    const uIdx = lowerHeaders.findIndex(h => h.includes('url') || h.includes('link') || h.includes('href'));
    const cIdx = lowerHeaders.findIndex(h => h.includes('col') || h.includes('cat') || h.includes('folder'));

    if (uIdx !== -1) urlIdx = uIdx;
    if (nIdx !== -1) nameIdx = nIdx;
    if (cIdx !== -1) colIdx = cIdx;
  }

  /** @type {Map<string, Array<{ name: string, url: string }>>} */
  const categoriesMap = new Map();

  for (let i = startIndex; i < rawLines.length; i++) {
    const cols = parseCsvLine(rawLines[i]);
    if (cols.length < 2 && !cols[urlIdx]) continue;

    const url = (cols[urlIdx] || '').trim();
    const name = (cols[nameIdx] || '').trim();
    const collection = (cols[colIdx] || '').trim() || 'Imported';

    if (!url) continue;

    if (!categoriesMap.has(collection)) {
      categoriesMap.set(collection, []);
    }
    categoriesMap.get(collection)?.push({ name: name || url, url });
  }

  /** @type {Array<{ name: string, bookmarks: Array<{ name: string, url: string }> }>} */
  const result = [];
  categoriesMap.forEach((bookmarks, name) => {
    if (bookmarks.length > 0) {
      result.push({ name, bookmarks });
    }
  });
  return result;
}

/**
 * Parses and validates bookmarks import from JSON, Netscape HTML, or CSV.
 * Pushes through the same validation, repair, preview and snapshot pipeline.
 *
 * @param {string} content
 * @param {'json' | 'html' | 'csv' | 'auto'} [format='auto']
 * @returns {{
 *   success: boolean,
 *   data?: import('../core/schema.js').DashboardData,
 *   summary?: { categoryCount: number, bookmarkCount: number, skippedBookmarksCount: number },
 *   error?: string
 * }}
 */
export function parseAndValidateBookmarksImport(content, format = 'auto') {
  if (!content || typeof content !== 'string') {
    return { success: false, error: 'Empty file contents' };
  }

  if (content.length > 5 * 1024 * 1024) {
    return { success: false, error: 'Import file exceeds 5 MB limit' };
  }

  let resolvedFormat = format;
  if (resolvedFormat === 'auto') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      resolvedFormat = 'json';
    } else if (trimmed.includes('<!DOCTYPE') || trimmed.includes('<H3') || trimmed.includes('<DL') || trimmed.includes('<A HREF') || trimmed.includes('<TITLE>Bookmarks')) {
      resolvedFormat = 'html';
    } else {
      resolvedFormat = 'csv';
    }
  }

  if (resolvedFormat === 'json') {
    return parseAndValidateImport(content);
  }

  if (resolvedFormat === 'html') {
    const rawCategories = parseNetscapeBookmarksHtml(content);
    if (!rawCategories || rawCategories.length === 0) {
      return { success: false, error: 'No bookmarks found in HTML file' };
    }
    return repairAndValidateRawImport({ categories: rawCategories });
  }

  if (resolvedFormat === 'csv') {
    const rawCategories = parseBookmarksCsv(content);
    if (!rawCategories || rawCategories.length === 0) {
      return { success: false, error: 'No bookmarks found in CSV file' };
    }
    return repairAndValidateRawImport({ categories: rawCategories });
  }

  return { success: false, error: `Unsupported import format "${resolvedFormat}"` };
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
