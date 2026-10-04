// @ts-check

/**
 * Valid layout column settings.
 */
export const VALID_COLUMNS = ['auto', 1, 2, 3, 4, 5, 6];

/**
 * Applies layout controls (columns, card width, gap, alignment, vertical centering) to the root element.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 * @param {HTMLElement | { style: { setProperty: Function }, setAttribute: Function, getAttribute?: Function }} [rootElement]
 */
export function applyLayoutSettings(settings, rootElement) {
  const root = rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root) return;

  const cards = settings?.cards || {};

  // Columns: 'auto' or 1..6
  let cols = cards.columns;
  if (typeof cols === 'string' && cols !== 'auto') {
    const parsed = parseInt(cols, 10);
    cols = isNaN(parsed) ? 'auto' : parsed;
  }
  if (!VALID_COLUMNS.includes(cols)) {
    cols = 'auto';
  }

  // Width: 200..600 (default 340)
  const width = (typeof cards.width === 'number' && cards.width >= 200 && cards.width <= 600)
    ? cards.width
    : 340;

  // Gap: 0..48 (default 16)
  const gap = (typeof cards.gap === 'number' && cards.gap >= 0 && cards.gap <= 48)
    ? cards.gap
    : 16;

  // Alignment: 'center' | 'left'
  const align = cards.align === 'left' ? 'left' : 'center';

  // Vertical Centering: boolean
  const verticalCenter = Boolean(cards.verticalCenter);

  if (typeof root.setAttribute === 'function') {
    root.setAttribute('data-columns', String(cols));
    root.setAttribute('data-layout-align', align);
    root.setAttribute('data-vertical-center', String(verticalCenter));
  }

  if (root.style && typeof root.style.setProperty === 'function') {
    root.style.setProperty('--card-width', `${width}px`);
    root.style.setProperty('--card-gap', `${gap}px`);
    if (cols !== 'auto') {
      root.style.setProperty('--layout-columns', String(cols));
    } else {
      root.style.setProperty('--layout-columns', 'auto');
    }
  }
}
