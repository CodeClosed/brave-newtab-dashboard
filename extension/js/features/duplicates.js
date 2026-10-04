// @ts-check
import { normalizeUrl } from '../utils/url.js';

/**
 * Normalizes URL for duplicate comparison:
 * - Lowercase hostname
 * - Strip leading 'www.'
 * - Strip trailing slashes from pathname
 * - Strip URL fragments/hash
 * - Case-preserve query parameters
 *
 * @param {string} rawUrl
 * @returns {string}
 */
export function getCanonicalUrlForDeduplication(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const norm = normalizeUrl(trimmed);
  const targetUrl = norm.valid ? norm.url : trimmed;

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '');
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${host}${port}${path}${parsed.search}`;
  } catch {
    return targetUrl.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Checks all categories and bookmarks to see if a bookmark with the same canonical URL already exists.
 *
 * @param {string} rawUrl
 * @param {Array<import('../core/schema.js').Category>} categories
 * @param {string | null} [excludeBookmarkId=null]
 * @returns {{ category: import('../core/schema.js').Category, bookmark: import('../core/schema.js').Bookmark } | null}
 */
export function findDuplicateBookmark(rawUrl, categories, excludeBookmarkId = null) {
  if (!rawUrl || !Array.isArray(categories)) return null;
  const canonical = getCanonicalUrlForDeduplication(rawUrl);
  if (!canonical) return null;

  for (const cat of categories) {
    if (!cat || !Array.isArray(cat.bookmarks)) continue;
    for (const bm of cat.bookmarks) {
      if (!bm || !bm.url) continue;
      if (excludeBookmarkId && bm.id === excludeBookmarkId) continue;

      const bmCanonical = getCanonicalUrlForDeduplication(bm.url);
      if (bmCanonical === canonical) {
        return {
          category: cat,
          bookmark: bm
        };
      }
    }
  }

  return null;
}
