// @ts-check

/**
 * Creates a DOM element with attributes, event listeners, and children.
 * Safe builder preventing XSS injection.
 *
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {(Node | string | null | undefined)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (val == null || val === false) continue;

    if (key.startsWith('on') && typeof val === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, val);
    } else if (key === 'className') {
      element.className = String(val);
    } else if (key === 'dataset' && typeof val === 'object') {
      for (const [dKey, dVal] of Object.entries(val)) {
        if (dVal != null) element.dataset[dKey] = String(dVal);
      }
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(element.style, val);
    } else if (key === 'text') {
      element.textContent = String(val);
    } else {
      element.setAttribute(key, String(val));
    }
  }

  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

/**
 * Empties all children from a DOM container.
 * @param {HTMLElement} parent
 */
export function clearChildren(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}
