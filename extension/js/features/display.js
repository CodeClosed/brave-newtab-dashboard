// @ts-check

/**
 * Valid display modes.
 */
export const VALID_DISPLAY_MODES = ['list', 'grid', 'icons'];

/**
 * Valid tile shapes.
 */
export const VALID_TILE_SHAPES = ['rounded', 'square', 'circle'];

/**
 * Valid density settings.
 */
export const VALID_DENSITIES = ['comfortable', 'compact'];

/**
 * Resolves the effective display mode for a category, checking per-collection
 * override with fallback to the global settings default.
 *
 * @param {import('../core/schema.js').Category | { displayMode?: string | null }} [category]
 * @param {import('../core/schema.js').DashboardData['settings']} [settings]
 * @returns {'list' | 'grid' | 'icons'}
 */
export function resolveCategoryDisplayMode(category, settings) {
  if (category && typeof category.displayMode === 'string' && VALID_DISPLAY_MODES.includes(category.displayMode)) {
    return /** @type {'list' | 'grid' | 'icons'} */ (category.displayMode);
  }

  const defaultMode = settings?.display?.defaultMode;
  if (typeof defaultMode === 'string' && VALID_DISPLAY_MODES.includes(defaultMode)) {
    return /** @type {'list' | 'grid' | 'icons'} */ (defaultMode);
  }

  return 'list';
}

/**
 * Applies global bookmark display settings to root element.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 * @param {HTMLElement | { style: { setProperty: Function }, setAttribute: Function }} [rootElement]
 */
export function applyDisplaySettings(settings, rootElement) {
  const root = rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root) return;

  const display = settings?.display || {};

  const tileShape = VALID_TILE_SHAPES.includes(display.tileShape) ? display.tileShape : 'rounded';
  const density = VALID_DENSITIES.includes(display.density) ? display.density : 'comfortable';
  const showDomains = display.showDomains !== false;
  const iconSize = (typeof display.iconSize === 'number' && display.iconSize >= 14 && display.iconSize <= 48)
    ? display.iconSize
    : 20;

  if (typeof root.setAttribute === 'function') {
    root.setAttribute('data-tile-shape', tileShape);
    root.setAttribute('data-density', density);
    root.setAttribute('data-show-domains', String(showDomains));
  }

  if (root.style && typeof root.style.setProperty === 'function') {
    root.style.setProperty('--icon-size', `${iconSize}px`);
  }
}
