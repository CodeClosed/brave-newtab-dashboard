// @ts-check
import { loadDashboardData, queueSaveDashboardData, saveDashboardDataImmediately, onExternalStorageChange } from './storage.js';
import { createDefaultDashboardData, generateId } from './schema.js';
import { normalizeUrl } from '../utils/url.js';
import { createSnapshot, checkAndTriggerDailySnapshot, registerSnapshotStore } from './snapshots.js';

class StateStore {
  constructor() {
    /** @type {import('./schema.js').DashboardData} */
    this._data = createDefaultDashboardData();
    /** @type {Set<(state: import('./schema.js').DashboardData) => void>} */
    this._subscribers = new Set();
    this._initialized = false;
  }

  /**
   * Initializes state by reading stored data.
   */
  async init() {
    if (this._initialized) return this._data;
    this._data = await loadDashboardData();
    this._initialized = true;

    // Listen to changes from other tabs
    onExternalStorageChange((externalData) => {
      this._data = externalData;
      this._notify();
    });

    return this._data;
  }

  /**
   * Gets current state snapshot.
   * @returns {import('./schema.js').DashboardData}
   */
  get() {
    return this._data;
  }

  /**
   * Gets current state snapshot (alias for get).
   * @returns {import('./schema.js').DashboardData}
   */
  getState() {
    return this._data;
  }

  /**
   * Takes a deep copy snapshot of current state for undo operations.
   * @private
   * @returns {import('./schema.js').DashboardData}
   */
  _createSnapshot() {
    return JSON.parse(JSON.stringify(this._data));
  }

