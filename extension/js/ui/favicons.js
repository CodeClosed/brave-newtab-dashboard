// @ts-check
import { el } from '../utils/dom.js';
import { getDomainFromUrl } from '../utils/url.js';

// Calming, accessible palette for letter tile fallbacks
const TILE_PALETTE = [
  '#475569', // Slate
  '#2563eb', // Blue
  '#0d9488', // Teal
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#7c3aed', // Purple
  '#db2777'  // Pink
];

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
 * Uses chrome.runtime.getURL('/_favicon/') if available, with programmatic fallback to letter tile.
 *
 * @param {string} pageUrl
 * @param {string} title
 * @returns {HTMLElement}
 */
export function createFaviconElement(pageUrl, title) {
  const container = el('div', { className: 'favicon-container' });
  const domain = getDomainFromUrl(pageUrl);

  const canUseChromeFavicon = typeof chrome !== 'undefined' &&
                              typeof chrome.runtime !== 'undefined' &&
                              typeof chrome.runtime.getURL === 'function';

  if (!canUseChromeFavicon) {
    // Direct letter tile when outside extension runtime
    container.appendChild(createLetterTile(title, domain));
    return container;
  }

  try {
    const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
    faviconUrl.searchParams.set('pageUrl', pageUrl);
    faviconUrl.searchParams.set('size', '32');

    const img = el('img', {
      className: 'favicon-img',
      src: faviconUrl.toString(),
      alt: '',
      loading: 'lazy'
    });

    img.addEventListener('error', () => {
      // Replace failed image with letter tile
      if (img.parentNode === container) {
        container.removeChild(img);
        container.appendChild(createLetterTile(title, domain));
      }
    });

    container.appendChild(img);
  } catch (err) {
    container.appendChild(createLetterTile(title, domain));
  }

  return container;
}
