// @ts-check
import { store } from '../../core/state.js';
import { el, clearChildren } from '../../utils/dom.js';
import { showToast } from '../toasts.js';
import { openConfirmDialog, openImportPreviewDialog } from '../dialogs.js';
import { exportDashboardToFile, parseAndValidateBookmarksImport } from '../../features/data-io.js';
import { listSnapshots, restoreSnapshot, deleteSnapshot, createSnapshot } from '../../core/snapshots.js';
import { createDefaultDashboardData } from '../../core/schema.js';

const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

/**
 * Renders the Data & Snapshots management section.
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

  // Export JSON
  const exportBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Export Backup (JSON)',
    onclick: () => {
      exportDashboardToFile();
      showToast('Dashboard backup exported');
    }
  });

  // Import JSON, HTML, CSV with preview and undo
  const fileInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'file',
    accept: '.json,.html,.htm,.csv,application/json,text/html,text/csv',
    style: { display: 'none' }
  }));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseAndValidateBookmarksImport(text, 'auto');

      if (!result.success || !result.data || !result.summary) {
        showToast(`Import failed: ${result.error || 'Invalid file format'}`);
        return;
      }

      // Open pre-import preview modal
      openImportPreviewDialog({
        summary: result.summary,
        onConfirm: async () => {
          await createSnapshot('Before import', store.get());
          const preImportSnapshot = JSON.parse(JSON.stringify(store.get()));
          await store.replaceData(result.data, true);
          if (onCloseDrawer) onCloseDrawer();

          showToast(`Restored ${result.summary.categoryCount} collections and ${result.summary.bookmarkCount} bookmarks`, () => {
            store.replaceData(preImportSnapshot, true);
            showToast('Restore undone');
          });
        }
      });
    } catch (err) {
      showToast('Unable to read import file');
    } finally {
      fileInput.value = '';
    }
  });

  const importBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Import File (JSON, HTML, CSV)',
    onclick: () => fileInput.click()
  });

  // Reset to Defaults with undo
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

  // Import from browser bookmarks (on-demand permission)
  const browserImportBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Import Browser Bookmarks',
    title: 'Imports bookmarks from your browser into collections',
    onclick: async () => {
      const { importFromBrowserBookmarks } = await import('../../features/data-io.js');
      showToast('Requesting permission to access bookmarks...');
      const res = await importFromBrowserBookmarks();
      if (res.success) {
        showToast(`Imported ${res.count} bookmarks into collections!`);
        if (onCloseDrawer) onCloseDrawer();
      } else {
        showToast(res.error || 'Could not import browser bookmarks');
      }
    }
  });

  section.appendChild(el('span', { className: 'setting-label', text: 'Backup & Restore' }));
  section.appendChild(exportBtn);
  section.appendChild(fileInput);
  section.appendChild(importBtn);
  section.appendChild(browserImportBtn);

  // --- Snapshots Section ---
  const snapshotsSection = el('div', { className: 'snapshots-section' });
  const snapshotsHeader = el('div', { className: 'setting-item' }, [
    el('span', { className: 'setting-label', text: 'Snapshots' }),
    el('span', { className: 'setting-hint', text: 'Automatic safety backups saved in browser database (up to 10 latest).' })
  ]);

  const snapshotListContainer = el('div', { className: 'snapshots-list' });

  async function refreshSnapshots() {
    clearChildren(snapshotListContainer);
    const snaps = await listSnapshots();
    if (!snaps || snaps.length === 0) {
      snapshotListContainer.appendChild(el('div', {
        className: 'snapshot-empty-hint',
        text: 'No snapshots saved yet.'
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
                message: `Restore snapshot from ${dateFormatted} (${snap.reason})? It contains ${snap.counts?.categories ?? 0} collections and ${snap.counts?.bookmarks ?? 0} bookmarks. Current data will be backed up before restore.`,
                confirmText: 'Restore',
                onConfirm: async () => {
                  const preRestore = JSON.parse(JSON.stringify(store.get()));
                  await restoreSnapshot(snap.id);
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
            className: 'btn-icon btn-sm btn-danger',
            type: 'button',
            html: ICON_CLOSE,
            title: 'Delete snapshot',
            onclick: async () => {
              await deleteSnapshot(snap.id);
              showToast('Snapshot deleted');
              await refreshSnapshots();
            }
          })
        ])
      ]);

      snapshotListContainer.appendChild(snapItem);
    });
  }

  const createSnapBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Create Snapshot',
    onclick: async () => {
      await createSnapshot('Manual snapshot');
      showToast('Snapshot created');
      await refreshSnapshots();
    }
  });

  refreshSnapshots().catch(() => {});

  snapshotsSection.appendChild(snapshotsHeader);
  snapshotsSection.appendChild(createSnapBtn);
  snapshotsSection.appendChild(snapshotListContainer);

  section.appendChild(snapshotsSection);

  // Reset to Defaults danger area
  const dangerZone = el('div', { className: 'danger-zone-section' }, [
    el('span', { className: 'setting-label text-danger', text: 'Danger Zone' }),
    el('span', { className: 'setting-hint', text: 'Resetting erases all collections and settings. An automatic recovery snapshot will be saved first.' }),
    resetBtn
  ]);
  section.appendChild(dangerZone);

  return section;
}
