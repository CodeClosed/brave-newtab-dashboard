// @ts-check
import { store } from '../core/state.js';
import { generateId } from '../core/schema.js';
import { el, clearChildren } from '../utils/dom.js';

/**
 * Starter template definitions with generic bookmarks adhering to roadmap C2 rules.
 */
export const STARTER_TEMPLATES = {
  student: {
    name: 'Student',
    icon: '🎓',
    description: 'Study, research, course tools, and cloud storage',
    categories: [
      {
        name: 'Study & Research',
        icon: '📚',
        bookmarks: [
          { name: 'Wikipedia', url: 'https://en.wikipedia.org' },
          { name: 'Google Scholar', url: 'https://scholar.google.com' },
          { name: 'Khan Academy', url: 'https://www.khanacademy.org' },
          { name: 'Internet Archive', url: 'https://archive.org' }
        ]
      },
      {
        name: 'Tools & Writing',
        icon: '📝',
        bookmarks: [
          { name: 'Google Docs', url: 'https://docs.google.com' },
          { name: 'Notion', url: 'https://www.notion.so' },
          { name: 'Overleaf', url: 'https://www.overleaf.com' },
          { name: 'Dictionary', url: 'https://www.merriam-webster.com' }
        ]
      },
      {
        name: 'Campus & Planning',
        icon: '🎓',
        bookmarks: [
          { name: 'Calendar', url: 'https://calendar.google.com' },
          { name: 'Canvas LMS', url: 'https://canvas.instructure.com' },
          { name: 'Google Drive', url: 'https://drive.google.com' }
        ]
      }
    ]
  },
  developer: {
    name: 'Developer',
    icon: '💻',
    description: 'Repositories, documentation, and cloud tooling',
    categories: [
      {
        name: 'Code & Repos',
        icon: '🐙',
        bookmarks: [
          { name: 'GitHub', url: 'https://github.com' },
          { name: 'GitLab', url: 'https://gitlab.com' },
          { name: 'Stack Overflow', url: 'https://stackoverflow.com' }
        ]
      },
      {
        name: 'Docs & Learning',
        icon: '📖',
        bookmarks: [
          { name: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
          { name: 'DevDocs', url: 'https://devdocs.io' },
          { name: 'Hacker News', url: 'https://news.ycombinator.com' }
        ]
      },
      {
        name: 'Cloud & Ops',
        icon: '☁️',
        bookmarks: [
          { name: 'GitHub Actions', url: 'https://github.com/features/actions' },
          { name: 'Docker Hub', url: 'https://hub.docker.com' },
          { name: 'Cloud Console', url: 'https://console.cloud.google.com' }
        ]
      }
    ]
  },
  creator: {
    name: 'Creator',
    icon: '🎨',
    description: 'Visual design, publishing, and creative inspiration',
    categories: [
      {
        name: 'Design & Visuals',
        icon: '🎨',
        bookmarks: [
          { name: 'Figma', url: 'https://www.figma.com' },
          { name: 'Unsplash', url: 'https://unsplash.com' },
          { name: 'Fontshare', url: 'https://www.fontshare.com' }
        ]
      },
      {
        name: 'Content & Publishing',
        icon: '✍️',
        bookmarks: [
          { name: 'YouTube Studio', url: 'https://studio.youtube.com' },
          { name: 'Substack', url: 'https://substack.com' },
          { name: 'Medium', url: 'https://medium.com' }
        ]
      },
      {
        name: 'Inspiration',
        icon: '💡',
        bookmarks: [
          { name: 'Dribbble', url: 'https://dribbble.com' },
          { name: 'Behance', url: 'https://www.behance.com' },
          { name: 'Pinterest', url: 'https://www.pinterest.com' }
        ]
      }
    ]
  },
  empty: {
    name: 'Start empty',
    icon: '📄',
    description: 'A clean canvas with no starter bookmarks',
    categories: []
  }
};

/**
 * Generates an array of category objects for the given starter template key.
 * @param {string} templateKey
 * @param {string} [spaceId]
 * @returns {import('../core/schema.js').Category[]}
 */
export function getStarterTemplate(templateKey, spaceId) {
  const tpl = STARTER_TEMPLATES[templateKey];
  if (!tpl || !Array.isArray(tpl.categories)) {
    return [];
  }

  const targetSpaceId = spaceId || store.get()?.activeSpaceId || 'space-home';

  return tpl.categories.map((cat, catIdx) => ({
    id: generateId(),
    spaceId: targetSpaceId,
    name: cat.name.slice(0, 80),
    icon: cat.icon.slice(0, 8),
    order: catIdx,
    collapsed: false,
    displayMode: null,
    accent: null,
    bookmarks: (cat.bookmarks || []).map((bm, bmIdx) => ({
      id: generateId(),
      name: bm.name.slice(0, 80),
      url: bm.url,
      order: bmIdx,
      icon: null
    }))
  }));
}

/**
 * Checks whether first-run experience should be presented.
 * Upgrading existing installs never triggers first-run.
 *
 * @param {import('../core/schema.js').DashboardData} state
 * @returns {boolean}
 */
export function shouldShowFirstRun(state) {
  if (!state || typeof state !== 'object') return false;
  if (!state.settings) return false;
  return state.settings.firstRunDone === false;
}

/**
 * Applies a starter template to the dashboard and marks firstRunDone: true.
 *
 * @param {string} templateKey
 * @param {any} [targetStore]
 * @returns {Promise<void>}
 */
export async function applyStarterTemplate(templateKey, targetStore = store) {
  const currentState = targetStore.get();
  const activeSpaceId = currentState?.activeSpaceId || currentState?.spaces?.[0]?.id || 'space-home';
  const newCats = getStarterTemplate(templateKey, activeSpaceId);

  // If there are other spaces, keep categories belonging to other spaces
  const otherSpaceCats = (currentState?.categories || []).filter(c => c.spaceId && c.spaceId !== activeSpaceId);
  const updatedCategories = [...otherSpaceCats, ...newCats];

  const nextState = {
    ...currentState,
    settings: {
      ...currentState.settings,
      firstRunDone: true
    },
    categories: updatedCategories
  };

  await targetStore.replaceData(nextState);
}

/**
 * Opens first-run template picker dialog on fresh installs.
 * @returns {Promise<void>}
 */
export async function openFirstRunDialog() {
  if (typeof document === 'undefined') return;

  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('first-run-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', { id: 'first-run-dialog', className: 'first-run-dialog' }));
    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  // Header
  const header = el('header', { className: 'modal-header' },
    el('div', {},
      el('h2', { className: 'modal-title', text: 'Welcome to your dashboard' }),
      el('p', {
        className: 'modal-subtitle',
        text: 'Choose a starter template or begin with a blank canvas.',
        style: { fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }
      })
    )
  );

  // Body: Template Cards Grid
  const grid = el('div', { className: 'template-card-grid' });

  for (const [key, tpl] of Object.entries(STARTER_TEMPLATES)) {
    const card = el('button', {
      type: 'button',
      className: 'template-card',
      'aria-label': `${tpl.name} template`,
      onclick: async () => {
        dialog.close();
        await applyStarterTemplate(key);
        // Dynamic import tour
        try {
          const { startTour } = await import('./tour.js');
          await startTour();
        } catch (e) {
          console.warn('Failed to start tour:', e);
        }
      }
    },
      el('span', { className: 'template-card-icon', text: tpl.icon }),
      el('span', { className: 'template-card-name', text: tpl.name }),
      el('span', { className: 'template-card-desc', text: tpl.description })
    );

    grid.appendChild(card);
  }

  const body = el('div', { className: 'modal-body' }, grid);

  // Footer: Skip option
  const skipBtn = el('button', {
    type: 'button',
    className: 'btn-secondary',
    text: 'Skip setup & tour',
    onclick: async () => {
      dialog.close();
      await store.updateSettings({ firstRunDone: true });
    }
  });

  const tourBtn = el('button', {
    type: 'button',
    className: 'btn-submit',
    text: 'Take a quick tour',
    onclick: async () => {
      dialog.close();
      await store.updateSettings({ firstRunDone: true });
      try {
        const { startTour } = await import('./tour.js');
        await startTour();
      } catch (e) {
        console.warn('Failed to start tour:', e);
      }
    }
  });

  const footer = el('footer', { className: 'modal-footer' }, skipBtn, tourBtn);
  const content = el('div', { className: 'modal-content' }, header, body, footer);

  dialog.appendChild(content);
  dialog.showModal();
}
