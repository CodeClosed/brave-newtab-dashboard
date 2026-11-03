// @ts-check
import { store } from '../../core/state.js';
import { el, clearChildren } from '../../utils/dom.js';
import { showToast } from '../toasts.js';
import { saveBackgroundImage, deleteBackgroundImage } from '../../core/idb.js';
import {
  downscaleImage,
  validateAccentContrast,
  suggestAccessibleShade,
  validateSolidColor,
  validateGradientConfig,
  formatGradientCss
} from '../../features/theme.js';
import { THEME_PRESETS, applyThemePreset } from '../../features/presets.js';
import { getSolarTimes } from '../../features/schedule.js';
import { renderWallpaperLibrary, BUNDLED_WALLPAPERS } from '../../features/wallpaper.js';
import { renderRadioCard, renderToggleRow } from './common.js';


export const ACCENTS = [
  { id: 'slate', color: '#64748b', name: 'Slate' },
  { id: 'blue', color: '#3b82f6', name: 'Blue' },
  { id: 'emerald', color: '#10b981', name: 'Emerald' },
  { id: 'amber', color: '#f59e0b', name: 'Amber' },
  { id: 'rose', color: '#f43f5e', name: 'Rose' }
];

export const SOLID_PRESETS = [
  { name: 'Charcoal Slate', value: '#181e24' },
  { name: 'Midnight Navy', value: '#131d28' },
  { name: 'Deep Forest', value: '#142219' },
  { name: 'Dark Mocha', value: '#241c18' }
];

export const GRADIENT_PRESETS = [
  { name: 'Slate Calm', value: { from: '#111827', to: '#1f2937', angle: 135 } },
  { name: 'Nordic Deep', value: { from: '#0f172a', to: '#1e293b', angle: 135 } },
  { name: 'Quiet Dusk', value: { from: '#1c1917', to: '#292524', angle: 135 } }
];

const ICON_SUN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const ICON_MOON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
const ICON_WARNING = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

