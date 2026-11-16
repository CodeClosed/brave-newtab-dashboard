// @ts-check
import { el } from '../../utils/dom.js';

const ICON_REFRESH = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`;

/**
 * Renders a uniform section header with headline, subtitle, and optional reset button.
 * @param {string} title
 * @param {string} subtitle
 * @param {(() => void) | null} [onReset]
 */
export function renderSectionHeader(title, subtitle, onReset = null) {
  const children = [
    el('div', {}, [
      el('h3', { className: 'settings-section-headline', text: title }),
      el('p', { className: 'settings-section-subtitle', text: subtitle })
    ])
  ];
  if (typeof onReset === 'function') {
    children.push(
      el('button', {
        className: 'section-reset-btn',
        type: 'button',
        title: `Reset ${title} to defaults`,
        html: `${ICON_REFRESH}<span>Reset</span>`,
        onclick: onReset
      })
    );
  }
  return el('div', { className: 'settings-section-header' }, children);
}

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
    'aria-pressed': String(Boolean(isActive)),
    text: label,
    onclick: onClick
  });
}

/**
 * Renders a standard setting item with title, description, and an on/off toggle switch.
 * Wrapped in a `.setting-item` card by default unless `options.flat` is true.
 * @param {string} title
 * @param {string} desc
 * @param {boolean} isChecked
 * @param {(checked: boolean) => void} onChange
 * @param {{ flat?: boolean }} [options]
 */
export function renderToggleRow(title, desc, isChecked, onChange, options = {}) {
  const checkbox = /** @type {HTMLInputElement} */ (el('input', {
    type: 'checkbox',
    checked: isChecked
  }));

  checkbox.addEventListener('change', () => {
    onChange(checkbox.checked);
  });

  const slider = el('span', { className: 'toggle-slider' });
  const toggleLabel = el('label', { className: 'toggle-switch', 'aria-label': title }, checkbox, slider);

  const info = el('div', { className: 'setting-toggle-info' },
    el('span', { className: 'setting-label', text: title }),
    desc ? el('span', { className: 'setting-desc', text: desc }) : null
  );

  const row = el('div', { className: 'setting-item-header setting-toggle-row' }, info, toggleLabel);
  if (options.flat) {
    return row;
  }
  return el('div', { className: 'setting-item setting-toggle-card' }, row);
}

/**
 * Renders a labeled range slider with a live numeric pill badge.
 * @param {object} params
 * @param {string} params.label
 * @param {string} [params.desc]
 * @param {string} params.valueText
 * @param {number | string} params.min
 * @param {number | string} params.max
 * @param {number | string} params.step
 * @param {number | string} params.value
 * @param {(val: number, badgeEl: HTMLElement) => void} params.onInput
 * @param {boolean} [params.flat]
 */
export function renderSliderRow({ label, desc = '', valueText, min, max, step, value, onInput, flat = false }) {
  const badge = el('span', { className: 'slider-value-badge', text: valueText });
  const input = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    'aria-label': label
  }));

  input.addEventListener('input', () => {
    onInput(parseFloat(input.value), badge);
  });

  const header = el('div', { className: 'setting-item-header' }, [
    el('div', { className: 'setting-toggle-info' }, [
      el('span', { className: 'setting-label', text: label }),
      desc ? el('span', { className: 'setting-desc', text: desc }) : null
    ]),
    badge
  ]);

  const control = el('div', { className: 'slider-container' }, [input]);

  if (flat) {
    return el('div', { className: 'setting-sub-slider' }, [header, control]);
  }
  return el('div', { className: 'setting-item' }, [header, control]);
}
