/**
 * Zero-FOWT Blocking Theme Script
 * Must run synchronously in <head> before page rendering.
 * Does not rely on ES modules or async chrome.storage.
 */
(function() {
  try {
    var raw = localStorage.getItem('ntd:boot');
    var theme = 'system';
    var accent = 'slate';
    var layout = 'grid';

    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed.theme) theme = parsed.theme;
      if (parsed.accent) accent = parsed.accent;
      if (parsed.layout) layout = parsed.layout;
    }

    var root = document.documentElement;

    // Apply Theme
    var isDark = false;
    if (theme === 'dark') {
      isDark = true;
    } else if (theme === 'light') {
      isDark = false;
    } else {
      // System default
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }

    // Apply Accent & Layout
    root.setAttribute('data-accent', accent);
    root.setAttribute('data-layout', layout);
  } catch (err) {
    // Graceful silent fallback to CSS defaults
  }
})();
