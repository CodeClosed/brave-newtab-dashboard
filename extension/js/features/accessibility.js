// @ts-check

/**
 * Applies accessibility attributes (motion and large targets) to the root element.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 * @param {HTMLElement | { setAttribute: Function, removeAttribute?: Function }} [rootElement]
 */
export function applyAccessibilitySettings(settings, rootElement) {
  const root = rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root) return;

  const motion = settings?.motion === 'reduce' ? 'reduce' : 'system';
  const isLargeTargets = Boolean(settings?.largeTargets === true);

  root.setAttribute('data-motion', motion);
  root.setAttribute('data-large-targets', isLargeTargets ? 'true' : 'false');
}
