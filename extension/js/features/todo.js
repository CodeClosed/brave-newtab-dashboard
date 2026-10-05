// @ts-check
import { el } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { store } from '../core/state.js';

/**
 * Renders or updates the To-do widget.
 * @param {any} container
 * @param {import('../core/schema.js').DashboardData} state
 */
export function renderTodoWidget(container, state) {
  if (!container) return;

  const isEnabled = Boolean(state?.settings?.widgets?.todo);
  if (!isEnabled) {
    container.hidden = true;
    if (typeof container.replaceChildren === 'function') {
      container.replaceChildren();
    }
    return;
  }

  container.hidden = false;

  const activeSpace = state?.spaces?.find(s => s.id === state.activeSpaceId) || state?.spaces?.[0];
  const todos = Array.isArray(activeSpace?.todos) ? activeSpace.todos : [];
  const spaceId = activeSpace?.id;
  const spaceName = activeSpace?.name || 'Space';
  const spaceIcon = activeSpace?.icon || '📁';

  const pendingCount = todos.filter(t => !t.done).length;
  const completedCount = todos.filter(t => t.done).length;

  const titleText = t('todoTitle', 'To-do');
  const placeholderText = t('todoPlaceholder', 'Add a task... (press Enter)');

  // Header
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', text: titleText }),
      el('span', { className: 'widget-space-badge', text: `${spaceIcon} ${spaceName}` }),
      el('span', { className: 'widget-count-badge', text: `${pendingCount} remaining` })
    ]),
    completedCount > 0 ? el('button', {
      className: 'btn-quiet btn-sm',
      type: 'button',
      text: 'Clear completed',
      onclick: () => {
        if (spaceId) store.clearCompletedTodos(spaceId);
      }
    }) : null
  ]);

  // Input form
  const inputEl = /** @type {HTMLInputElement} */ (el('input', {
    className: 'todo-input',
    type: 'text',
    placeholder: placeholderText,
    ariaLabel: 'New task text'
  }));

  const submitTask = () => {
    const text = inputEl.value.trim();
    if (text && spaceId) {
      store.addTodo(spaceId, text);
      inputEl.value = '';
    }
  };

  const form = el('form', {
    className: 'todo-form',
    onsubmit: (e) => {
      e.preventDefault();
      submitTask();
    }
  }, [
    inputEl,
    el('button', {
      className: 'btn-secondary btn-sm',
      type: 'submit',
      text: t('btnAdd', 'Add')
    })
  ]);

  // List of tasks
  const listEl = el('div', { className: 'todo-list', role: 'list' });

  todos.forEach((item) => {
    const checkbox = /** @type {HTMLInputElement} */ (el('input', {
      className: 'todo-checkbox',
      type: 'checkbox',
      checked: item.done,
      ariaLabel: `Mark "${item.text}" as ${item.done ? 'incomplete' : 'complete'}`
    }));

    checkbox.addEventListener('change', () => {
      if (spaceId) store.toggleTodo(spaceId, item.id);
    });

    const textEl = el('span', {
      className: `todo-text${item.done ? ' done' : ''}`,
      text: item.text
    });

    const deleteBtn = el('button', {
      className: 'icon-action-btn todo-delete-btn',
      type: 'button',
      text: '×',
      title: 'Delete task',
      ariaLabel: `Delete "${item.text}"`,
      onclick: () => {
        if (spaceId) store.deleteTodo(spaceId, item.id);
      }
    });

    const row = el('div', { className: 'todo-item-row', role: 'listitem' }, [
      checkbox,
      textEl,
      deleteBtn
    ]);

    listEl.appendChild(row);
  });

  const card = el('div', { className: 'widget-card widget-todo' }, [
    header,
    form,
    todos.length > 0 ? listEl : el('div', { className: 'todo-empty', text: 'No tasks yet.' })
  ]);

  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(card);
  } else {
    container.appendChild(card);
  }
}
