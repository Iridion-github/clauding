// Persistence + defaults for the player's local settings (background music, theme…).
// Kept separate from Settings.jsx so non-UI modules (e.g. the card-theme context)
// can read settings without pulling in the React component — avoids import cycles.

const STORAGE_KEY = 'fh_settings';

export const DEFAULT_SETTINGS = {
  backgroundMusic: true,
  musicTrack: 'default',
  theme: 'default',
};

// Read persisted settings, falling back to defaults for anything missing/corrupt.
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
