// @ts-check
import { loadDashboardData, queueSaveDashboardData, saveDashboardDataImmediately, onExternalStorageChange } from './storage.js';
import { createDefaultDashboardData, generateId } from './schema.js';
import { normalizeUrl } from '../utils/url.js';

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

  // --- Category CRUD ---

  /**
   * Creates and adds a new category collection.
   * @param {{ name: string, icon?: string }} params
   * @returns {import('./schema.js').Category}
   */
  addCategory({ name, icon = '📁' }) {
    const newCategory = {
      id: generateId(),
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
    const snapshot = this._createSnapshot();
    this._data.categories = this._data.categories.filter(c => c.id !== categoryId);
    // Recalculate order indices
    this._data.categories.forEach((cat, idx) => { cat.order = idx; });
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
   * @param {{ name: string, url: string }} params
   * @returns {import('./schema.js').Bookmark | null}
   */
  addBookmark(categoryId, { name, url }) {
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
      order: cat.bookmarks.length
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
   * @param {{ name?: string, url?: string, targetCategoryId?: string }} patch
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
