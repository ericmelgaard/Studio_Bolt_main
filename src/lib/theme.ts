export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-mode';

// Pages that don't have dark styles yet turn this off so they always render light
let darkAllowed = true;

export function getSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Storage can be unavailable (private mode); fall back to the device setting
  }
  return 'system';
}

export function applyTheme(mode: ThemeMode) {
  const isDark =
    darkAllowed &&
    (mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));

  document.documentElement.classList.toggle('dark', isDark);

  // Matches the page background: gray-900 / white
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#111827' : '#ffffff');
}

export function setTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not persisted; still applies for this session
  }
  applyTheme(mode);
}

export function setDarkAllowed(allowed: boolean) {
  darkAllowed = allowed;
  applyTheme(getSavedTheme());
}
