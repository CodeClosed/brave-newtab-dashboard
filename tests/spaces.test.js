import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import { cycleSpace, renderSpaceSwitcher } from '../extension/js/features/spaces.js';

test('3.1 Spaces: add, update, reorder, and set active space', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const initialSpace = store.get().spaces[0];
  assert.equal(store.get().spaces.length, 1);
  assert.equal(store.get().activeSpaceId, initialSpace.id);

  // Add space
  const workSpace = store.addSpace({ name: 'Work', icon: '💼' });
  assert.equal(store.get().spaces.length, 2);
  assert.equal(workSpace.name, 'Work');
  assert.equal(workSpace.icon, '💼');
  assert.equal(workSpace.order, 1);
  assert.deepEqual(workSpace.pinned, []);

  // Update space
  store.updateSpace(workSpace.id, { name: 'Work & Projects', icon: '🚀' });
  const updatedSpace = store.get().spaces.find(s => s.id === workSpace.id);
  assert.equal(updatedSpace.name, 'Work & Projects');
  assert.equal(updatedSpace.icon, '🚀');

  // Set active space
  store.setActiveSpace(workSpace.id);
  assert.equal(store.get().activeSpaceId, workSpace.id);

  // Add third space and reorder
  const personalSpace = store.addSpace({ name: 'Personal', icon: '🌴' });
  assert.equal(store.get().spaces.length, 3);
  // Reorder index 2 (Personal) to index 0
  store.reorderSpaces(2, 0);
  assert.equal(store.get().spaces[0].id, personalSpace.id);
  assert.equal(store.get().spaces[0].order, 0);
  assert.equal(store.get().spaces[1].order, 1);
  assert.equal(store.get().spaces[2].order, 2);
});

test('3.1 Spaces: moveCategoryToSpace moves collection to target space', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const workSpace = store.addSpace({ name: 'Work', icon: '💼' });
  const cat = store.get().categories[0];
  const originalSpaceId = cat.spaceId;

  store.moveCategoryToSpace(cat.id, workSpace.id);
  const updatedCat = store.get().categories.find(c => c.id === cat.id);
  assert.equal(updatedCat.spaceId, workSpace.id);
  assert.notEqual(updatedCat.spaceId, originalSpaceId);
});

test('3.1 Spaces: deleteSpace with collection transfer and undo', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const homeSpace = store.get().spaces[0];
  const workSpace = store.addSpace({ name: 'Work', icon: '💼' });
  // Move first category to work space
  const cat = store.get().categories[0];
  store.moveCategoryToSpace(cat.id, workSpace.id);
  store.setActiveSpace(workSpace.id);

  // Delete work space, transferring its collections to homeSpace
  const undo = store.deleteSpace(workSpace.id, { transferToSpaceId: homeSpace.id });
  assert.equal(store.get().spaces.length, 1);
  assert.equal(store.get().spaces.some(s => s.id === workSpace.id), false);
  // Active space should switch back to remaining space
  assert.equal(store.get().activeSpaceId, homeSpace.id);
  // Category should now belong to homeSpace
  assert.equal(store.get().categories.find(c => c.id === cat.id).spaceId, homeSpace.id);

  // Test undo
  undo();
  assert.equal(store.get().spaces.length, 2);
  assert.equal(store.get().spaces.some(s => s.id === workSpace.id), true);
  assert.equal(store.get().categories.find(c => c.id === cat.id).spaceId, workSpace.id);
  assert.equal(store.get().activeSpaceId, workSpace.id);
});

test('3.1 Spaces: deleteSpace with collection delete and undo', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const homeSpace = store.get().spaces[0];
  const workSpace = store.addSpace({ name: 'Work', icon: '💼' });
  const cat = store.get().categories[0];
  store.moveCategoryToSpace(cat.id, workSpace.id);

  const initialCatCount = store.get().categories.length;

  // Delete work space without transfer (collections deleted)
  const undo = store.deleteSpace(workSpace.id, { transferToSpaceId: null });
  assert.equal(store.get().spaces.length, 1);
  assert.equal(store.get().categories.length, initialCatCount - 1);
  assert.equal(store.get().categories.some(c => c.id === cat.id), false);

  // Test undo
  undo();
  assert.equal(store.get().spaces.length, 2);
  assert.equal(store.get().categories.length, initialCatCount);
  assert.equal(store.get().categories.some(c => c.id === cat.id), true);
});

test('3.1 Spaces: cycleSpace cycles previous and next spaces with wrap-around', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const space1 = store.get().spaces[0];
  const space2 = store.addSpace({ name: 'Work', icon: '💼' });
  const space3 = store.addSpace({ name: 'Play', icon: '🎮' });

  store.setActiveSpace(space1.id);

  // Next: 1 -> 2
  cycleSpace('next');
  assert.equal(store.get().activeSpaceId, space2.id);

  // Next: 2 -> 3
  cycleSpace('next');
  assert.equal(store.get().activeSpaceId, space3.id);

  // Next: 3 -> 1 (wrap)
  cycleSpace('next');
  assert.equal(store.get().activeSpaceId, space1.id);

  // Prev: 1 -> 3 (wrap)
  cycleSpace('prev');
  assert.equal(store.get().activeSpaceId, space3.id);

  // Prev: 3 -> 2
  cycleSpace('prev');
  assert.equal(store.get().activeSpaceId, space2.id);
});

test('3.1 Spaces: renderSpaceSwitcher hidden when 1 space, visible when multiple', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);

  const container = {
    hidden: false,
    style: {},
    replaceChildren: () => {},
    appendChild: () => {}
  };

  renderSpaceSwitcher(container);
  assert.equal(container.hidden, true);
  assert.equal(container.style.display, 'none');

  // Add second space
  store.addSpace({ name: 'Work', icon: '💼' });

  const origDoc = globalThis.document;
  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      setAttribute: () => {},
      appendChild: () => {},
      addEventListener: () => {}
    })
  };

  try {
    renderSpaceSwitcher(container);
    assert.equal(container.hidden, false);
    assert.equal(container.style.display, 'flex');
  } finally {
    globalThis.document = origDoc;
  }
});

