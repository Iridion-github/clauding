// Persistence + defaults for the player's local settings (background music, theme…).
// Kept separate from Settings.jsx so non-UI modules (e.g. the card-theme context)
// can read settings without pulling in the React component — avoids import cycles.

const STORAGE_KEY = 'fh_settings';

export const DEFAULT_SETTINGS = {
  backgroundMusic: true,
  musicTrack: 'default',
  theme: 'default',
};

// Playback volume for the background music, shared by the in-game audio and the
// settings preview player so they always match.
export const BGM_VOLUME = 0.05;

// Background-music track → audio file in public/music/.
const MUSIC_FILES = {
  default: 'DefaultBgm.mp3',
  classic_fantasy: 'ClassicFantasyBgm.mp3',
};

// Public URL of the audio file for a track (falls back to the default track).
export function musicSrcFor(track) {
  return `/music/${MUSIC_FILES[track] ?? MUSIC_FILES.default}`;
}

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
