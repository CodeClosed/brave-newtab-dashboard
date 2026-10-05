// @ts-check

/**
 * 4.5 Five curated theme presets.
 */
export const THEME_PRESETS = [
  {
    id: 'default',
    name: 'Default',
    description: 'Calm, neutral system styling with soft slate accents.',
    settings: {
      theme: 'system',
      palette: 'default',
      accent: 'slate',
      accentCustom: null,
      cards: {
        style: 'filled',
        translucent: false,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: { type: 'none', value: null, dim: 0.35 }
    }
  },
  {
    id: 'warm-paper',
    name: 'Warm paper',
    description: 'Gentle light paper surfaces with warm amber accents.',
    settings: {
      theme: 'light',
      palette: 'paper',
      accent: 'amber',
      accentCustom: null,
      cards: {
        style: 'minimal',
        translucent: false,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: { type: 'none', value: null, dim: 0.35 }
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep woodland dark tones with frosted glass and emerald accents.',
    settings: {
      theme: 'dark',
      palette: 'default',
      accent: 'emerald',
      accentCustom: null,
      cards: {
        style: 'frosted',
        translucent: true,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: { type: 'solid', value: '#142219', dim: 0.35 }
    }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'True pure-black AMOLED contrast with crisp outline cards and blue accents.',
    settings: {
      theme: 'dark',
      palette: 'amoled',
      accent: 'blue',
      accentCustom: null,
      cards: {
        style: 'outline',
        translucent: false,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: { type: 'solid', value: '#0a0f18', dim: 0.35 }
    }
  },
  {
    id: 'high-contrast',
    name: 'High contrast',
    description: 'Maximum legibility and crisp outline borders targeting WCAG AAA.',
    settings: {
      theme: 'dark',
      palette: 'contrast',
      accent: 'rose',
      accentCustom: null,
      cards: {
        style: 'outline',
        translucent: false,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: { type: 'none', value: null, dim: 0.35 }
    }
  }
];

/**
 * 15.4 Three Glass Theme Presets bundling wallpaper, accent, hero layout and dock.
 */
export const GLASS_PRESETS = [
  {
    id: 'glass-ember',
    name: 'Ember Wave',
    description: 'Vibrant fluid waves, warm amber accents, studio hero, and frosted top dock.',
    settings: {
      theme: 'dark',
      palette: 'default',
      accent: 'amber',
      accentCustom: null,
      cards: {
        style: 'glass',
        translucent: true,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: {
        type: 'image',
        activeId: 'bundled:warm-fluid-wave',
        value: null,
        dim: 0.35,
        blur: 0,
        autoReadability: true
      },
      hero: { layout: 'studio' },
      dock: { position: 'top' }
    }
  },
  {
    id: 'glass-dusk',
    name: 'Violet Dusk',
    description: 'Twilight purple atmosphere, rose accents, studio hero, and frosted bottom dock.',
    settings: {
      theme: 'dark',
      palette: 'default',
      accent: 'rose',
      accentCustom: null,
      cards: {
        style: 'glass',
        translucent: true,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: {
        type: 'image',
        activeId: 'bundled:violet-dusk',
        value: null,
        dim: 0.35,
        blur: 0,
        autoReadability: true
      },
      hero: { layout: 'studio' },
      dock: { position: 'bottom' }
    }
  },
  {
    id: 'glass-forest',
    name: 'Misty Forest',
    description: 'Atmospheric emerald pine, emerald accents, centered hero, and frosted left dock.',
    settings: {
      theme: 'dark',
      palette: 'default',
      accent: 'emerald',
      accentCustom: null,
      cards: {
        style: 'glass',
        translucent: true,
        columns: 'auto',
        width: 340,
        gap: 16,
        align: 'center',
        equalHeight: true,
        verticalCenter: false
      },
      background: {
        type: 'image',
        activeId: 'bundled:misty-forest',
        value: null,
        dim: 0.35,
        blur: 0,
        autoReadability: true
      },
      hero: { layout: 'centered' },
      dock: { position: 'left' }
    }
  }
];

/**
 * Validates a preset structure to ensure it conforms to safety rules.
 * @param {any} preset
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePreset(preset) {
  if (!preset || typeof preset !== 'object') {
    return { valid: false, error: 'Preset must be an object' };
  }
  if (!preset.name || typeof preset.name !== 'string') {
    return { valid: false, error: 'Preset must have a valid name' };
  }
  if (!preset.settings || typeof preset.settings !== 'object') {
    return { valid: false, error: 'Preset must contain a settings object' };
  }

  const s = preset.settings;
  const validThemes = ['system', 'light', 'dark'];
  if (s.theme && !validThemes.includes(s.theme)) {
    return { valid: false, error: `Invalid theme "${s.theme}"` };
  }

  const validPalettes = ['default', 'amoled', 'paper', 'contrast'];
  if (s.palette && !validPalettes.includes(s.palette)) {
    return { valid: false, error: `Invalid palette "${s.palette}"` };
  }

  const validAccents = ['slate', 'blue', 'emerald', 'amber', 'rose', 'custom'];
  if (s.accent && !validAccents.includes(s.accent)) {
    return { valid: false, error: `Invalid accent "${s.accent}"` };
  }

  if (s.background && typeof s.background === 'object') {
    const rawVal = typeof s.background.value === 'string' ? s.background.value : '';
    if (rawVal.toLowerCase().includes('url(')) {
      return { valid: false, error: 'Background must not contain url()' };
    }
  }

  return { valid: true };
}

/**
 * Applies a curated theme preset by ID or object.
 * Returns an undo function that restores previous appearance settings.
 *
 * @param {string} presetId
 * @param {any} storeInstance
 * @returns {{ success: boolean, preset?: any, undo?: Function }}
 */
export function applyThemePreset(presetId, storeInstance) {
  const allPresets = [...THEME_PRESETS, ...GLASS_PRESETS];
  const preset = allPresets.find(p => p.id === presetId || p.name.toLowerCase() === presetId.toLowerCase());
  if (!preset) {
    return { success: false };
  }

  const current = storeInstance.get().settings;
  const previousSettings = {
    theme: current.theme,
    palette: current.palette,
    accent: current.accent,
    accentCustom: current.accentCustom,
    cards: JSON.parse(JSON.stringify(current.cards || {})),
    background: JSON.parse(JSON.stringify(current.background || { type: 'none' })),
    hero: JSON.parse(JSON.stringify(current.hero || {})),
    dock: JSON.parse(JSON.stringify(current.dock || {}))
  };

  const patch = {
    theme: preset.settings.theme,
    palette: preset.settings.palette,
    accent: preset.settings.accent,
    accentCustom: preset.settings.accentCustom,
    cards: {
      ...(current.cards || {}),
      ...preset.settings.cards
    },
    background: {
      ...(current.background || {}),
      ...preset.settings.background
    }
  };
  if (preset.settings.hero) {
    patch.hero = { ...(current.hero || {}), ...preset.settings.hero };
  }
  if (preset.settings.dock) {
    patch.dock = { ...(current.dock || {}), ...preset.settings.dock };
  }

  storeInstance.updateSettings(patch);

  const undo = () => {
    storeInstance.updateSettings(previousSettings);
  };

  return { success: true, preset, undo };
}

/**
 * Exports a preset to a formatted JSON string.
 * @param {string} presetId
 * @returns {string}
 */
export function exportPresetToJson(presetId) {
  const allPresets = [...THEME_PRESETS, ...GLASS_PRESETS];
  const preset = allPresets.find(p => p.id === presetId);
  if (!preset) return '';
  return JSON.stringify({
    type: 'ntd:theme_preset',
    version: 1,
    name: preset.name,
    description: preset.description,
    settings: preset.settings
  }, null, 2);
}

/**
 * Parses and validates an imported preset JSON string.
 * @param {string} jsonStr
 * @returns {{ success: boolean, preset?: any, error?: string }}
 */
export function importPresetFromJson(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    const validation = validatePreset(parsed);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    return {
      success: true,
      preset: {
        id: 'imported_' + Date.now(),
        name: parsed.name,
        description: parsed.description || 'Imported theme preset',
        settings: parsed.settings
      }
    };
  } catch (err) {
    return { success: false, error: 'Invalid JSON format' };
  }
}