export function renderAppearanceSection(settings, { renderDrawerContent = () => {}, resetSettingsSection = () => {} } = {}) {
  const section = el('div', { className: 'settings-section' });

  // 4.5 Curated Theme Presets
  const presetsGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Curated Theme Presets' }),
      el('span', { className: 'setting-desc', text: 'One-click visual bundles with undo' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(5, 1fr)' } },
      ...THEME_PRESETS.map(preset => {
        const isSelected = settings.palette === preset.settings.palette &&
          settings.accent === preset.settings.accent &&
          settings.theme === preset.settings.theme;
        return renderRadioCard(preset.name, isSelected, () => {
          const res = applyThemePreset(preset.id, store);
          if (res.success) {
            renderDrawerContent();
            showToast(`Applied "${preset.name}" preset`, () => {
              if (res.undo) res.undo();
              renderDrawerContent();
              showToast('Preset undone');
            });
          }
        });
      })
    )
  );

  section.appendChild(presetsGroup);

  // Theme cards
  const themeGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Theme' })
    ),
    el('div', { className: 'radio-group-cards' },
      renderRadioCard('System', settings.theme === 'system', () => {
        store.updateSettings({ theme: 'system' });
        renderDrawerContent();
      }),
      renderRadioCard('Light', settings.theme === 'light', () => {
        store.updateSettings({ theme: 'light' });
        renderDrawerContent();
      }),
      renderRadioCard('Dark', settings.theme === 'dark', () => {
        store.updateSettings({ theme: 'dark' });
        renderDrawerContent();
      })
    )
  );

  // 4.4 Palette selection
  const currentPalette = settings.palette || 'default';
  const paletteGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Color Palette' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
      renderRadioCard('Default', currentPalette === 'default', () => {
        store.updateSettings({ palette: 'default' });
        renderDrawerContent();
      }),
      renderRadioCard('AMOLED', currentPalette === 'amoled', () => {
        store.updateSettings({ palette: 'amoled' });
        renderDrawerContent();
      }),
      renderRadioCard('Paper', currentPalette === 'paper', () => {
        store.updateSettings({ palette: 'paper' });
        renderDrawerContent();
      }),
      renderRadioCard('Contrast', currentPalette === 'contrast', () => {
        store.updateSettings({ palette: 'contrast' });
        renderDrawerContent();
      })
    )
  );

  // Accent circles + Custom Accent
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const accentPicker = el('div', { className: 'accent-picker' });
  for (const acc of ACCENTS) {
    const btn = el('button', {
      className: `accent-circle-btn${settings.accent === acc.id ? ' selected' : ''}`,
      type: 'button',
      style: { backgroundColor: acc.color },
      title: acc.name,
      'aria-label': `${acc.name} accent`,
      onclick: () => {
        store.updateSettings({ accent: acc.id });
        renderDrawerContent();
      }
    });
    accentPicker.appendChild(btn);
  }

  // Custom accent circle trigger
  const isCustomAccent = settings.accent === 'custom';
  const customColorVal = settings.accentCustom || '#3b82f6';
  const customBtn = el('button', {
    className: `accent-circle-btn${isCustomAccent ? ' selected' : ''}`,
    type: 'button',
    style: { background: isCustomAccent ? customColorVal : 'conic-gradient(from 180deg, red, yellow, lime, aqua, blue, magenta, red)' },
    title: 'Custom accent color',
    'aria-label': 'Custom accent color',
    onclick: () => {
      store.updateSettings({ accent: 'custom', accentCustom: customColorVal });
      renderDrawerContent();
    }
  });
  accentPicker.appendChild(customBtn);

  let customAccentControls = null;
  if (isCustomAccent) {
    const contrastRes = validateAccentContrast(customColorVal, isDark);

    const colorPickerInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: customColorVal,
      style: { width: '32px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }
    }));

    const hexInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'inline-add-input',
      value: customColorVal,
      placeholder: '#3b82f6',
      style: { width: '90px', fontFamily: 'var(--font-mono)' },
      'aria-label': 'Custom accent hex code'
    }));

    const contrastBadge = el('span', {
      className: `search-result-section-badge${contrastRes.valid ? '' : ' danger'}`,
      html: contrastRes.valid
        ? `${ICON_CHECK}<span>WCAG AA (${contrastRes.ratio}:1)</span>`
        : `${ICON_WARNING}<span>Fails AA (${contrastRes.ratio}:1)</span>`
    });

    const updateCustomColor = (newHex) => {
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(newHex)) {
        const bgHex = isDark
          ? (settings.palette === 'amoled' || settings.palette === 'contrast' ? '#0a0a0a' : '#1b1e22')
          : (settings.palette === 'paper' ? '#faf8f5' : '#ffffff');
        const val = validateAccentContrast(newHex, isDark, bgHex);
        if (!val.valid) {
          showToast(val.reason || 'Low contrast against background. Suggested accessible shade applied.');
          store.updateSettings({ accent: 'custom', accentCustom: val.suggestedHex || newHex });
        } else {
          store.updateSettings({ accent: 'custom', accentCustom: newHex });
        }
        renderDrawerContent();
      }
    };

    colorPickerInput.addEventListener('input', () => {
      hexInput.value = colorPickerInput.value;
    });

    colorPickerInput.addEventListener('change', () => {
      updateCustomColor(colorPickerInput.value);
    });

    hexInput.addEventListener('change', () => {
      updateCustomColor(hexInput.value.trim());
    });

    const customRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
      colorPickerInput,
      hexInput,
      contrastBadge
    );

    if (!contrastRes.valid && contrastRes.suggestedHex) {
      const fixBtn = el('button', {
        className: 'btn-secondary btn-sm',
        type: 'button',
        text: `Apply passing shade (${contrastRes.suggestedHex})`,
        onclick: () => {
          store.updateSettings({ accent: 'custom', accentCustom: contrastRes.suggestedHex });
          renderDrawerContent();
        }
      });
      customRow.appendChild(fixBtn);
    }

    customAccentControls = customRow;
  }

  const accentGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Accent Color' })
    ),
    accentPicker
  );
  if (customAccentControls) {
    accentGroup.appendChild(customAccentControls);
  }

  // 4.6 Theme Schedule (auto light/dark switch)
  const schedule = settings.themeSchedule || { enabled: false, mode: 'hours', lightFrom: '07:00', darkFrom: '19:00' };
  const scheduleToggleRow = renderToggleRow(
    'Theme Schedule',
    'Automatically switch between light and dark themes',
    Boolean(schedule.enabled),
    (checked) => {
      store.updateSettings({
        themeSchedule: { ...schedule, enabled: checked }
      });
      renderDrawerContent();
    }
  );

  const scheduleGroup = el('div', { className: 'setting-item' }, scheduleToggleRow);

  if (schedule.enabled) {
    const isSolar = schedule.mode === 'solar';
    const solarTimes = getSolarTimes();

    const modeSelector = el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '8px' } },
      renderRadioCard('Explicit Hours', !isSolar, () => {
        store.updateSettings({
          themeSchedule: { ...schedule, mode: 'hours' }
        });
        renderDrawerContent();
      }),
      renderRadioCard('Sunrise to Sunset', isSolar, () => {
        store.updateSettings({
          themeSchedule: { ...schedule, mode: 'solar' }
        });
        renderDrawerContent();
      })
    );
    scheduleGroup.appendChild(modeSelector);

    if (isSolar) {
      const solarInfo = el('div', {
        style: {
          marginTop: '8px',
          padding: '6px 10px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          background: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius-xs)',
          border: '1px solid var(--border-subtle)'
        },
        html: `<span style="display:inline-flex;align-items:center;gap:6px">${ICON_SUN}<span>Sunrise: ~${solarTimes.sunriseStr}</span><span style="opacity:0.5">•</span>${ICON_MOON}<span>Sunset: ~${solarTimes.sunsetStr} (solar estimation from local date)</span></span>`
      });
      scheduleGroup.appendChild(solarInfo);
    } else {
      const timeInputsRow = el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginTop: '8px',
          padding: '0 4px',
          flexWrap: 'wrap'
        }
      });

      const lightLabel = el('label', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-subtle)' }
      }, [
        el('span', { text: 'Light mode from:' }),
        (() => {
          const input = el('input', {
            type: 'time',
            className: 'input-time',
            value: schedule.lightFrom || '07:00',
            'aria-label': 'Light theme start time',
            style: { padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }
          });
          input.addEventListener('change', (e) => {
            const val = /** @type {HTMLInputElement} */ (e.target).value;
            if (val) {
              store.updateSettings({
                themeSchedule: { ...schedule, lightFrom: val }
              });
            }
          });
          return input;
        })()
      ]);

      const darkLabel = el('label', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-subtle)' }
      }, [
        el('span', { text: 'Dark mode from:' }),
        (() => {
          const input = el('input', {
            type: 'time',
            className: 'input-time',
            value: schedule.darkFrom || '19:00',
            'aria-label': 'Dark theme start time',
            style: { padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }
          });
          input.addEventListener('change', (e) => {
            const val = /** @type {HTMLInputElement} */ (e.target).value;
            if (val) {
              store.updateSettings({
                themeSchedule: { ...schedule, darkFrom: val }
              });
            }
          });
          return input;
        })()
      ]);

      timeInputsRow.appendChild(lightLabel);
      timeInputsRow.appendChild(darkLabel);
      scheduleGroup.appendChild(timeInputsRow);
    }
  }

  section.appendChild(themeGroup);
  section.appendChild(scheduleGroup);
  section.appendChild(paletteGroup);
  section.appendChild(accentGroup);

  // Background Options
  const bgConfig = settings.background || { type: 'none', value: null, dim: 0.35 };

  const bgTypeGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Background Surface' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
      renderRadioCard('None', bgConfig.type === 'none', () => {
        store.updateSettings({ background: { ...bgConfig, type: 'none' } });
        renderDrawerContent();
      }),
      renderRadioCard('Solid', bgConfig.type === 'solid', () => {
        store.updateSettings({ background: { ...bgConfig, type: 'solid', value: SOLID_PRESETS[0].value } });
        renderDrawerContent();
      }),
      renderRadioCard('Gradient', bgConfig.type === 'gradient', () => {
        const val = validateGradientConfig(bgConfig.value) || GRADIENT_PRESETS[0].value;
        store.updateSettings({ background: { ...bgConfig, type: 'gradient', value: val } });
        renderDrawerContent();
      }),
      renderRadioCard('Image', bgConfig.type === 'image', () => {
        const activeId = bgConfig.activeId || (bgConfig.wallpapers?.[0]?.id) || 'bundled:misty-forest';
        store.updateSettings({ background: { ...bgConfig, type: 'image', activeId } });
        renderDrawerContent();
      })
    )
  );

  // Specific Background Customizers
  const bgDetailGroup = el('div', { className: 'setting-item' });

  if (bgConfig.type === 'solid') {
    const currentColor = typeof bgConfig.value === 'string' && validateSolidColor(bgConfig.value) ? bgConfig.value : '#1e293b';

    const colorPickerInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: currentColor,
      style: { width: '32px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }
    }));

    const hexInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'form-input',
      value: currentColor,
      placeholder: '#1e293b',
      style: { width: '100px', height: '32px', fontSize: '12px' }
    }));

    const updateColor = (val) => {
      const valid = validateSolidColor(val);
      if (valid) {
        colorPickerInput.value = valid;
        hexInput.value = valid;
        store.updateSettings({ background: { ...bgConfig, value: valid } });
      }
    };

    colorPickerInput.addEventListener('input', () => updateColor(colorPickerInput.value));
    hexInput.addEventListener('change', () => updateColor(hexInput.value));

    const pickerRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [
      colorPickerInput,
      hexInput,
      el('span', { className: 'setting-desc', text: 'Custom solid hex' })
    ]);

    const presetPills = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    for (const preset of SOLID_PRESETS) {
      const pBtn = el('button', {
        className: 'btn-secondary',
        style: { fontSize: '11px', padding: '4px 8px' },
        type: 'button',
        text: preset.name,
        onclick: () => updateColor(preset.value)
      });
      presetPills.appendChild(pBtn);
    }

    bgDetailGroup.appendChild(pickerRow);
    bgDetailGroup.appendChild(el('span', { className: 'setting-desc', text: 'Quick presets:' }));
    bgDetailGroup.appendChild(presetPills);
  } else if (bgConfig.type === 'gradient') {
    let gradConfig = { from: '#0f172a', to: '#1e293b', angle: 135 };
    if (typeof bgConfig.value === 'object' && bgConfig.value !== null) {
      const validated = validateGradientConfig(bgConfig.value);
      if (validated) gradConfig = validated;
    }

    const previewBar = el('div', {
      style: {
        height: '24px',
        borderRadius: 'var(--radius-xs)',
        background: formatGradientCss(gradConfig),
        marginBottom: '10px',
        border: '1px solid var(--border-subtle)'
      }
    });

    const updateGrad = (newConf) => {
      const valid = validateGradientConfig(newConf);
      if (valid) {
        gradConfig = valid;
        previewBar.style.background = formatGradientCss(valid);
        store.updateSettings({ background: { ...bgConfig, value: valid } });
      }
    };

    // Color stop 1
    const fromColor = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: gradConfig.from,
      style: { width: '28px', height: '28px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }
    }));
    const fromHex = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'form-input',
      value: gradConfig.from,
      style: { width: '80px', height: '28px', fontSize: '11px' }
    }));
    fromColor.addEventListener('input', () => {
      fromHex.value = fromColor.value;
      updateGrad({ ...gradConfig, from: fromColor.value });
    });
    fromHex.addEventListener('change', () => {
      const v = validateSolidColor(fromHex.value);
      if (v) {
        fromColor.value = v;
        updateGrad({ ...gradConfig, from: v });
      }
    });

    // Color stop 2
    const toColor = /** @type {HTMLInputElement} */ (el('input', {
      type: 'color',
      value: gradConfig.to,
      style: { width: '28px', height: '28px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }
    }));
    const toHex = /** @type {HTMLInputElement} */ (el('input', {
      type: 'text',
      className: 'form-input',
      value: gradConfig.to,
      style: { width: '80px', height: '28px', fontSize: '11px' }
    }));
    toColor.addEventListener('input', () => {
      toHex.value = toColor.value;
      updateGrad({ ...gradConfig, to: toColor.value });
    });
    toHex.addEventListener('change', () => {
      const v = validateSolidColor(toHex.value);
      if (v) {
        toColor.value = v;
        updateGrad({ ...gradConfig, to: v });
      }
    });

    // Angle slider
    const angleSpan = el('span', { text: `${gradConfig.angle}°`, style: { fontSize: '12px' } });
    const angleSlider = /** @type {HTMLInputElement} */ (el('input', {
      type: 'range',
      min: '0',
      max: '360',
      step: '5',
      value: String(gradConfig.angle),
      style: { width: '100%' }
    }));
    angleSlider.addEventListener('input', () => {
      const a = parseInt(angleSlider.value, 10);
      angleSpan.textContent = `${a}°`;
      updateGrad({ ...gradConfig, angle: a });
    });

    const stopsRow = el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' } }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
        el('span', { className: 'setting-desc', text: 'From:' }),
        fromColor,
        fromHex
      ]),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
        el('span', { className: 'setting-desc', text: 'To:' }),
        toColor,
        toHex
      ])
    ]);

    const angleRow = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
        el('span', { className: 'setting-desc', text: 'Angle' }),
        angleSpan
      ]),
      angleSlider
    ]);

    const gradPills = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    for (const preset of GRADIENT_PRESETS) {
      const gBtn = el('button', {
        className: 'btn-secondary',
        style: { fontSize: '11px', padding: '4px 8px' },
        type: 'button',
        text: preset.name,
        onclick: () => {
          store.updateSettings({ background: { ...bgConfig, value: preset.value } });
          renderDrawerContent();
        }
      });
      gradPills.appendChild(gBtn);
    }

    bgDetailGroup.appendChild(previewBar);
    bgDetailGroup.appendChild(stopsRow);
    bgDetailGroup.appendChild(angleRow);
    bgDetailGroup.appendChild(el('span', { className: 'setting-desc', text: 'Quick presets:' }));
    bgDetailGroup.appendChild(gradPills);
  } else if (bgConfig.type === 'image') {
    const curActiveId = bgConfig.activeId || '';
    const presetsSection = el('div', { style: { marginBottom: '14px' } }, [
      el('span', { className: 'setting-desc', text: 'Curated Presets', style: { display: 'block', marginBottom: '6px', fontWeight: '500' } })
    ]);
    const presetsGrid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } });
    BUNDLED_WALLPAPERS.forEach((wp) => {
      const isWpActive = curActiveId === wp.id;
      const card = el('button', {
        type: 'button',
        className: 'btn-secondary',
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '6px',
          borderRadius: '8px',
          border: isWpActive ? '2px solid var(--accent-base)' : '1px solid var(--border-subtle)',
          background: isWpActive ? 'var(--accent-tint)' : 'var(--bg-surface-subtle)',
          cursor: 'pointer',
          textAlign: 'center'
        },
        onclick: () => {
          store.updateSettings({
            background: {
              ...bgConfig,
              type: 'image',
              activeId: wp.id,
              dayId: null,
              nightId: null,
              rotation: 'off',
              autoReadability: true
            }
          });
          renderDrawerContent();
        }
      });
      const assetUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
        ? chrome.runtime.getURL(`assets/wallpapers/${wp.file}`)
        : `assets/wallpapers/${wp.file}`;
      const img = el('img', {
        src: assetUrl,
        alt: wp.name,
        style: { width: '100%', height: '48px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }
      });
      card.appendChild(img);
      card.appendChild(el('span', { text: wp.name, style: { fontSize: '11px', color: 'var(--text-primary)' } }));
      presetsGrid.appendChild(card);
    });
    presetsSection.appendChild(presetsGrid);
    bgDetailGroup.appendChild(presetsSection);

    const libraryContainer = el('div', { className: 'wallpaper-library-container' });
    renderWallpaperLibrary(libraryContainer, store, {
      onRefresh: () => renderDrawerContent()
    });
    bgDetailGroup.appendChild(libraryContainer);

    // Auto-readability toggle
    const autoReadability = bgConfig.autoReadability !== false;
    const autoToggleLabel = el('label', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer', fontSize: '12px' }
    });
    const autoCheckbox = /** @type {HTMLInputElement} */ (el('input', {
      type: 'checkbox',
      checked: autoReadability
    }));
    autoCheckbox.addEventListener('change', () => {
      store.updateSettings({
        background: { ...bgConfig, autoReadability: autoCheckbox.checked }
      });
      renderDrawerContent();
    });
    autoToggleLabel.appendChild(autoCheckbox);
    autoToggleLabel.appendChild(el('span', { text: 'Auto-readability (adjusts dim from wallpaper brightness)' }));
    bgDetailGroup.appendChild(autoToggleLabel);

    // Dimming overlay slider
    const dimValue = typeof bgConfig.dim === 'number' ? bgConfig.dim : 0.35;
    const dimLabelText = autoReadability ? `Auto (${Math.round(dimValue * 100)}%)` : `${Math.round(dimValue * 100)}%`;
    const dimPercentSpan = el('span', { text: dimLabelText, style: { fontSize: '12px' } });

    const slider = /** @type {HTMLInputElement} */ (el('input', {
      type: 'range',
      min: '0',
      max: '0.8',
      step: '0.05',
      value: String(dimValue),
      style: { width: '100%' }
    }));

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      dimPercentSpan.textContent = `${Math.round(val * 100)}%`;
      store.updateSettings({ background: { ...bgConfig, autoReadability: false, dim: val } });
    });

    const sliderRow = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { className: 'setting-desc', text: 'Dimming Overlay (preserves contrast)' }),
        dimPercentSpan
      ),
      slider
    );

    // Blur slider (0..20px)
    const blurValue = typeof bgConfig.blur === 'number' ? bgConfig.blur : 0;
    const blurPxSpan = el('span', { text: `${blurValue}px`, style: { fontSize: '12px' } });
    const blurSlider = /** @type {HTMLInputElement} */ (el('input', {
      type: 'range',
      min: '0',
      max: '20',
      step: '1',
      value: String(blurValue),
      style: { width: '100%' }
    }));
    blurSlider.addEventListener('input', () => {
      const val = parseInt(blurSlider.value, 10);
      blurPxSpan.textContent = `${val}px`;
      store.updateSettings({ background: { ...bgConfig, blur: val } });
    });
    const blurRow = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { className: 'setting-desc', text: 'Wallpaper Blur' }),
        blurPxSpan
      ),
      blurSlider
    );

    bgDetailGroup.appendChild(sliderRow);
    bgDetailGroup.appendChild(blurRow);

    // Rotation mode (Off, Every Tab, Hourly, Daily)
    const rotationModes = [
      { id: 'off', label: 'Off' },
      { id: 'tab', label: 'Every Tab' },
      { id: 'hourly', label: 'Hourly' },
      { id: 'daily', label: 'Daily' }
    ];
    const currentRotation = bgConfig.rotation || 'off';
    const rotContainer = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' } });
    rotContainer.appendChild(el('span', { className: 'setting-desc', text: 'Wallpaper Rotation' }));
    const rotPills = el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(4, 1fr)' } });
    for (const m of rotationModes) {
      rotPills.appendChild(renderRadioCard(m.label, currentRotation === m.id, () => {
        store.updateSettings({ background: { ...bgConfig, rotation: m.id } });
        renderDrawerContent();
      }));
    }
    rotContainer.appendChild(rotPills);
    bgDetailGroup.appendChild(rotContainer);

    const clearImgBtn = el('button', {
      className: 'btn-secondary btn-danger btn-sm',
      style: { marginTop: '12px' },
      type: 'button',
      text: 'Clear Wallpaper Image',
      onclick: () => {
        store.updateSettings({ background: { ...bgConfig, type: 'none', activeId: null } });
        showToast('Wallpaper cleared');
        renderDrawerContent();
      }
    });

    bgDetailGroup.appendChild(clearImgBtn);
  }

  section.appendChild(bgTypeGroup);
  if (bgConfig.type !== 'none') {
    section.appendChild(bgDetailGroup);
  }

  // 6.2 Typography: Font Family & Text Scale
  const fontConf = settings.font || { family: 'system', scale: 1.0 };
  const currentFamily = fontConf.family === 'sans' ? 'system' : (fontConf.family || 'system');
  const fontFamilyGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Font Family' }),
      el('span', { className: 'setting-desc', text: 'System-native fonts only, no remote webfonts' })
    ),
    el('div', { className: 'radio-group-cards', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
      renderRadioCard('System Sans', currentFamily === 'system', () => {
        store.updateSettings({ font: { ...fontConf, family: 'system' } });
        renderDrawerContent();
      }),
      renderRadioCard('Serif', currentFamily === 'serif', () => {
        store.updateSettings({ font: { ...fontConf, family: 'serif' } });
        renderDrawerContent();
      }),
      renderRadioCard('Monospace', currentFamily === 'mono', () => {
        store.updateSettings({ font: { ...fontConf, family: 'mono' } });
        renderDrawerContent();
      })
    )
  );

  const currentScale = typeof fontConf.scale === 'number' ? fontConf.scale : 1.0;
  const scalePercentSpan = el('span', { text: `${Math.round(currentScale * 100)}%`, style: { fontSize: '12px' } });
  const scaleSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '0.9',
    max: '1.3',
    step: '0.05',
    value: String(currentScale),
    style: { width: '100%' }
  }));
  scaleSlider.addEventListener('input', () => {
    const val = Math.round(parseFloat(scaleSlider.value) * 100) / 100;
    scalePercentSpan.textContent = `${Math.round(val * 100)}%`;
    store.updateSettings({ font: { ...fontConf, scale: val } });
  });

  const fontScaleGroup = el('div', { className: 'setting-item' },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
      el('span', { className: 'setting-label', text: 'Text Size Scale' }),
      scalePercentSpan
    ),
    scaleSlider
  );

  // 15.5 Glass v2 Material Settings (Blur & Opacity)
  const glassConf = settings.glass || { blur: 16, opacity: 0.62 };
  const currentBlur = typeof glassConf.blur === 'number' ? glassConf.blur : 16;
  const currentGlassOpacity = typeof glassConf.opacity === 'number' ? glassConf.opacity : 0.62;

  const blurValSpan = el('span', { text: `${currentBlur}px`, style: { fontSize: '12px' } });
  const blurSlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '8',
    max: '24',
    step: '1',
    value: String(currentBlur),
    style: { width: '100%' }
  }));
  blurSlider.addEventListener('input', () => {
    const val = parseInt(blurSlider.value, 10);
    blurValSpan.textContent = `${val}px`;
    store.updateSettings({ glass: { ...(settings.glass || {}), blur: val } });
  });

  const opacityValSpan = el('span', { text: `${Math.round(currentGlassOpacity * 100)}%`, style: { fontSize: '12px' } });
  const opacitySlider = /** @type {HTMLInputElement} */ (el('input', {
    type: 'range',
    min: '0.45',
    max: '0.90',
    step: '0.01',
    value: String(currentGlassOpacity),
    style: { width: '100%' }
  }));
  opacitySlider.addEventListener('input', () => {
    const val = Math.round(parseFloat(opacitySlider.value) * 100) / 100;
    opacityValSpan.textContent = `${Math.round(val * 100)}%`;
    store.updateSettings({ glass: { ...(settings.glass || {}), opacity: val } });
  });

  const glassGroup = el('div', { className: 'setting-item' },
    el('div', { className: 'setting-item-header' },
      el('span', { className: 'setting-label', text: 'Frosted Glass Surface' }),
      el('span', { className: 'setting-desc', text: 'Calm Glass v2 translucency & backdrop blur' })
    ),
    el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { className: 'setting-desc', text: 'Glass Opacity (45% – 90%)' }),
        opacityValSpan
      ),
      opacitySlider
    ),
    el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { className: 'setting-desc', text: 'Backdrop Blur (8px – 24px)' }),
        blurValSpan
      ),
      blurSlider
    )
  );

  section.appendChild(fontFamilyGroup);
  section.appendChild(fontScaleGroup);
  section.appendChild(glassGroup);

  section.appendChild(el('button', {
    className: 'btn-secondary section-reset-btn',
    type: 'button',
    text: 'Reset Appearance to Defaults',
    onclick: () => resetSettingsSection('appearance')
  }));

  return section;
}
