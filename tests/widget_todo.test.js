import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import { repairSpaces } from '../extension/js/core/migrate.js';
import { renderTodoWidget } from '../extension/js/features/todo.js';

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
        checked: false,
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

test('7.4 To-do Data: repairSpaces validates and normalizes todos array', () => {
  const rawSpaces = [
    {
      id: 'sp-1',
      name: 'Work',
      icon: '💼',
      order: 0,
      pinned: [],
      todos: [
        { id: 'td-1', text: 'Prepare release notes', done: false },
        { id: 'td-2', text: 'B'.repeat(300), done: true },
        null,
        'invalid'
      ]
    }
  ];

  const { spaces } = repairSpaces(rawSpaces, 'sp-1');
  assert.equal(spaces[0].todos.length, 2);
  assert.equal(spaces[0].todos[0].text, 'Prepare release notes');
  assert.equal(spaces[0].todos[0].done, false);
  assert.equal(spaces[0].todos[1].text.length, 200); // capped at 200
  assert.equal(spaces[0].todos[1].done, true);
});

test('7.4 To-do Store: addTodo, toggleTodo, and deleteTodo mutate tasks correctly', () => {
  const spaceId = store.get().activeSpaceId;

  // Add task
  const task = store.addTodo(spaceId, 'Deploy new version');
  assert.ok(task && task.id);
  assert.equal(task.text, 'Deploy new version');
  assert.equal(task.done, false);

  const spaceWithTask = store.get().spaces.find(s => s.id === spaceId);
  assert.equal(spaceWithTask.todos.length, 1);

  // Toggle completion
  store.toggleTodo(spaceId, task.id);
  const toggledSpace = store.get().spaces.find(s => s.id === spaceId);
  assert.equal(toggledSpace.todos[0].done, true);

  // Delete task
  store.deleteTodo(spaceId, task.id);
  const clearedSpace = store.get().spaces.find(s => s.id === spaceId);
  assert.equal(clearedSpace.todos.length, 0);
});

test('7.4 To-do UI: renderTodoWidget renders card, items, and handles visibility', () => {
  const container = {
    children: [],
    appendChild(child) { this.children.push(child); },
    replaceChildren(...nodes) { this.children = nodes; },
    hidden: true
  };

  const spaceId = store.get().activeSpaceId;
  store.addTodo(spaceId, 'Sample task');

  // When disabled
  store.updateSettings({ widgets: { notes: false, todo: false } });
  renderTodoWidget(container, store.get());
  assert.equal(container.hidden, true);

  // When enabled
  store.updateSettings({ widgets: { notes: false, todo: true } });
  renderTodoWidget(container, store.get());
  assert.equal(container.hidden, false);
  assert.ok(container.children.length > 0);

  const card = container.children[0];
  assert.ok(card.className.includes('widget-todo'));
});
