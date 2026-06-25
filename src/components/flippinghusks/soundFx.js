// Short one-shot game sound effects. Each effect reuses ONE preloaded <audio> element, so
// the first play never stutters (the file is fetched up-front via preloadFx) and we don't
// churn a fresh element on every play. Effects never overlap in normal play, so a single
// reused element per effect is safe. (The Soundboard's longer clips have their own
// single-element player in emotes.js; background music is a separate looping track.)
const FX_SRC = {
  cardFlip:               '/sounds/card-flipping.mp3',
  busted:                 '/sounds/busted.mp3',
  freeze:                 '/sounds/freeze.mp3',
  flipThree:              '/sounds/triple.mp3',
  secondChance:           '/sounds/2nd-chance.mp3',
  secondChanceActivation: '/sounds/2nd-chance-activation.mp3',
  flipped7:               '/sounds/7-unique-numbers.mp3',
  shuffle:                '/sounds/shuffle.mp3',
  victory:                '/sounds/victory.mp3',
  stay:                   '/sounds/chicken.mp3',
};

const cache = {};

function elFor(name) {
  if (cache[name]) return cache[name];
  const src = FX_SRC[name];
  if (!src) return null;
  const a = new Audio(src);
  a.preload = 'auto';
  cache[name] = a;
  return a;
}

// Fetch + decode every effect once, ahead of time (call when the game app mounts) so the
// first time each is needed it plays instantly.
export function preloadFx() {
  for (const name of Object.keys(FX_SRC)) {
    const a = elFor(name);
    try { a.load(); } catch { /* ignore */ }
  }
}

// Play an effect from its start, reusing its cached (preloaded) element.
export function playFx(name) {
  const a = elFor(name);
  if (!a) return;
  try { a.currentTime = 0; } catch { /* ignore */ }
  a.play().catch(() => {});
}
