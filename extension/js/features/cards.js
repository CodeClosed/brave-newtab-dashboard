// @ts-check

/**
 * Valid card style names.
 */
export const VALID_CARD_STYLES = ['filled', 'frosted', 'outline', 'minimal', 'glass'];

/**
 * Applies card settings (style, translucent, equalHeight) to the root element.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 * @param {HTMLElement | { setAttribute: Function, getAttribute?: Function }} [rootElement]
 */
export function applyCardSettings(settings, rootElement) {
  const root = rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root || typeof root.setAttribute !== 'function') return;

  const cards = settings?.cards || {};
  let style = cards.style || 'filled';
  if (style === 'outlined') style = 'outline';
  if (style === 'subtle') style = 'minimal';
  if (!VALID_CARD_STYLES.includes(style)) style = 'filled';

  const translucent = Boolean(cards.translucent);
  const equalHeight = cards.equalHeight !== false;

  root.setAttribute('data-card-style', style);
  root.setAttribute('data-card-translucent', String(translucent));
  root.setAttribute('data-equal-height', String(equalHeight));
}
