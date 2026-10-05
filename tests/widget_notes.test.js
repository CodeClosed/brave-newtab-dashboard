import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData, createDefaultSettings } from '../extension/js/core/schema.js';
import { repairSpaces } from '../extension/js/core/migrate.js';
import { renderNotesWidget } from '../extension/js/features/notes.js';
import { resetSettingsSection } from '../extension/js/ui/drawer.js';

beforeEach(async () => {
  globalThis.document = {
    documentElement: {
      classList: { add: () => {}, remove: () => {} },
      setAttribute: () => {}
    },
    body: {
      appendChild: () => {},
      querySelector: () => null
    },
    activeElement: null,
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        attributes: {},
        children: [],
        dataset: {},
        value: '',
        textContent: '',
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k],
        appendChild: (c) => { el.children.push(c); return c; },
        addEventListener: () => {},
        classList: {
          add: (c) => { el.className += ` ${c}`; },
          remove: (c) => { el.className = el.className.replace(c, '').trim(); }
        },
        querySelector: () => null,
        querySelectorAll: () => []
      };
      return el;
    }
  };

  const data = createDefaultDashboardData();
  await store.replaceData(data, true);
});

afterEach(() => {
  delete globalThis.document;
});

test('7.3 Notes Data: repairSpaces preserves and clamps note property per space', () => {
  const rawSpaces = [
    { id: 'sp-1', name: 'Work', icon: '💼', order: 0, pinned: [], note: 'Meeting at 3pm' },
    { id: 'sp-2', name: 'Personal', icon: '🏠', order: 1, pinned: [], note: 'A'.repeat(12000) }
  ];

  const { spaces } = repairSpaces(rawSpaces, 'sp-1');
  assert.equal(spaces.length, 2);
  assert.equal(spaces[0].note, 'Meeting at 3pm');
  assert.equal(spaces[1].note.length, 10000); // Clamped to 10k
});

test('7.3 Notes Store: updateSpaceNote updates note on the target space', () => {
  const state = store.get();
  const spaceId = state.activeSpaceId;

  store.updateSpaceNote(spaceId, 'Buy groceries\nCall mom');
  const updatedSpace = store.get().spaces.find(s => s.id === spaceId);
  assert.equal(updatedSpace.note, 'Buy groceries\nCall mom');
});

test('7.3 Notes Isolation: each space retains its own independent note', () => {
  const sp1 = store.get().activeSpaceId;
  const sp2 = store.addSpace({ name: 'Study', icon: '📚' });

  store.updateSpaceNote(sp1, 'Work note');
  store.updateSpaceNote(sp2.id, 'Study note');

  const s1 = store.get().spaces.find(s => s.id === sp1);
  const s2 = store.get().spaces.find(s => s.id === sp2.id);

  assert.equal(s1.note, 'Work note');
  assert.equal(s2.note, 'Study note');
});

test('7.3 Notes UI: renderNotesWidget renders card with textarea and reacts to input', () => {
  const container = {
    children: [],
    appendChild(child) { this.children.push(child); },
    innerHTML: '',
    replaceChildren(...nodes) { this.children = nodes; },
    hidden: true
  };

  const state = store.get();
  const spaceId = state.activeSpaceId;
  store.updateSpaceNote(spaceId, 'Existing note text');

  // When widget is disabled in settings
  store.updateSettings({ widgets: { notes: false, todo: false } });
  renderNotesWidget(container, store.get(), (note) => store.updateSpaceNote(spaceId, note));
  assert.equal(container.hidden, true);

  // When widget is enabled
  store.updateSettings({ widgets: { notes: true, todo: false } });
  renderNotesWidget(container, store.get(), (note) => store.updateSpaceNote(spaceId, note));
  assert.equal(container.hidden, false);
  assert.ok(container.children.length > 0);

  const card = container.children[0];
  assert.equal(card.className, 'widget-card widget-notes');
});

test('7.3 Widgets Drawer: resetSettingsSection restores widgets defaults', () => {
  store.updateSettings({
    widgets: { notes: true, todo: true }
  });
  assert.equal(store.get().settings.widgets.notes, true);

  resetSettingsSection('widgets');

  const defaults = createDefaultSettings();
  assert.equal(store.get().settings.widgets.notes, defaults.widgets.notes);
  assert.equal(store.get().settings.widgets.todo, defaults.widgets.todo);
});
