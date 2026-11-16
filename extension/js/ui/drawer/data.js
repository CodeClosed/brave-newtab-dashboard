// @ts-check
import { store } from '../../core/state.js';
import { el, clearChildren } from '../../utils/dom.js';
import { showToast } from '../toasts.js';
import { openConfirmDialog, openImportPreviewDialog } from '../dialogs.js';
import {
  exportDashboardToFile,
  parseAndValidateBookmarksImport,
  mergeDashboardData
} from '../../features/data-io.js';
import { listSnapshots, restoreSnapshot, deleteSnapshot, createSnapshot, MAX_SNAPSHOTS } from '../../core/snapshots.js';
import { createDefaultDashboardData } from '../../core/schema.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const ICON_DOWNLOAD = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
const ICON_UPLOAD = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`;

/**
 * Computes current collection and bookmark counts from dashboard data.
 * @param {import('../../core/schema.js').DashboardData | null | undefined} data
 * @returns {{ categories: number, bookmarks: number }}
 */
function getDashboardCounts(data) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  let bookmarks = 0;
  for (const cat of categories) {
    if (Array.isArray(cat?.bookmarks)) {
      bookmarks += cat.bookmarks.length;
    }
  }
  return { categories: categories.length, bookmarks };
}

/**
 * Infers a display format label from filename or content.
 * @param {string} filename
 * @param {string} content
 * @returns {string}
 */
function detectImportFormatLabel(filename, content) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.json')) return 'JSON';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'HTML';
  if (lower.endsWith('.csv')) return 'CSV';
  const trimmed = (content || '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'JSON';
  if (trimmed.includes('<!DOCTYPE') || trimmed.includes('<H3') || trimmed.includes('<DL') || trimmed.includes('<A HREF')) {
    return 'HTML';
  }
  return 'CSV';
}

/**
 * Renders the Backup & Data management section (4-card layout).
 * @param {() => void} [onCloseDrawer] Callback to close the parent drawer
 */
export function renderDataSection(onCloseDrawer) {
  const section = el('div', { className: 'settings-section' });

  const secHeader = el('div', { className: 'settings-section-header' }, [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: 'Backup, Export & Snapshots' }),
      el('p', { className: 'settings-section-subtitle', text: 'Manage automated point-in-time snapshots and export/import full JSON backups' })
    ])
  ]);
  section.appendChild(secHeader);

  // --- Card 1: Export Backup ---
  const initialCounts = getDashboardCounts(store.get());
  const exportSummaryPill = el('span', {
    className: 'backup-summary-pill',
    text: `${initialCounts.categories} collections · ${initialCounts.bookmarks} bookmarks`
  });

  const exportBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    onclick: () => {
      const counts = getDashboardCounts(store.get());
      exportDashboardToFile();
      showToast(counts.categories === 0 ? 'Empty backup exported' : 'Dashboard backup exported');
    }
  }, [
    el('span', { html: ICON_DOWNLOAD }),
    el('span', { text: 'Export JSON' })
  ]);

  const exportCard = el('div', { className: 'setting-item backup-card' }, [
    el('div', { className: 'backup-card-header' }, [
      el('span', { className: 'setting-label', text: 'Export Backup' }),
      exportSummaryPill
    ]),
    el('span', {
      className: 'setting-hint',
      text: 'Download a portable JSON backup of your spaces, collections, and settings. Custom wallpaper images stay on this device.'
    }),
    el('div', { className: 'backup-card-actions' }, [exportBtn])
  ]);
  section.appendChild(exportCard);

  // --- Card 2: Import & Restore ---
  const fileInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'file',
    accept: '.json,.html,.htm,.csv,application/json,text/html,text/csv',
    style: { display: 'none' }
  }));

  const errorTextEl = el('span', { className: 'backup-inline-error-text' });
  const errorBanner = el('div', {
    className: 'backup-inline-error',
    role: 'alert',
    hidden: 'hidden'
  }, [
    errorTextEl,
    el('button', {
      className: 'backup-inline-error-dismiss',
      type: 'button',
      'aria-label': 'Dismiss error',
      html: ICON_CLOSE,
      onclick: () => clearImportError()
    })
  ]);

  /**
   * Shows an inline validation/read error safely via textContent.
   * @param {string} message
   */
  function showImportError(message) {
    errorTextEl.textContent = message;
    errorBanner.hidden = false;
  }

  function clearImportError() {
    errorTextEl.textContent = '';
    errorBanner.hidden = true;
  }

  const dropzone = /** @type {HTMLButtonElement} */ (el('button', {
    className: 'backup-dropzone',
    type: 'button',
    'aria-describedby': 'backup-format-hint',
    onclick: () => fileInput.click()
  }, [
    el('span', { className: 'backup-dropzone-icon', html: ICON_UPLOAD }),
    el('span', { className: 'backup-dropzone-title', text: 'Drop a backup file here, or browse' }),
    el('span', { className: 'backup-dropzone-sub', text: 'Supports dashboard JSON, Netscape HTML, and CSV exports' })
  ]));

  /**
   * Validates and previews an imported File object.
   * @param {File | undefined | null} file
   */
  async function handleImportFile(file) {
    if (!file) return;
    clearImportError();

    if (file.size > MAX_IMPORT_BYTES) {
      showImportError(`"${file.name}" exceeds the 5 MB import limit.`);
      return;
    }

    dropzone.classList.add('is-parsing');
    dropzone.disabled = true;

    try {
      const text = await file.text();
      const result = parseAndValidateBookmarksImport(text, 'auto');

      if (!result.success || !result.data || !result.summary) {
        showImportError(result.error || 'Invalid backup file format.');
        return;
      }

      const format = detectImportFormatLabel(file.name, text);

      openImportPreviewDialog({
        summary: result.summary,
        fileMeta: {
          name: file.name,
          size: file.size,
          format
        },
        onConfirm: async (mode) => {
          await createSnapshot('Before import', store.get());
          const preImportSnapshot = JSON.parse(JSON.stringify(store.get()));
          const nextData = mode === 'merge'
            ? mergeDashboardData(store.get(), result.data)
            : result.data;
          await store.replaceData(nextData, true);
          if (onCloseDrawer) onCloseDrawer();

          const verb = mode === 'merge' ? 'Merged' : 'Restored';
          showToast(`${verb} ${result.summary.categoryCount} collections and ${result.summary.bookmarkCount} bookmarks`, () => {
            store.replaceData(preImportSnapshot, true);
            showToast('Import undone');
          });
        }
      });
    } catch (err) {
      showImportError('Unable to read the selected file.');
    } finally {
      dropzone.classList.remove('is-parsing');
      dropzone.disabled = false;
      fileInput.value = '';
    }
  }

  fileInput.addEventListener('change', () => {
    handleImportFile(fileInput.files?.[0]);
  });

  let dragDepth = 0;
  dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  dropzone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dropzone.classList.remove('is-dragover');
    }
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove('is-dragover');
    handleImportFile(e.dataTransfer?.files?.[0]);
  });

  const browserImportBtn = /** @type {HTMLButtonElement} */ (el('button', {
    className: 'btn-secondary btn-sm',
    type: 'button',
    text: 'Import Browser Bookmarks',
    title: 'Imports bookmarks from your browser into collections',
    onclick: async () => {
      clearImportError();
      browserImportBtn.disabled = true;
      try {
        const { importFromBrowserBookmarks } = await import('../../features/data-io.js');
        showToast('Requesting permission to access bookmarks...');
        const res = await importFromBrowserBookmarks();
        if (res.success) {
          showToast(`Imported ${res.count} bookmarks into collections!`);
          if (onCloseDrawer) onCloseDrawer();
        } else {
          showImportError(res.error || 'Could not import browser bookmarks.');
        }
      } finally {
        browserImportBtn.disabled = false;
      }
    }
  }));

  const importCard = el('div', { className: 'setting-item backup-card' }, [
    el('div', { className: 'backup-card-header' }, [
      el('span', { className: 'setting-label', text: 'Import & Restore' }),
      el('span', {
        id: 'backup-format-hint',
        className: 'backup-format-hint',
        text: 'JSON · HTML · CSV · Max 5 MB'
      })
    ]),
    fileInput,
    dropzone,
    errorBanner,
    el('div', { className: 'backup-secondary-row' }, [
      el('div', { className: 'backup-secondary-info' }, [
        el('span', { className: 'setting-label', text: 'Browser Bookmarks' }),
        el('span', {
          className: 'setting-hint',
          text: 'Merges browser folders into collections; requests bookmarks permission on click.'
        })
      ]),
      browserImportBtn
    ])
  ]);
  section.appendChild(importCard);

  // --- Card 3: Snapshots ---
  const capacityBadge = el('span', {
    className: 'snapshot-capacity-badge',
    text: `0 / ${MAX_SNAPSHOTS}`
  });

  const createSnapBtn = /** @type {HTMLButtonElement} */ (el('button', {
    className: 'btn-secondary btn-sm',
    type: 'button',
    text: 'Create Snapshot',
    onclick: async () => {
      createSnapBtn.disabled = true;
      createSnapBtn.textContent = 'Saving…';
      try {
        await createSnapshot('Manual snapshot');
        showToast('Snapshot created');
        await refreshSnapshots();
      } catch {
        showToast('Failed to create snapshot');
      } finally {
        createSnapBtn.disabled = false;
        createSnapBtn.textContent = 'Create Snapshot';
      }
    }
  }));

  const snapshotListContainer = el('div', {
    className: 'snapshots-list',
    'aria-live': 'polite'
  });

  async function refreshSnapshots() {
    clearChildren(snapshotListContainer);
    const snaps = await listSnapshots();
    const count = snaps ? snaps.length : 0;
    capacityBadge.textContent = `${count} / ${MAX_SNAPSHOTS}`;

    if (!snaps || snaps.length === 0) {
      snapshotListContainer.appendChild(el('div', {
        className: 'snapshot-empty-hint',
        text: 'No snapshots yet. Automatic backups appear here before imports, resets, or every 24 hours.'
      }));
      return;
    }

    snaps.forEach(snap => {
      const dateFormatted = new Date(snap.createdAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const snapItem = el('div', { className: 'snapshot-item' }, [
        el('div', { className: 'snapshot-info' }, [
          el('div', { className: 'snapshot-meta' }, [
            el('span', { className: 'snapshot-reason', text: snap.reason || 'Snapshot' }),
            el('span', { className: 'snapshot-date', text: dateFormatted })
          ]),
          el('div', {
            className: 'snapshot-counts',
            text: `${snap.counts?.categories ?? 0} collections · ${snap.counts?.bookmarks ?? 0} bookmarks`
          })
        ]),
        el('div', { className: 'snapshot-actions' }, [
          el('button', {
            className: 'btn-secondary btn-sm',
            type: 'button',
            text: 'Restore',
            title: 'Restore this snapshot',
            onclick: () => {
              openConfirmDialog({
                title: 'Restore Snapshot?',
                message: `Restore snapshot from ${dateFormatted} (${snap.reason || 'Snapshot'})? It contains ${snap.counts?.categories ?? 0} collections and ${snap.counts?.bookmarks ?? 0} bookmarks. Current data will be backed up before restore.`,
                confirmText: 'Restore',
                onConfirm: async () => {
                  const preRestore = JSON.parse(JSON.stringify(store.get()));
                  const res = await restoreSnapshot(snap.id);
                  if (!res || !res.success) {
                    showToast(res?.error || 'Failed to restore snapshot');
                    return;
                  }
                  if (onCloseDrawer) onCloseDrawer();
                  showToast(`Restored snapshot from ${dateFormatted}`, () => {
                    store.replaceData(preRestore, true);
                    showToast('Restore undone');
                  });
                }
              });
            }
          }),
          el('button', {
            className: 'icon-action-btn delete',
            type: 'button',
            html: ICON_CLOSE,
            'aria-label': `Delete snapshot from ${dateFormatted}`,
            title: 'Delete snapshot',
            onclick: async () => {
              const deletedSnap = snap;
              await deleteSnapshot(snap.id);
              await refreshSnapshots();
              showToast('Snapshot deleted', async () => {
                if (deletedSnap?.data) {
                  await createSnapshot(deletedSnap.reason || 'Restored snapshot', deletedSnap.data);
                  await refreshSnapshots();
                  showToast('Snapshot restored');
                }
              });
            }
          })
        ])
      ]);

      snapshotListContainer.appendChild(snapItem);
    });
  }

  refreshSnapshots().catch(() => {});

  const snapshotsSection = el('div', { className: 'setting-item snapshots-section' }, [
    el('div', { className: 'snapshots-header' }, [
      el('div', { className: 'snapshots-title-group' }, [
        el('span', { className: 'setting-label', text: 'Snapshots' }),
        capacityBadge
      ]),
      createSnapBtn
    ]),
    el('span', {
      className: 'setting-hint',
      text: 'Auto-saved every 24h and before destructive actions.'
    }),
    snapshotListContainer
  ]);
  section.appendChild(snapshotsSection);

  // --- Card 4: Danger Zone ---
  const resetBtn = el('button', {
    className: 'btn-secondary btn-danger',
    type: 'button',
    text: 'Reset to Defaults',
    onclick: () => {
      openConfirmDialog({
        title: 'Reset Dashboard?',
        message: 'This will reset all your collections, bookmarks, and settings back to default. Are you sure?',
        confirmText: 'Reset All',
        onConfirm: async () => {
          await createSnapshot('Before reset', store.get());
          const preResetSnapshot = JSON.parse(JSON.stringify(store.get()));
          await store.replaceData(createDefaultDashboardData(), true);
          if (onCloseDrawer) onCloseDrawer();
          showToast('Dashboard reset to defaults', () => {
            store.replaceData(preResetSnapshot, true);
            showToast('Reset undone');
          });
        }
      });
    }
  });

  const dangerZone = el('div', { className: 'danger-zone-section' }, [
    el('span', { className: 'setting-label text-danger', text: 'Danger Zone' }),
    el('span', {
      className: 'setting-hint',
      text: 'Resets all collections, bookmarks, and settings. A "Before reset" snapshot is saved first.'
    }),
    resetBtn
  ]);
  section.appendChild(dangerZone);

  return section;
}
