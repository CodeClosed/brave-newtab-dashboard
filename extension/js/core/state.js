// @ts-check
import { loadDashboardData, queueSaveDashboardData, saveDashboardDataImmediately, onExternalStorageChange } from './storage.js';
import { createDefaultDashboardData, generateId } from './schema.js';
import { normalizeUrl } from '../utils/url.js';
import { createSnapshot, checkAndTriggerDailySnapshot, registerSnapshotStore } from './snapshots.js';

const readonlyCache = new WeakMap();

/**
 * Recursively creates a read-only proxy around an object to protect internal state.
 * @template T
 * @param {T} target
 * @returns {T}
 */
export function makeReadonlyProxy(target) {
  if (target === null || typeof target !== 'object') {
    return target;
  }
  let proxy = readonlyCache.get(target);
  if (!proxy) {
    proxy = new Proxy(target, {
      get(obj, prop, receiver) {
        const val = Reflect.get(obj, prop, receiver);
        if (val !== null && typeof val === 'object') {
          return makeReadonlyProxy(val);
        }
        return val;
      },
      set(obj, prop) {
        throw new Error(`Cannot modify state directly outside store methods: attempted to set "${String(prop)}"`);
      },
      deleteProperty(obj, prop) {
        throw new Error(`Cannot modify state directly outside store methods: attempted to delete "${String(prop)}"`);
      }
    });
    readonlyCache.set(target, proxy);
  }
  return proxy;
}

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
    if (this._initialized) return this.get();
    this._data = await loadDashboardData();
    this._initialized = true;

    // Listen to changes from other tabs
    onExternalStorageChange((externalData) => {
      this._data = externalData;
      this._notify();
    });

    return this.get();
  }

  /**
   * Gets current state snapshot as a protected read-only view.
   * Direct mutations outside store methods will throw an Error.
   * @returns {import('./schema.js').DashboardData}
   */
  get() {
    return makeReadonlyProxy(this._data);
  }

  /**
   * Gets current state snapshot as a protected read-only view (alias for get).
   * @returns {import('./schema.js').DashboardData}
   */
  getState() {
    return makeReadonlyProxy(this._data);
  }

  /**
   * Returns internal mutable data object for tests.
   * @returns {import('./schema.js').DashboardData}
   */
  _getRawDataForTests() {
    return this._data;
  }

  /**
   * Returns a deep clone of current state for isolated/defensive reads.
   * Guarantees external callers cannot accidentally mutate internal store state.
   * @returns {import('./schema.js').DashboardData}
   */
  getCopy() {
    return JSON.parse(JSON.stringify(this._data));
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
    const readonlyView = makeReadonlyProxy(this._data);
    for (const listener of this._subscribers) {
      try {
        listener(readonlyView);
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
   * Queues saving dashboard data to persistent storage and notifies subscribers.
   * @param {import('./schema.js').DashboardData} [data]
   */
  queueSaveDashboardData(data = null) {
    if (data && typeof data === 'object') {
      this._data = data;
    }
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Alias for queueSaveDashboardData.
   */
  queueSave() {
    this.queueSaveDashboardData();
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
  addCategory({ name, icon = 'folder', spaceId, color = null, source = null, savedAt = null, bookmarks = [] }) {
    const targetSpaceId = spaceId || this._data.activeSpaceId || this._data.spaces?.[0]?.id;
    const newCategory = {
      id: generateId(),
      spaceId: targetSpaceId,
      name: (name && typeof name === 'string' && name.trim()) || 'New Collection',
      icon: icon || 'folder',
      color: color || null,
      source: source || null,
      savedAt: savedAt || null,
      order: this._data.categories.length,
      collapsed: false,
      bookmarks: Array.isArray(bookmarks) ? bookmarks : []
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
  addSpace({ name, icon = 'folder' }) {
    if (!Array.isArray(this._data.spaces)) {
      this._data.spaces = [];
    }

    const newSpace = {
      id: generateId(),
      name: name.trim() || 'New Space',
      icon: icon || 'folder',
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
   * @param {{ name?: string, icon?: string, note?: string }} patch
   */
  updateSpace(spaceId, patch) {
    if (!Array.isArray(this._data.spaces)) return;
    const space = this._data.spaces.find(s => s.id === spaceId);
    if (!space) return;

    if (patch.name !== undefined) space.name = patch.name.trim();
    if (patch.icon !== undefined) space.icon = patch.icon;
    if (patch.note !== undefined) space.note = typeof patch.note === 'string' ? patch.note.slice(0, 10000) : '';

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Updates note text for a specific space with quiet debounced save.
   * @param {string} spaceId
   * @param {string} note
   * @param {boolean} [silent=false] If true, saves without triggering full notify
   */
  updateSpaceNote(spaceId, note, silent = false) {
    if (!Array.isArray(this._data.spaces)) return;
    const space = this._data.spaces.find(s => s.id === spaceId);
    if (!space) return;

    space.note = typeof note === 'string' ? note.slice(0, 10000) : '';
    queueSaveDashboardData(this._data);
    if (!silent) {
      this._notify();
    }
  }

  /**
   * Adds a to-do item to the specified space.
   * @param {string} spaceId
   * @param {string} text
   * @returns {{ id: string, text: string, done: boolean } | null}
   */
  addTodo(spaceId, text) {
    if (!Array.isArray(this._data.spaces)) return null;
    const space = this._data.spaces.find(s => s.id === spaceId);
    if (!space) return null;

    if (!Array.isArray(space.todos)) {
      space.todos = [];
    }

    const trimmed = (typeof text === 'string') ? text.trim().slice(0, 200) : '';
    if (!trimmed) return null;

    const newTodo = {
      id: generateId(),
      text: trimmed,
      done: false
    };

    space.todos.push(newTodo);
    queueSaveDashboardData(this._data);
    this._notify();
    return newTodo;
  }

  /**
   * Toggles the completion state of a to-do item.
   * @param {string} spaceId
   * @param {string} todoId
   */
  toggleTodo(spaceId, todoId) {
    if (!Array.isArray(this._data.spaces)) return;
    const space = this._data.spaces.find(s => s.id === spaceId);
    if (!space || !Array.isArray(space.todos)) return;

    const item = space.todos.find(t => t.id === todoId);
    if (!item) return;

    item.done = !item.done;
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Deletes a to-do item from the specified space.
   * @param {string} spaceId
   * @param {string} todoId
   */
  deleteTodo(spaceId, todoId) {
    if (!Array.isArray(this._data.spaces)) return;
    const space = this._data.spaces.find(s => s.id === spaceId);
    if (!space || !Array.isArray(space.todos)) return;

    const idx = space.todos.findIndex(t => t.id === todoId);
    if (idx === -1) return;

    space.todos.splice(idx, 1);
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Clears all completed to-do items from the specified space.
   * @param {string} spaceId
   */
  clearCompletedTodos(spaceId) {
    if (!Array.isArray(this._data.spaces)) return;
    const space = this._data.spaces.find(s => s.id === spaceId);
    if (!space || !Array.isArray(space.todos)) return;

    space.todos = space.todos.filter(t => !t.done);
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
   * Toggles bookmark pin status in active space.
   * @param {string} bookmarkId
   * @returns {{ success: boolean, pinned: boolean, reason?: string }}
   */
  togglePinBookmark(bookmarkId) {
    let space = this._data.spaces?.find(s => s.id === this._data.activeSpaceId) || this._data.spaces?.[0];
    if (!space) return { success: false, pinned: false, reason: 'no-space' };

    if (!Array.isArray(space.pinned)) {
      space.pinned = [];
    }

    const idx = space.pinned.indexOf(bookmarkId);
    if (idx !== -1) {
      space.pinned.splice(idx, 1);
      queueSaveDashboardData(this._data);
      this._notify();
      return { success: true, pinned: false };
    }

    const maxItems = typeof this._data.settings?.dock?.maxItems === 'number'
      ? this._data.settings.dock.maxItems
      : 12;

    if (space.pinned.length >= maxItems) {
      return { success: false, pinned: false, reason: `Maximum ${maxItems} pinned bookmarks reached` };
    }

    space.pinned.push(bookmarkId);
    queueSaveDashboardData(this._data);
    this._notify();
    return { success: true, pinned: true };
  }

  /**
   * Pins bookmark into the active space dock at an optional index.
   * @param {string} bookmarkId
   * @param {number} [targetIndex=-1]
   * @returns {{ success: boolean, pinned: boolean, reason?: string, alreadyPinned?: boolean }}
   */
  pinBookmark(bookmarkId, targetIndex = -1) {
    let space = this._data.spaces?.find(s => s.id === this._data.activeSpaceId) || this._data.spaces?.[0];
    if (!space) return { success: false, pinned: false, reason: 'no-space' };

    if (!Array.isArray(space.pinned)) {
      space.pinned = [];
    }

    const existingIdx = space.pinned.indexOf(bookmarkId);
    if (existingIdx !== -1) {
      if (targetIndex >= 0 && targetIndex < space.pinned.length && targetIndex !== existingIdx) {
        this.reorderPinnedBookmark(existingIdx, targetIndex);
      }
      return { success: true, pinned: true, alreadyPinned: true };
    }

    const maxItems = typeof this._data.settings?.dock?.maxItems === 'number'
      ? this._data.settings.dock.maxItems
      : 12;

    if (space.pinned.length >= maxItems) {
      return { success: false, pinned: false, reason: `Maximum ${maxItems} pinned bookmarks reached` };
    }

    if (targetIndex >= 0 && targetIndex <= space.pinned.length) {
      space.pinned.splice(targetIndex, 0, bookmarkId);
    } else {
      space.pinned.push(bookmarkId);
    }

    queueSaveDashboardData(this._data);
    this._notify();
    return { success: true, pinned: true };
  }

  /**
   * Reorders a pinned bookmark within the active space.
   * @param {number} fromIndex
   * @param {number} toIndex
   * @returns {boolean}
   */
  reorderPinnedBookmark(fromIndex, toIndex) {
    let space = this._data.spaces?.find(s => s.id === this._data.activeSpaceId) || this._data.spaces?.[0];
    if (!space || !Array.isArray(space.pinned)) return false;
    if (fromIndex < 0 || fromIndex >= space.pinned.length) return false;
    if (toIndex < 0 || toIndex >= space.pinned.length) return false;
    if (fromIndex === toIndex) return false;

    const [movedId] = space.pinned.splice(fromIndex, 1);
    space.pinned.splice(toIndex, 0, movedId);
    queueSaveDashboardData(this._data);
    this._notify();
    return true;
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
    if (patch.color !== undefined) cat.color = patch.color;
    if (patch.displayMode !== undefined) cat.displayMode = patch.displayMode;
    if (patch.bookmarks !== undefined) cat.bookmarks = patch.bookmarks;
    if (patch.savedAt !== undefined) cat.savedAt = patch.savedAt;

    if (patch.source !== undefined) {
      cat.source = patch.source;
    } else if (patch.name !== undefined || patch.icon !== undefined || patch.color !== undefined) {
      // 13.4 Clear "Saved from tabs" badge when collection is edited
      if (cat.source === 'tabs') {
        cat.source = null;
      }
    }

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
    // Remove deleted category bookmarks from all spaces' pinned lists
    if (cat && Array.isArray(cat.bookmarks) && cat.bookmarks.length > 0 && Array.isArray(this._data.spaces)) {
      const deletedBmIds = new Set(cat.bookmarks.map(b => b.id));
      this._data.spaces.forEach(sp => {
        if (Array.isArray(sp.pinned)) {
          sp.pinned = sp.pinned.filter(id => !deletedBmIds.has(id));
        }
      });
    }
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
   * Bulk deletes bookmarks across categories.
   * @param {string[]} bookmarkIds
   */
  bulkDeleteBookmarks(bookmarkIds) {
    const idSet = new Set(bookmarkIds);
    for (const cat of this._data.categories || []) {
      if (Array.isArray(cat.bookmarks)) {
        cat.bookmarks = cat.bookmarks.filter(b => !idSet.has(b.id));
        cat.bookmarks.forEach((b, idx) => { b.order = idx; });
      }
    }
    if (Array.isArray(this._data.spaces)) {
      this._data.spaces.forEach(sp => {
        if (Array.isArray(sp.pinned)) {
          sp.pinned = sp.pinned.filter(id => !idSet.has(id));
        }
      });
    }
    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Bulk moves bookmarks to a target category.
   * @param {string[]} bookmarkIds
   * @param {string} targetCategoryId
   */
  bulkMoveBookmarks(bookmarkIds, targetCategoryId) {
    const idSet = new Set(bookmarkIds);
    const targetCat = this._data.categories?.find(c => c.id === targetCategoryId);
    if (!targetCat) return;

    /** @type {any[]} */
    const movedBookmarks = [];
    for (const cat of this._data.categories || []) {
      if (cat.id === targetCategoryId) continue;
      if (Array.isArray(cat.bookmarks)) {
        const remaining = [];
        for (const bm of cat.bookmarks) {
          if (idSet.has(bm.id)) {
            movedBookmarks.push(bm);
          } else {
            remaining.push(bm);
          }
        }
        cat.bookmarks = remaining;
        cat.bookmarks.forEach((b, idx) => { b.order = idx; });
      }
    }

    if (!Array.isArray(targetCat.bookmarks)) {
      targetCat.bookmarks = [];
    }

    for (const bm of movedBookmarks) {
      bm.order = targetCat.bookmarks.length;
      targetCat.bookmarks.push(bm);
    }

    queueSaveDashboardData(this._data);
    this._notify();
  }

  /**
   * Bulk pins bookmarks to the active space, capping at 8.
   * @param {string[]} bookmarkIds
   * @returns {{ pinnedCount: number, capped: boolean }}
   */
  bulkPinBookmarks(bookmarkIds) {
    const space = this._data.spaces?.find(s => s.id === this._data.activeSpaceId) || this._data.spaces?.[0];
    if (!space) return { pinnedCount: 0, capped: false };

    if (!Array.isArray(space.pinned)) {
      space.pinned = [];
    }

    let count = 0;
    let capped = false;
    for (const id of bookmarkIds) {
      if (space.pinned.includes(id)) continue;
      if (space.pinned.length >= 8) {
        capped = true;
        break;
      }
      space.pinned.push(id);
      count++;
    }

    if (count > 0) {
      queueSaveDashboardData(this._data);
      this._notify();
    }

    return { pinnedCount: count, capped };
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
