// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBackground,
  _resetBackgroundStateForTests,
  validateSolidColor,
  validateGradientConfig,
  formatGradientCss
} from '../extension/js/features/theme.js';

let mockOverlay;

function createMockElement(tag, attrs = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    className: attrs.className || '',
    textContent: attrs.text || '',
    children: [],
    attributes: { ...attrs },
    style: {},
    value: '',
    setAttribute: (k, v) => { el.attributes[k] = v; },
    getAttribute: (k) => el.attributes[k],
    appendChild: (child) => { el.children.push(child); return child; }
  };
  return el;
}

beforeEach(() => {
  _resetBackgroundStateForTests();
  mockOverlay = createMockElement('div', { id: 'bg-overlay' });
  globalThis.document = {
    getElementById: (id) => (id === 'bg-overlay' ? mockOverlay : null),
    documentElement: {
      classList: { contains: () => false },
      getAttribute: () => 'light'
    }
  };
});

afterEach(() => {
  _resetBackgroundStateForTests();
  delete globalThis.document;
});

test('5.6 Validation: validateSolidColor accepts valid hex and strictly rejects url() payloads', () => {
  assert.equal(validateSolidColor('#1e293b'), '#1e293b');
  assert.equal(validateSolidColor('#fff'), '#fff');
  assert.equal(validateSolidColor('#000000'), '#000000');

  // Rejections
  assert.equal(validateSolidColor('url(https://evil.com/x.png)'), null);
  assert.equal(validateSolidColor('#1e293b; background: url(x)'), null);
  assert.equal(validateSolidColor('red'), null); // strictly hex only
  assert.equal(validateSolidColor(''), null);
});

test('5.6 Validation: validateGradientConfig parses and validates {from, to, angle}', () => {
  const valid = validateGradientConfig({ from: '#0f172a', to: '#1e293b', angle: 135 });
  assert.deepEqual(valid, { from: '#0f172a', to: '#1e293b', angle: 135 });

  // Clamps angle
  const clamped = validateGradientConfig({ from: '#000000', to: '#ffffff', angle: 450 });
  assert.equal(clamped.angle, 90);

  // Rejects url() payload in from or to
  assert.equal(validateGradientConfig({ from: 'url(evil.jpg)', to: '#ffffff', angle: 90 }), null);
  assert.equal(validateGradientConfig({ from: '#000000', to: 'url(evil.jpg)', angle: 90 }), null);
});

test('5.6 Rendering: formatGradientCss constructs safe linear-gradient string', () => {
  const css = formatGradientCss({ from: '#0f172a', to: '#1e293b', angle: 135 });
  assert.equal(css, 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)');
});

test('5.6 Rendering: applyBackground applies solid color and gradient config safely without url()', async () => {
  // 1. Valid solid color
  await applyBackground({ type: 'solid', value: '#334155', dim: 0.2 }, true);
  assert.equal(mockOverlay.style.backgroundColor, '#334155');
  assert.equal(mockOverlay.style.backgroundImage, 'none');

  // 2. Malicious solid with url()
  await applyBackground({ type: 'solid', value: 'url(https://tracker.com/p.jpg)', dim: 0.2 }, true);
  assert.equal(mockOverlay.style.backgroundColor, '#1e293b'); // falls back to safe default
  assert.equal(mockOverlay.style.backgroundImage, 'none');

  // 3. Valid gradient object
  await applyBackground({
    type: 'gradient',
    value: { from: '#0f172a', to: '#38bdf8', angle: 90 },
    dim: 0.3
  }, true);
  assert.equal(mockOverlay.style.backgroundImage, 'linear-gradient(90deg, #0f172a 0%, #38bdf8 100%)');

  // 4. Malicious gradient object with url()
  await applyBackground({
    type: 'gradient',
    value: { from: 'url(bad.png)', to: '#38bdf8', angle: 90 },
    dim: 0.3
  }, true);
  assert.ok(!mockOverlay.style.backgroundImage.includes('url('));
});
