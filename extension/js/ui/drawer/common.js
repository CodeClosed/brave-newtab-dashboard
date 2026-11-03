// @ts-check
import { el } from '../../utils/dom.js';

/**
 * Renders a clickable radio button pill/card.
 * @param {string} label
 * @param {boolean} isActive
 * @param {() => void} onClick
 */
export function renderRadioCard(label, isActive, onClick) {
  return el('button', {
    className: `radio-card${isActive ? ' active' : ''}`,
    type: 'button',
    text: label,
    onclick: onClick
  });
}

/**
 * Renders a standard setting item header with title, description, and an on/off toggle switch.
 * @param {string} title
 * @param {string} desc
 * @param {boolean} isChecked
 * @param {(checked: boolean) => void} onChange
 */
export function renderToggleRow(title, desc, isChecked, onChange) {
  const checkbox = /** @type {HTMLInputElement} */ (el('input', {
    type: 'checkbox',
    checked: isChecked
  }));

  checkbox.addEventListener('change', () => {
    onChange(checkbox.checked);
  });

  const slider = el('span', { className: 'toggle-slider' });
  const toggleLabel = el('label', { className: 'toggle-switch' }, checkbox, slider);

  const info = el('div', { style: { display: 'flex', flexDirection: 'column' } },
    el('span', { className: 'setting-label', text: title }),
    el('span', { className: 'setting-desc', text: desc })
  );

  return el('div', {
    className: 'setting-item-header',
    style: { padding: '4px 0' }
  }, info, toggleLabel);
}
