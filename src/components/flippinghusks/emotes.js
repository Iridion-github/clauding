// Shared Soundboard definitions used by both the in-game Soundboard panel and the
// socket hook (playing the clip URL the server broadcasts to the room).
//
// Each button has a colour + an icon glyph and maps to a folder under
// public/sounds/soundboard/<key>/, from which the SERVER picks a random clip when
// the button is pressed (so everyone in the room hears the same one).
export const EMOTES = [
  { key: 'anger',   label: 'Anger',   icon: '💢', color: '#d32f2f' }, // Red — temple pulsing vein
  { key: 'mockery', label: 'Mockery', icon: '😛', color: '#f5c518' }, // Yellow — Bronx cheer
  { key: 'jingle',  label: 'Jingle',  icon: '🎵', color: '#1976d2' }, // Blue — musical note
];

// SP it costs to play one sound (must match SOUND_COST on the server).
export const SOUND_COST = 10;

// ── Soundboard audio playback ─────────────────────────────────────────────────────
// Clips play through ONE persistent <audio> element that we re-point at each new clip.
// Reusing a single element (instead of a fresh Audio() per press) makes stopping a clip
// and immediately starting another reliable, and guarantees two clips never overlap.
// Loudness is NOT processed here — clips play at their file level, so the source mp3s
// should be normalized so none are extreme.

// Hard cap on how long any clip may play — longer clips are cut off at this mark.
export const SOUNDBOARD_MAX_MS = 8000;

let player = null;      // the shared HTMLAudioElement
let playerCap = null;   // the current clip's max-duration timer
let playerGen = 0;      // bumped on every play/stop; guards stale 'ended'/cap callbacks
let onClipEnded = null; // callback for the CURRENT clip (e.g. release the room lock)

function ensurePlayer() {
  if (player) return player;
  player = new Audio();
  // Natural finish: fire the current clip's end callback (guarded by generation so a
  // late event from a clip we already replaced/stopped can't fire the wrong one).
  player.addEventListener('ended', () => finishClip(playerGen));
  return player;
}

// End the current clip exactly once: clear its cap timer and invoke (then forget) its
// end callback — but only if `gen` still matches the clip in flight.
function finishClip(gen) {
  if (gen !== playerGen) return;
  if (playerCap) { clearTimeout(playerCap); playerCap = null; }
  const cb = onClipEnded;
  onClipEnded = null;
  if (cb) cb();
}

// Play a clip from its (server-chosen) URL. `onEnded` (if given) fires when the clip
// finishes naturally or hits the duration cap — the room's initiator uses it to release
// the single-sound lock. Any clip already playing is replaced.
export function playSoundUrl(url, onEnded) {
  if (!url) return;
  const audio = ensurePlayer();
  const gen = ++playerGen; // invalidate any pending events from the previous clip
  if (playerCap) { clearTimeout(playerCap); playerCap = null; }
  onClipEnded = onEnded || null;

  try { audio.pause(); } catch {}
  audio.src = url;
  try { audio.currentTime = 0; } catch {}

  // Force-stop at the max duration so no clip can run longer than the cap, then end
  // the clip (which releases the lock just like a natural finish).
  playerCap = setTimeout(() => {
    try { audio.pause(); } catch {}
    finishClip(gen);
  }, SOUNDBOARD_MAX_MS);

  audio.play().catch(() => {});
}

// Stop the current clip immediately WITHOUT firing its end callback (the caller — the
// STOP button / lock release — manages the room lock itself). Bumping the generation
// also neutralizes the clip's pending cap timer and 'ended' event.
export function stopSoundAudio() {
  playerGen++;
  onClipEnded = null;
  if (playerCap) { clearTimeout(playerCap); playerCap = null; }
  if (player) { try { player.pause(); player.currentTime = 0; } catch {} }
}
