// @ts-check

let scrollCleanup = null;

/**
 * Applies the page mode ('two-stage') to the target body element.
 * @param {import('../core/schema.js').DashboardData['settings']} [settings]
 * @param {HTMLElement | { setAttribute: Function }} [bodyElement]
 */
export function applyPageMode(settings, bodyElement) {
  const body = bodyElement || (typeof document !== 'undefined' ? document.body : null);
  if (!body || typeof body.setAttribute !== 'function') return;

  body.setAttribute('data-page', 'two-stage');
}

/**
 * Enforces the landing position requirement (9.3).
 * Always starts at the top of the main panel unless settings.landing is set to 'remember'.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 * @param {Window} [windowObj]
 */
export function applyLanding(settings, windowObj) {
  const win = windowObj || (typeof window !== 'undefined' ? window : null);
  if (!win) return;

  if (typeof win.history !== 'undefined' && 'scrollRestoration' in win.history) {
    win.history.scrollRestoration = 'manual';
  }

  if (settings?.landing !== 'remember' && typeof win.scrollTo === 'function') {
    win.scrollTo(0, 0);
  }
}

/**
 * Smoothly scrolls to the collections hub.
 * @param {ScrollBehavior} [behavior='smooth']
 */
export function scrollToHub(behavior = 'smooth') {
  if (typeof document === 'undefined') return;
  const hub = document.getElementById('collections-hub');
  if (hub && typeof hub.scrollIntoView === 'function') {
    const isReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    hub.scrollIntoView({ behavior: isReduced ? 'auto' : behavior });
  }
}

/**
 * Smoothly scrolls to the hero panel (top).
 * @param {ScrollBehavior} [behavior='smooth']
 */
export function scrollToHero(behavior = 'smooth') {
  if (typeof document === 'undefined') return;
  const hero = document.getElementById('hero-panel');
  if (hero && typeof hero.scrollIntoView === 'function') {
    const isReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    hero.scrollIntoView({ behavior: isReduced ? 'auto' : behavior });
  } else if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior });
  }
}

/**
 * Initializes the Two-Stage page shell interactions:
 * - Scroll prompt click
 * - Back to top click
 * - Scroll prompt auto-hide
 * - Keyboard navigation (PageDown, ArrowDown -> hub, PageUp, Home -> hero)
 * @returns {() => void} Cleanup function
 */
export function initPageShell() {
  if (typeof document === 'undefined') return () => {};

  if (scrollCleanup) scrollCleanup();

  const scrollToHubBtn = document.getElementById('scroll-to-hub');
  const scrollToHeroBtn = document.getElementById('scroll-to-hero');

  const onHubClick = () => scrollToHub('smooth');
  const onHeroClick = () => scrollToHero('smooth');

  if (scrollToHubBtn) {
    scrollToHubBtn.addEventListener('click', onHubClick);
  }

  if (scrollToHeroBtn) {
    scrollToHeroBtn.addEventListener('click', onHeroClick);
  }

  // Auto-hide scroll prompt when scrolled
  const onScroll = () => {
    if (!document.body || document.body.getAttribute('data-page') !== 'two-stage') return;
    if (scrollToHubBtn && typeof window !== 'undefined') {
      const isScrolled = window.scrollY > 40;
      scrollToHubBtn.classList.toggle('is-hidden', isScrolled);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Keyboard navigation
  const onKeyDown = (e) => {
    if (!document.body || document.body.getAttribute('data-page') !== 'two-stage') return;
    const target = /** @type {HTMLElement} */ (e.target);
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (isInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (typeof window === 'undefined') return;

    const isNearHero = window.scrollY < (window.innerHeight * 0.4);
    if (isNearHero && (e.key === 'PageDown' || e.key === 'ArrowDown')) {
      // Hub is hidden/removed in single-stage desktop mode; do not hijack arrow down
    } else if (!isNearHero && (e.key === 'PageUp' || e.key === 'Home')) {
      e.preventDefault();
      scrollToHero('smooth');
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
  }

  const cleanup = () => {
    if (scrollToHubBtn) scrollToHubBtn.removeEventListener('click', onHubClick);
    if (scrollToHeroBtn) scrollToHeroBtn.removeEventListener('click', onHeroClick);
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKeyDown);
    }
  };

  scrollCleanup = cleanup;
  return cleanup;
}
