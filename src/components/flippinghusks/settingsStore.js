// Persistence + defaults for the player's local settings (background music, theme…).
// Kept separate from Settings.jsx so non-UI modules (e.g. the card-theme context)
// can read settings without pulling in the React component — avoids import cycles.

const STORAGE_KEY = 'fh_settings';

export const DEFAULT_SETTINGS = {
  backgroundMusic: true,
  musicTrack: 'default',
  theme: 'default',
  animationSpeed: 'default',
};

// Animation speed presets, in slider order. `factor` multiplies every game
// animation's duration: Faster is half of Default, Fastest is half of Faster.
export const ANIMATION_SPEEDS = [
  { value: 'default', label: 'Default', factor: 1 },
  { value: 'faster',  label: 'Faster',  factor: 0.5 },
  { value: 'fastest', label: 'Fastest', factor: 0.25 },
];

// Duration multiplier for the given speed (falls back to Default / 1×).
export function animationFactorFor(speed) {
  return (ANIMATION_SPEEDS.find(s => s.value === speed) ?? ANIMATION_SPEEDS[0]).factor;
}

// The factor for the currently-saved setting — read fresh so animation
// components always pick up the latest choice the moment they mount.
export function currentAnimationFactor() {
  return animationFactorFor(loadSettings().animationSpeed);
}

// Publish the speed as a CSS custom property on <html> so every game animation's
// CSS duration (written as calc(<base> * var(--fh-anim-speed))) scales in lockstep
// with the JS timeouts. Called at app start and whenever Settings are saved.
export function applyAnimationSpeed(speed) {
  document.documentElement.style.setProperty('--fh-anim-speed', String(animationFactorFor(speed)));
}

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

// Card theme → full-screen background image in public/images/<theme>/.
// Each theme owns its own backdrop; ClassicFantasy's file will be added later, so
// until it exists that theme simply falls back to the base colour behind the image.
const BACKGROUND_FILES = {
  default: '/images/default/bg.png',
  classic_fantasy: '/images/ClassicFantasy/bg.png',
};

// Public URL of the background image for a theme (falls back to the default theme).
export function backgroundSrcFor(theme) {
  return BACKGROUND_FILES[theme] ?? BACKGROUND_FILES.default;
}

// Publish the theme's background as a CSS custom property on <html>. Interfaces
// paint it via `background-image: var(--fh-bg-image)` together with `cover`/`center`,
// so the single image scales to fit any client resolution and aspect ratio.
// Called at app start and whenever the theme is saved.
export function applyBackground(theme) {
  document.documentElement.style.setProperty('--fh-bg-image', `url("${backgroundSrcFor(theme)}")`);
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
