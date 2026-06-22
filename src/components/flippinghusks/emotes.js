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

// ── Centralized Soundboard audio ────────────────────────────────────────────────
// The clips vary a lot in loudness. Rather than hand-tuning each file, every clip is
// routed through ONE shared Web Audio graph so they all come out at a consistent
// level: a DynamicsCompressor acts as an automatic leveller (pulls loud clips down
// toward a ceiling) and a master GainNode applies makeup gain — together they bring
// quiet and loud clips much closer in perceived volume. The master gain is also the
// single place to set the overall Soundboard volume.
export const SOUNDBOARD_VOLUME = 0.93; // master makeup gain (the one volume knob)

// Hard cap on how long any clip may play — longer clips are cut off at this mark.
export const SOUNDBOARD_MAX_MS = 8000;

let audioCtx = null;
let entryNode = null; // graph input — the compressor every clip connects into

// Lazily build (once) the shared compressor → master-gain → speakers chain.
function audioGraph() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null; // Web Audio unsupported → caller falls back to plain playback
  if (!audioCtx) {
    audioCtx = new Ctx();
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -30; // catch more of the signal so loud clips are tamed earlier
    comp.knee.value = 18;       // tighter knee → firmer onset of compression
    comp.ratio.value = 20;      // near-limiting → strong clips are softened hard
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const master = audioCtx.createGain();
    master.gain.value = SOUNDBOARD_VOLUME;
    comp.connect(master).connect(audioCtx.destination);
    entryNode = comp;
  }
  return audioCtx;
}

// Play a clip from its (server-chosen) URL through the leveling graph. Returns the
// Audio element so the player who triggered it can listen for 'ended' (to release the
// room's single-sound lock); returns null when there's no URL.
export function playSoundUrl(url) {
  if (!url) return null;
  const audio = new Audio(url);
  const ctx = audioGraph();
  if (ctx) {
    // Browsers start the context suspended; resume it (allowed once the user has
    // interacted with the page, which they have by the time a game is running).
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      // Routing the element into the graph captures its output, so the compressor +
      // master gain — not the raw file level — determine how loud it actually plays.
      ctx.createMediaElementSource(audio).connect(entryNode);
    } catch {
      // If routing fails the element still plays on its own (just unleveled).
    }
  }
  // Force-stop at the max duration so no clip can run longer than the cap. We fire a
  // synthetic 'ended' so listeners (e.g. the room's single-sound lock, which waits
  // for 'ended') still release. A natural finish clears the timer first.
  const cap = setTimeout(() => {
    audio.pause();
    audio.dispatchEvent(new Event('ended'));
  }, SOUNDBOARD_MAX_MS);
  audio.addEventListener('ended', () => clearTimeout(cap), { once: true });
  audio.play().catch(() => {});
  return audio;
}
