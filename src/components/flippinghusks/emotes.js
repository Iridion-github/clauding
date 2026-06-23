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

// ── Single reusable player ──────────────────────────────────────────────────────
// All clips play through ONE persistent <audio> element wired into the leveling graph
// via ONE MediaElementAudioSourceNode. This is deliberate: a MediaElementSourceNode
// can be created only once per element, and creating/disconnecting a fresh node for
// every clip (especially stopping a long clip mid-play and immediately starting
// another) makes Chrome's Web Audio drop playback — the new clip just stays silent.
// Reusing one element + node sidesteps all of that: switching clips is only a pause +
// new src, with no graph surgery.
let player = null;     // the shared HTMLAudioElement
let playerCap = null;  // the current clip's max-duration timer
let playerGen = 0;     // bumped on every play/stop; guards stale 'ended'/cap callbacks
let onClipEnded = null; // callback for the CURRENT clip (e.g. release the room lock)

function ensurePlayer() {
  if (player) return player;
  player = new Audio();
  const ctx = audioGraph();
  if (ctx) {
    try {
      // Route the element through the compressor + master gain so the file's raw
      // level doesn't determine loudness. Done once, for the element's whole life.
      ctx.createMediaElementSource(player).connect(entryNode);
    } catch {
      // Routing failed → the element still plays on its own (just unleveled).
    }
  }
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

// Play a clip from its (server-chosen) URL through the leveling graph. `onEnded` (if
// given) fires when the clip finishes naturally or hits the duration cap — the room's
// initiator uses it to release the single-sound lock. Any clip already playing is
// replaced silently.
export function playSoundUrl(url, onEnded) {
  if (!url) return;
  const audio = ensurePlayer();
  const ctx = audioGraph();
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

  // The element plays ONLY through the graph once routed, so a suspended context =
  // silence. Browsers auto-suspend the context when the tab is backgrounded or idle,
  // so resume it and only THEN start — otherwise short clips finish before the async
  // resume lands and nothing is heard.
  const start = () => { audio.play().catch(() => {}); };
  if (ctx && ctx.state === 'suspended') ctx.resume().then(start, start);
  else start();
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