  /**
   * Subscribes a listener function to state changes.
   * @param {(state: import('./schema.js').DashboardData) => void} fn
   * @returns {() => void} Unsubscribe function
   */
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  /**
   * Notifies all registered subscribers.
   * @private
   */
  _notify() {
    for (const listener of this._subscribers) {
      try {
        listener(this._data);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    }
  }

  /**
   * Updates settings slice and triggers persistence.
   * @param {Partial<import('./schema.js').DashboardData['settings']>} patch
   */
  updateSettings(patch) {
    this._data.settings = Object.assign({}, this._data.settings, patch);
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Sets entire category list and persists.
   * @param {import('./schema.js').Category[]} categories
   */
  setCategories(categories) {
    this._data.categories = categories;
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Toggles category collapse state.
   * @param {string} categoryId
   */
  toggleCategoryCollapse(categoryId) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (cat) {
      cat.collapsed = !cat.collapsed;
      queueSaveDashboardData(this._data);
      this._notify();
    }
  }

  /**
   * Collapses or expands all categories.
   * @param {boolean} collapsed
   */
  setAllCategoriesCollapsed(collapsed) {
    if (!Array.isArray(this._data.categories)) return;
    this._data.categories.forEach(c => {
      c.collapsed = Boolean(collapsed);
    });
    queueSaveDashboardData(this._data);
    this._notify();
  }

  // --- Category CRUD ---

  /**
   * Creates and adds a new category collection.
   * @param {{ name: string, icon?: string, spaceId?: string }} params
   * @returns {import('./schema.js').Category}
   */
  addCategory({ name, icon = '📁', spaceId }) {
    const targetSpaceId = spaceId || this._data.activeSpaceId || this._data.spaces?.[0]?.id;
    const newCategory = {
      id: generateId(),
      spaceId: targetSpaceId,
      name: name.trim() || 'New Collection',
      icon: icon || '📁',
      order: this._data.categories.length,
      collapsed: false,
      bookmarks: []
    };

    this._data.categories.push(newCategory);
    queueSaveDashboardData(this._data);
    this._notify();
    return newCategory;
  }

  // --- Spaces CRUD & Management ---

  /**
   * Adds a new space.
   * @param {{ name: string, icon?: string }} params
   * @returns {import('./schema.js').Space}
   */
  addSpace({ name, icon = '📁' }) {
    if (!Array.isArray(this._data.spaces)) {
      this._data.spaces = [];
    }

    const newSpace = {
      id: generateId(),
      name: name.trim() || 'New Space',
      icon: icon || '📁',
      order: this._data.spaces.length,
      pinned: []
    };

    this._data.spaces.push(newSpace);
    if (!this._data.activeSpaceId) {
      this._data.activeSpaceId = newSpace.id;
    }

    queueSaveDashboardData(this._data);
    this._notify();
    return newSpace;
  }

  /**
   * Updates an existing space.
   * @param {string} spaceId
   * @param {{ name?: string, icon?: string }} patch
   */
  updateSpace(spaceId, patch) {
    if (!Array.isArray(this._data.spaces)) return;
    const space = this._data.spaces.find(s => s.id === spaceId);
    if (!space) return;

    if (patch.name !== undefined) space.name = patch.name.trim();
    if (patch.icon !== undefined) space.icon = patch.icon;

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Sets the active space id.
   * @param {string} spaceId
   */
  setActiveSpace(spaceId) {
    if (this._data.activeSpaceId === spaceId) return;
    const exists = this._data.spaces?.some(s => s.id === spaceId);
    if (!exists) return;

    this._data.activeSpaceId = spaceId;
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Reorders spaces.
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  reorderSpaces(sourceIndex, targetIndex) {
    if (!Array.isArray(this._data.spaces)) return;
    if (sourceIndex === targetIndex) return;
    if (sourceIndex < 0 || sourceIndex >= this._data.spaces.length) return;
    if (targetIndex < 0 || targetIndex >= this._data.spaces.length) return;

    this._data.spaces.sort((a, b) => a.order - b.order);
    const [moved] = this._data.spaces.splice(sourceIndex, 1);
    this._data.spaces.splice(targetIndex, 0, moved);

    this._data.spaces.forEach((sp, idx) => {
      sp.order = idx;
    });

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Moves a category to a different space.
   * @param {string} categoryId
   * @param {string} targetSpaceId
   */
  moveCategoryToSpace(categoryId, targetSpaceId) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (!cat) return;
    const spaceExists = this._data.spaces?.some(s => s.id === targetSpaceId);
    if (!spaceExists) return;

    cat.spaceId = targetSpaceId;
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Deletes a space and either transfers its collections to another space or deletes them.
   * Takes a snapshot and returns an undo callback.
   * @param {string} spaceId
   * @param {{ transferToSpaceId?: string | null }} [options]
   * @returns {() => void}
   */
  deleteSpace(spaceId, options = {}) {
    createSnapshot('Before delete space', this._data).catch(() => {});
    const snapshot = this._createSnapshot();

    const transferToSpaceId = options.transferToSpaceId || null;

    if (transferToSpaceId) {
      // Transfer collections
      this._data.categories.forEach(c => {
        if (c.spaceId === spaceId) {
          c.spaceId = transferToSpaceId;
        }
      });
    } else {
      // Delete collections in this space
      this._data.categories = this._data.categories.filter(c => c.spaceId !== spaceId);
      this._data.categories.forEach((c, idx) => { c.order = idx; });
    }

    // Remove the space
    this._data.spaces = (this._data.spaces || []).filter(s => s.id !== spaceId);
    this._data.spaces.forEach((s, idx) => { s.order = idx; });

    // Update active space if deleted space was active
    if (this._data.activeSpaceId === spaceId) {
      this._data.activeSpaceId = transferToSpaceId || this._data.spaces[0]?.id || '';
    }

    queueSaveDashboardData(this._data);
    this._notify();

    return () => {
      this.replaceData(snapshot);
    };
  }

  /**
   * Updates an existing category.
   * @param {string} categoryId
   * @param {{ name?: string, icon?: string }} patch
   */
  updateCategory(categoryId, patch) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (!cat) return;

    if (patch.name !== undefined) cat.name = patch.name.trim();
    if (patch.icon !== undefined) cat.icon = patch.icon;

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Deletes a category and provides an undo callback.
   * @param {string} categoryId
   * @returns {() => void} Undo restoration function
   */
  deleteCategory(categoryId) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (cat && Array.isArray(cat.bookmarks) && cat.bookmarks.length > 0) {
      createSnapshot('Before delete collection', this._data).catch(() => {});
    }
    const snapshot = this._createSnapshot();
    this._data.categories = this._data.categories.filter(c => c.id !== categoryId);
    // Recalculate order indices
    this._data.categories.forEach((c, idx) => { c.order = idx; });
    queueSaveDashboardData(this._data);
    this._notify();

    return () => {
      this.replaceData(snapshot);
    };
  }

  // --- Category Reordering ---

  /**
   * Moves a category from sourceIndex to targetIndex.
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  reorderCategories(sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) return;
    if (sourceIndex < 0 || sourceIndex >= this._data.categories.length) return;
    if (targetIndex < 0 || targetIndex >= this._data.categories.length) return;

    // Sort by order first to be certain
    this._data.categories.sort((a, b) => a.order - b.order);

    const [moved] = this._data.categories.splice(sourceIndex, 1);
    this._data.categories.splice(targetIndex, 0, moved);

    // Re-index orders
    this._data.categories.forEach((cat, idx) => {
      cat.order = idx;
    });

    queueSaveDashboardData(this._data);
    this._notify();
  }

  // --- Bookmark CRUD ---

  /**
   * Adds a bookmark to a category.
   * @param {string} categoryId
   * @param {{ name: string, url: string, icon?: any }} params
   * @returns {import('./schema.js').Bookmark | null}
   */
  addBookmark(categoryId, { name, url, icon = null }) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (!cat) return null;

    const normalized = normalizeUrl(url);
    if (!normalized.valid) {
      throw new Error(normalized.error || 'Invalid URL');
    }

    const newBookmark = {
      id: generateId(),
      name: name.trim() || normalized.domain,
      url: normalized.url,
      order: cat.bookmarks.length,
      icon: icon || null
    };

    cat.bookmarks.push(newBookmark);
    queueSaveDashboardData(this._data);
    this._notify();
    return newBookmark;
  }

  /**
   * Updates a bookmark.
   * @param {string} categoryId
   * @param {string} bookmarkId
   * @param {{ name?: string, url?: string, targetCategoryId?: string, icon?: any }} patch
   */
  updateBookmark(categoryId, bookmarkId, patch) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (!cat) return;

    const bIdx = cat.bookmarks.findIndex(b => b.id === bookmarkId);
    if (bIdx === -1) return;

    const bm = cat.bookmarks[bIdx];

    if (patch.name !== undefined) {
      bm.name = patch.name.trim();
    }

    if (patch.url !== undefined) {
      const norm = normalizeUrl(patch.url);
      if (!norm.valid) throw new Error(norm.error || 'Invalid URL');
      bm.url = norm.url;
      if (!bm.name) bm.name = norm.domain;
    }

    if (patch.icon !== undefined) {
      bm.icon = patch.icon;
    }

    // Move to another category if specified
    if (patch.targetCategoryId && patch.targetCategoryId !== categoryId) {
      const targetCat = this._data.categories.find(c => c.id === patch.targetCategoryId);
      if (targetCat) {
        cat.bookmarks.splice(bIdx, 1);
        cat.bookmarks.forEach((b, idx) => { b.order = idx; });
        bm.order = targetCat.bookmarks.length;
        targetCat.bookmarks.push(bm);
      }
    }

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Deletes a bookmark with undo restoration.
   * @param {string} categoryId
   * @param {string} bookmarkId
   * @returns {() => void} Undo restoration function
   */
  deleteBookmark(categoryId, bookmarkId) {
    const snapshot = this._createSnapshot();
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (cat) {
      cat.bookmarks = cat.bookmarks.filter(b => b.id !== bookmarkId);
      cat.bookmarks.forEach((b, idx) => { b.order = idx; });

      // Remove from all spaces' pinned lists
      if (Array.isArray(this._data.spaces)) {
        this._data.spaces.forEach(sp => {
          if (Array.isArray(sp.pinned)) {
            sp.pinned = sp.pinned.filter(id => id !== bookmarkId);
          }
        });
      }

      queueSaveDashboardData(this._data);
      this._notify();
    }

    return () => {
      this.replaceData(snapshot);
    };
  }

  // --- Bookmark Reordering & Moving ---

  /**
   * Reorders bookmarks within the same category.
   * @param {string} categoryId
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  reorderBookmarks(categoryId, sourceIndex, targetIndex) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (!cat) return;
    if (sourceIndex === targetIndex) return;
    if (sourceIndex < 0 || sourceIndex >= cat.bookmarks.length) return;
    if (targetIndex < 0 || targetIndex >= cat.bookmarks.length) return;

    cat.bookmarks.sort((a, b) => a.order - b.order);
    const [moved] = cat.bookmarks.splice(sourceIndex, 1);
    cat.bookmarks.splice(targetIndex, 0, moved);

    cat.bookmarks.forEach((bm, idx) => {
      bm.order = idx;
    });

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Sorts bookmarks in a category alphabetically by name with undo support.
   * @param {string} categoryId
   * @returns {() => void}
   */
  sortCategoryBookmarks(categoryId) {
    const cat = this._data.categories.find(c => c.id === categoryId);
    if (!cat || !Array.isArray(cat.bookmarks) || cat.bookmarks.length <= 1) {
      return () => {};
    }

    createSnapshot(`Before sort ${cat.name} A-Z`, this._data).catch(() => {});
    const snapshot = this._createSnapshot();

    cat.bookmarks.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    cat.bookmarks.forEach((b, idx) => { b.order = idx; });

    queueSaveDashboardData(this._data);
    this._notify();

    return () => {
      this.replaceData(snapshot);
    };
  }

  /**
   * Moves a bookmark from one category to another at an optional target index.
   * @param {string} sourceCategoryId
   * @param {string} targetCategoryId
   * @param {string} bookmarkId
   * @param {number} [targetIndex=-1]
   */
  moveBookmark(sourceCategoryId, targetCategoryId, bookmarkId, targetIndex = -1) {
    const sourceCat = this._data.categories.find(c => c.id === sourceCategoryId);
    const targetCat = this._data.categories.find(c => c.id === targetCategoryId);
    if (!sourceCat || !targetCat) return;

    const bIdx = sourceCat.bookmarks.findIndex(b => b.id === bookmarkId);
    if (bIdx === -1) return;

    const [bm] = sourceCat.bookmarks.splice(bIdx, 1);
    sourceCat.bookmarks.forEach((b, idx) => { b.order = idx; });

    if (targetIndex < 0 || targetIndex >= targetCat.bookmarks.length) {
      targetCat.bookmarks.push(bm);
    } else {
      targetCat.bookmarks.splice(targetIndex, 0, bm);
    }

    targetCat.bookmarks.forEach((b, idx) => { b.order = idx; });

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Replaces whole state document (e.g. on JSON import or reset).
   * @param {import('./schema.js').DashboardData} newData
   * @param {boolean} [immediate=false]
   */
  async replaceData(newData, immediate = false) {
    this._data = newData;
    if (immediate) {
      await saveDashboardDataImmediately(this._data);
    } else {
      queueSaveDashboardData(this._data);
    }
    this._notify();
  }
}

export const store = new StateStore();
registerSnapshotStore(store);
