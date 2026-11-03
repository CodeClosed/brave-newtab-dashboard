// @ts-check
import { el } from '../utils/dom.js';
import { createFaviconElement } from '../ui/favicons.js';
import { openBookmarkDialog } from '../ui/dialogs.js';
import { store } from '../core/state.js';
import { showToast } from '../ui/toasts.js';
import { ICON_SPEED_DIAL, ICON_PLUS } from '../ui/icons.js';

/**
 * Renders or updates the Quick Speed Dial widget.
 * Displays the top pinned bookmarks or most visited items in a clean frosted pill bar.
 *
 * @param {HTMLElement | null} container
 * @param {import('../core/schema.js').DashboardData} state
 */
export function renderSpeedDialWidget(container, state) {
  if (!container) return;

  const isEnabled = Boolean(state?.settings?.widgets?.speeddial);
  const heroConf = state?.settings?.hero?.widgets?.speeddial;
  const isHiddenByHero = Boolean(heroConf?.hidden);

  if (!isEnabled || isHiddenByHero) {
    container.hidden = true;
    container.style.display = 'none';
    return;
  }

  container.hidden = false;
  if (!container.dataset.freeDrag) {
    container.style.display = '';
  }

  const activeSpace = state?.spaces?.find(s => s.id === state.activeSpaceId) || state?.spaces?.[0];
  const pinnedIds = Array.isArray(activeSpace?.pinned) ? activeSpace.pinned : [];

  // Find all bookmarks across all categories
  const allBookmarks = [];
  (state.categories || []).forEach(cat => {
    (cat.bookmarks || []).forEach(bm => {
      allBookmarks.push({ ...bm, categoryId: cat.id });
    });
  });

  // Pick pinned bookmarks first, fallback to first 6 bookmarks
  let items = [];
  if (pinnedIds.length > 0) {
    items = pinnedIds
      .map(id => allBookmarks.find(bm => bm.id === id))
      .filter(Boolean)
      .slice(0, 8);
  }
  if (items.length === 0) {
    items = allBookmarks.slice(0, 6);
  }

  const card = el('div', { className: 'widget-card widget-speeddial' });

  // Header
  const titleGroup = el('div', { className: 'widget-title-group' }, [
    el('span', { className: 'widget-title', html: `${ICON_SPEED_DIAL}<span>Speed Dial</span>` }),
    el('span', { className: 'widget-count-badge', text: `${items.length} quick apps` })
  ]);

  const addBtn = el('button', {
    className: 'btn-quiet btn-sm',
    type: 'button',
    text: 'Add',
    html: `${ICON_PLUS}<span>Add</span>`,
    onclick: () => {
      const firstCat = state?.categories?.[0];
      if (!firstCat) return;
      openBookmarkDialog({
        mode: 'add',
        categoryId: firstCat.id,
        onSave: (bmData) => {
          const added = store.addBookmark(firstCat.id, bmData);
          if (activeSpace && added) {
            const nextPinned = [...(activeSpace.pinned || []), added.id];
            store.updateSpace(activeSpace.id, { pinned: nextPinned });
          }
          showToast(`Added "${bmData.name}" to Speed Dial`);
        }
      });
    }
  });

  const header = el('div', { className: 'widget-header' }, [titleGroup, addBtn]);

  // Items grid / row
  const list = el('div', { className: 'speeddial-items-grid' });
  const openIn = state?.settings?.behavior?.openIn || 'same';

  items.forEach(bm => {
    const favicon = createFaviconElement(bm.url, bm.name);
    const itemEl = el('a', {
      className: 'speeddial-item',
      href: bm.url,
      target: openIn === 'new' ? '_blank' : '_self',
      rel: openIn === 'new' ? 'noopener noreferrer' : undefined,
      title: `${bm.name}\n${bm.url}`,
      'aria-label': bm.name
    }, [
      el('span', { className: 'speeddial-icon-wrap' }, favicon),
      el('span', { className: 'speeddial-name', text: bm.name })
    ]);
    list.appendChild(itemEl);
  });

  card.appendChild(header);
  card.appendChild(items.length > 0 ? list : el('div', { className: 'speeddial-empty', text: 'No speed dial apps yet. Pin bookmarks to display them here!' }));

  const existingFrame = container.querySelector ? container.querySelector('.widget-drag-frame') : null;
  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(card);
  } else {
    container.textContent = '';
    container.appendChild(card);
  }
  if (existingFrame) {
    container.appendChild(existingFrame);
  }
}
