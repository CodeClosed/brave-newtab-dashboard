// @ts-check
import { store } from '../core/state.js';
import { el } from '../utils/dom.js';

/**
 * @typedef {object} TourStep
 * @property {string} id
 * @property {string} targetSelector
 * @property {string} title
 * @property {string} description
 */

/** @type {TourStep[]} */
export const TOUR_STEPS = [
  {
    id: 'search',
    targetSelector: '#search-input',
    title: 'Unified Search & Jump',
    description: 'Search the web, evaluate math expressions, or type bookmark names to jump directly to your links.'
  },
  {
    id: 'spaces',
    targetSelector: '#space-switcher',
    title: 'Separate Spaces',
    description: 'Organize distinct dashboards for Work, Personal, or Projects. Switch spaces anytime using [ and ].'
  },
  {
    id: 'collections',
    targetSelector: '#categories-grid',
    title: 'Collections & Inline Editing',
    description: 'Group bookmarks into collections. Drag links, rename inline with F2, or press e to enter edit mode.'
  },
  {
    id: 'settings',
    targetSelector: '#settings-trigger-btn',
    title: 'Customization & Help',
    description: 'Personalize themes, wallpapers, and layouts in Settings. Press ? anywhere to view keyboard shortcuts.'
  }
];

let activeTourOverlay = null;
let currentHighlightTarget = null;
let keydownHandler = null;

/**
 * Marks tour completed and persists firstRunDone flag.
 * @returns {Promise<void>}
 */
export async function completeTour() {
  await store.updateSettings({ firstRunDone: true });
}

/**
 * Skips tour and persists firstRunDone flag.
 * @returns {Promise<void>}
 */
export async function skipTour() {
  await store.updateSettings({ firstRunDone: true });
}

/**
 * Tears down any visible tour UI.
 */
function cleanupTourUi() {
  if (typeof document === 'undefined') return;

  if (currentHighlightTarget) {
    currentHighlightTarget.classList.remove('tour-target-highlight');
    currentHighlightTarget = null;
  }

  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  if (activeTourOverlay) {
    activeTourOverlay.remove();
    activeTourOverlay = null;
  }
}

/**
 * Starts the interactive walkthrough tour.
 * @returns {Promise<void>}
 */
export async function startTour() {
  if (typeof document === 'undefined') {
    await completeTour();
    return;
  }

  cleanupTourUi();

  let stepIndex = 0;

  // Create overlay container
  const overlay = el('div', {
    id: 'tour-overlay',
    className: 'tour-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Feature Tour'
  });

  const popover = el('div', { className: 'tour-popover' });
  overlay.appendChild(popover);
  document.body.appendChild(overlay);
  activeTourOverlay = overlay;

  function renderStep(idx) {
    if (idx < 0 || idx >= TOUR_STEPS.length) {
      endTour(true);
      return;
    }

    stepIndex = idx;
    const step = TOUR_STEPS[idx];

    // Remove previous target highlight
    if (currentHighlightTarget) {
      currentHighlightTarget.classList.remove('tour-target-highlight');
      currentHighlightTarget = null;
    }

    // Try finding target element
    const targetEl = document.querySelector(step.targetSelector);
    if (targetEl) {
      currentHighlightTarget = targetEl;
      targetEl.classList.add('tour-target-highlight');
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        // Fallback for older browsers
      }
    }

    popover.innerHTML = '';

    // Step badge & Title
    const header = el('header', { className: 'tour-header' },
      el('span', { className: 'tour-step-badge', text: `Step ${idx + 1} of ${TOUR_STEPS.length}` }),
      el('h3', { className: 'tour-title', text: step.title })
    );

    const body = el('div', { className: 'tour-body' },
      el('p', { className: 'tour-description', text: step.description })
    );

    const isLast = idx === TOUR_STEPS.length - 1;
    const isFirst = idx === 0;

    const skipBtn = el('button', {
      type: 'button',
      className: 'btn-secondary tour-btn-skip',
      text: 'Skip tour',
      onclick: () => endTour(false)
    });

    const backBtn = el('button', {
      type: 'button',
      className: 'btn-secondary tour-btn-back',
      text: 'Back',
      style: { display: isFirst ? 'none' : 'inline-flex' },
      onclick: () => renderStep(stepIndex - 1)
    });

    const nextBtn = el('button', {
      type: 'button',
      className: 'btn-submit tour-btn-next',
      text: isLast ? 'Finish' : 'Next',
      onclick: () => {
        if (isLast) {
          endTour(true);
        } else {
          renderStep(stepIndex + 1);
        }
      }
    });

    const footerRight = el('div', { className: 'tour-footer-right' }, backBtn, nextBtn);
    const footer = el('footer', { className: 'tour-footer' }, skipBtn, footerRight);

    popover.appendChild(header);
    popover.appendChild(body);
    popover.appendChild(footer);

    // Focus primary action
    nextBtn.focus();
  }

  async function endTour(completed) {
    cleanupTourUi();
    if (completed) {
      await completeTour();
    } else {
      await skipTour();
    }
  }

  // Handle keyboard navigation during tour
  keydownHandler = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      endTour(false);
    } else if (e.key === 'ArrowRight' && document.activeElement?.tagName !== 'INPUT') {
      if (stepIndex < TOUR_STEPS.length - 1) {
        renderStep(stepIndex + 1);
      }
    } else if (e.key === 'ArrowLeft' && document.activeElement?.tagName !== 'INPUT') {
      if (stepIndex > 0) {
        renderStep(stepIndex - 1);
      }
    }
  };
  window.addEventListener('keydown', keydownHandler);

  renderStep(0);
}
