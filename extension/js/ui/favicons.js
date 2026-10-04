// @ts-check
import { el } from '../utils/dom.js';
import { getDomainFromUrl } from '../utils/url.js';

// Calming, muted, accessible palette for letter tile fallbacks matching docs/DESIGN_SYSTEM.md
// Low saturation (<= 0.40) and high contrast with white letters (>= 4.5:1 WCAG AA)
export const TILE_PALETTE = [
  '#334155', // Muted Slate
  '#2c4663', // Muted Steel Blue
  '#2b534d', // Muted Sage Teal
  '#374f38', // Muted Olive Forest
  '#61492c', // Muted Warm Bronze
  '#693b36', // Muted Terracotta Rust
  '#533d5b', // Muted Mauve Plum
  '#44403c'  // Muted Warm Stone
];

// In-memory cache for confirmed domain favicon status:
// domain -> true (has real custom favicon) | false (matches default generic icon / no favicon)
const domainFaviconStatusCache = new Map();

let defaultFaviconHash = null;
let defaultFaviconHashPromise = null;

/**
 * Resets cache and probe state for testing.
 */
export function _resetFaviconCacheForTests() {
  domainFaviconStatusCache.clear();
  defaultFaviconHash = null;
  defaultFaviconHashPromise = null;
}

/**
 * Fast 32-bit FNV-1a hash of an ArrayBuffer.
 * @param {ArrayBuffer} buffer
 * @returns {number}
 */
export function hashBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Probes Chrome's _favicon endpoint with a guaranteed-unknown host to obtain
 * the hash of Chrome's generic fallback icon.
 * @returns {Promise<number | null>}
 */
export async function detectDefaultFaviconHash() {
  if (defaultFaviconHash !== null) {
    return defaultFaviconHash;
  }
  if (defaultFaviconHashPromise) {
    return defaultFaviconHashPromise;
  }

  const canUseChromeFavicon = typeof chrome !== 'undefined' &&
                              typeof chrome.runtime !== 'undefined' &&
                              typeof chrome.runtime.getURL === 'function';
  if (!canUseChromeFavicon || typeof fetch === 'undefined') {
    return null;
  }

  defaultFaviconHashPromise = (async () => {
    try {
      const probeUrl = new URL(chrome.runtime.getURL('/_favicon/'));
      probeUrl.searchParams.set('pageUrl', 'https://guaranteed-unknown-host-probe-' + Date.now() + '.invalid');
      probeUrl.searchParams.set('size', '32');
      const res = await fetch(probeUrl.toString());
      if (res.ok) {
        const buf = await res.arrayBuffer();
        defaultFaviconHash = hashBytes(buf);
      }
    } catch {
      defaultFaviconHash = null;
    }
    return defaultFaviconHash;
  })();

  return defaultFaviconHashPromise;
}

/**
 * Returns a deterministic color for a given domain string.
 * @param {string} domain
 * @returns {string}
 */
function getDomainColor(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash << 5) - hash + domain.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TILE_PALETTE.length;
  return TILE_PALETTE[index];
}

/**
 * Creates a deterministic letter tile fallback element.
 * @param {string} title
 * @param {string} domain
 * @returns {HTMLElement}
 */
export function createLetterTile(title, domain) {
  const char = (title.trim()[0] || domain.trim()[0] || '?').toUpperCase();
  const bgColor = getDomainColor(domain || title);

  return el('div', {
    className: 'letter-tile',
    style: { backgroundColor: bgColor },
    'aria-hidden': 'true',
    text: char
  });
}

/**
 * Renders a favicon container element for a bookmark.
 * Non-blocking: renders the letter tile first, probes/checks the _favicon endpoint in the background,
 * and swaps in the real <img> only when confirmed that the favicon is not Chrome's generic default.
 * Caches per-domain results in memory for instantaneous subsequent renders.
 *
 * @param {string} pageUrl
 * @param {string} title
 * @returns {HTMLElement}
 */
export function createFaviconElement(pageUrl, title) {
  const container = el('div', { className: 'favicon-container' });
  const domain = getDomainFromUrl(pageUrl);

  // Always create and mount the letter tile first (non-blocking)
  const tile = createLetterTile(title, domain);
  container.appendChild(tile);

  const canUseChromeFavicon = typeof chrome !== 'undefined' &&
                              typeof chrome.runtime !== 'undefined' &&
                              typeof chrome.runtime.getURL === 'function';

  if (!canUseChromeFavicon || !pageUrl) {
    return container;
  }

  // If already cached as having no custom favicon, keep letter tile
  if (domain && domainFaviconStatusCache.get(domain) === false) {
    return container;
  }

  let faviconUrl;
  try {
    faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
    faviconUrl.searchParams.set('pageUrl', pageUrl);
    faviconUrl.searchParams.set('size', '32');
  } catch {
    return container;
  }

  // Helper to swap in the real icon element
  const swapInRealIcon = () => {
    const img = el('img', {
      className: 'favicon-img',
      src: faviconUrl.toString(),
      alt: '',
      loading: 'lazy'
    });

    img.addEventListener('error', () => {
      if (domain) domainFaviconStatusCache.set(domain, false);
      if (img.parentNode === container) {
        container.removeChild(img);
        container.appendChild(createLetterTile(title, domain));
      }
    });

    if (tile.parentNode === container) {
      container.replaceChild(img, tile);
    }
  };

  // If already cached as having a confirmed real favicon, swap immediately
  if (domain && domainFaviconStatusCache.get(domain) === true) {
    swapInRealIcon();
    return container;
  }

  // Non-blocking asynchronous verification
  (async () => {
    try {
      const defaultHash = await detectDefaultFaviconHash();
      const res = await fetch(faviconUrl.toString());
      if (!res.ok) {
        if (domain) domainFaviconStatusCache.set(domain, false);
        return;
      }

      const buf = await res.arrayBuffer();
      const thisHash = hashBytes(buf);

      if (defaultHash !== null && thisHash === defaultHash) {
        // Matches generic default icon -> keep letter tile!
        if (domain) domainFaviconStatusCache.set(domain, false);
      } else {
        // Real favicon confirmed!
        if (domain) domainFaviconStatusCache.set(domain, true);
        swapInRealIcon();
      }
    } catch {
      if (domain) domainFaviconStatusCache.set(domain, false);
    }
  })();

  return container;
}

/**
 * Evicts domain favicon status from the in-memory cache to force retry.
 * @param {string} pageUrl
 * @returns {boolean}
 */
export function refreshFavicon(pageUrl) {
  if (!pageUrl) return false;
  const domain = getDomainFromUrl(pageUrl);
  if (domain) {
    domainFaviconStatusCache.delete(domain);
    return true;
  }
  return false;
}

