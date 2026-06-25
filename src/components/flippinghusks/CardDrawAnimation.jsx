import { useEffect, useRef, useState } from 'react';
import { FlippingHusksCard } from './FlippingHusksCard';
import { currentAnimationFactor } from './settingsStore';
import './CardDrawAnimation.css';

// Phase timeline (ms):
//   falling    0 – 1200   face-down card falls from top
//   flip-out   1200 – 1400  3D rotateY 0 → 90 (back to edge-on)
//   flip-in    1400 – 1750  3D rotateY 90 → 180 (front swings in)
//   revealed   1750 – 2000  hold at centre (2 s total draw)
//   ── then one of: ──
//   busting    2000 – 4000  impact + shake + stamp (isBust)        → done at 4000
//   sc-show    2000 – 4000  both cards shown (secondChance)        → sc-exit
//   sc-exit    4000 – 5000  both cards slide up                    → done at 5000
//   special    2000 – 3100  flourish for Flip Three                   → done at 3100
//              (Flipped 7 & Freeze linger to 5100 — banner + lines/rays hold ~2s longer)
//   flying     2000 – 2440  glide + shrink into the hand slot      → done at 2440
//              (plain cards only; skipped for bust / SC / specials)

// The card-wrap drives POSITION (fall in, hold centred, bust shake); its flipper
// child drives the 3D Y-rotation. Keeping them on separate elements lets the card
// spin in place while the wrapper stays put — and lets the bust shake in Z while the
// flipper holds the front face. During flip-out/flip-in/revealed the wrap just holds
// the card centred and still.
const WRAP_PHASE_CLASS = {
  falling:    'fhanim-falling',
  'flip-out': 'fhanim-revealed',
  'flip-in':  'fhanim-revealed',
  revealed:   'fhanim-revealed',
  busting:    'fhanim-busting',
  'sc-ascend': 'fhanim-sc-ascend', // holy ascension when a Second Chance card is drawn
};
const FLIP_PHASE_CLASS = {
  'flip-out': 'fhanim-flip-out',  // rotateY 0 → 90 (back rotates to edge-on)
  'flip-in':  'fhanim-flip-in',   // rotateY 90 → 180 (front swings into view)
  revealed:   'fhanim-flipped',   // hold front
  busting:    'fhanim-flipped',
  special:    'fhanim-flipped',   // keep the front showing during the special flourish
  'sc-ascend': 'fhanim-flipped',  // keep the front showing during the holy ascension
  flying:     'fhanim-flipped',   // keep the front showing while it flies to the hand
  // falling / initial frame: no class → flipper rests at rotateY(0), showing the back
};

// How long the card takes to fly from centre into the hand (ms, before the speed
// factor). Must match the CSS transition on .fhanim-flying.
const FLY_MS = 440;

// Drawing a Second Chance card gets a holy/sacred reveal: the card grows a little and
// slowly ascends toward the top of the screen, bathed in a pillar of light from above,
// then is delivered to the hand. Must match the CSS fh-sc-ascend.
const SC_ASCEND_MS = 2400;

// Activating Second Chance (it saves you from a bust): after a brief hold the offending
// card is sliced obliquely in two and the halves fall apart. Must match the CSS fh-sc-cut*.
const SC_CUT_MS = 1000;

// How long the special-reveal flourish (Freeze / Flip Three) holds on screen after the
// reveal (ms, before the speed factor). Must cover the flourish keyframes in the CSS
// (.fhanim-frost / -sweep / banners, all ≤ 1.1s).
const SPECIAL_MS = 1100;
// Flipped 7 is the round-ender, so it lingers a good ~2s longer — its rays keep slowly
// turning and the "FLIPPED 7!" banner stays up. Matches the 3.1s CSS rays / gold-banner.
const FLIPPED7_MS = SPECIAL_MS + 2000;
// Freeze also lingers ~2s longer: after the ice forms, the frozen card, the cracks/aura and
// the "FROZEN!" banner stay on screen. Matches the 3.1s CSS ice-banner timing.
const FREEZE_MS = SPECIAL_MS + 2000;

// Freeze "ice cracks": a dense web of fine, jagged hairline fractures that race out from
// the centre across the whole screen (viewBox 1000×1000, centred on 500,500; they overshoot
// the edges so they reach them on any aspect ratio). Generated once so they're irregular but
// stable. Trunks shoot from centre; branches fork off interior vertices and draw a beat
// later (see .fhanim-crack-branch). Each is drawn on via SVG stroke-dashoffset.
function freezeCrackPath(x, y, angle, { segLen, jitter, reach }) {
  const pts = [[x, y]];
  let px = x, py = y, a = angle, dist = 0;
  while (dist < reach) {
    a += (Math.random() - 0.5) * jitter;            // wobble the heading for irregularity
    const len = segLen * (0.45 + Math.random() * 1.0); // short, uneven segments = jagged
    px += Math.cos(a) * len;
    py += Math.sin(a) * len;
    pts.push([px, py]);
    dist += len;
  }
  return { d: 'M' + pts.map(([qx, qy]) => `${Math.round(qx)},${Math.round(qy)}`).join(' L'), pts };
}

function buildFreezeCracks() {
  const cracks = [];
  const cx = 500, cy = 500;
  const TRUNKS = 40;
  for (let t = 0; t < TRUNKS; t++) {
    const angle = (t / TRUNKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.32;
    const trunk = freezeCrackPath(cx, cy, angle, { segLen: 40, jitter: 0.9, reach: 950 });
    cracks.push({ d: trunk.d, branch: false });
    // 1–2 forks off an interior vertex of this trunk.
    const nBranch = 1 + (Math.random() < 0.65 ? 1 : 0);
    for (let b = 0; b < nBranch && trunk.pts.length > 4; b++) {
      const [bx, by] = trunk.pts[2 + Math.floor(Math.random() * (trunk.pts.length - 3))];
      const outward = Math.atan2(by - cy, bx - cx);
      const branchAngle = outward + (Math.random() < 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.7);
      const fork = freezeCrackPath(bx, by, branchAngle, { segLen: 32, jitter: 1.1, reach: 200 + Math.random() * 260 });
      cracks.push({ d: fork.d, branch: true });
    }
  }
  return cracks;
}

const FREEZE_CRACKS = buildFreezeCracks();

// A thick, irregular frost "aura" hugging the card — NOT a smooth sphere. Many short,
// asymmetric, feathery rime lines packed one near the other around the card's outline,
// each jutting outward a random short distance. Local SVG centred on the card (viewBox
// 480×620); the card sits ~(240,310) with half-extents ~96×136 at the reveal scale.
function buildFrostAura() {
  const lines = [];
  const cx = 240, cy = 310, rx = 96, ry = 136;
  const COUNT = 150;
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const startR = 0.88 + Math.random() * 0.22;          // on / just off the outline (uneven)
    const sx = cx + Math.cos(ang) * rx * startR;
    const sy = cy + Math.sin(ang) * ry * startR;
    let dir = Math.atan2(Math.sin(ang) / ry, Math.cos(ang) / rx); // outward ellipse normal
    dir += (Math.random() - 0.5) * 1.1;                  // heavy jitter → asymmetric fringe
    const reach = 20 + Math.random() * 132;              // ~2× longer → a much larger aura
    lines.push(freezeCrackPath(sx, sy, dir, { segLen: 19, jitter: 1.5, reach }).d);
  }
  return lines;
}
const FROST_AURA = buildFrostAura();

// Work out where the just-revealed card should land: the next free slot in the
// target player's on-screen hand. Returns the centre offset from the viewport centre
// (dx, dy) plus the scale that matches the destination card size, or null if the hand
// can't be found (in which case we just skip the fly). The overlay card is anchored at
// the viewport centre, so dx/dy are simply target-centre minus viewport-centre.
// The just-drawn card is rendered (invisibly) in its REAL hand slot during the fly, so we
// measure that actual element instead of guessing the slot — overlapping layouts made the
// guess land in the wrong place and the card then jumped to its true spot. Returns the slot
// centre offset from the viewport centre (the overlay card is anchored at viewport centre)
// plus the scale that matches the destination card's on-screen width, or null if not found.
function computeFlyTarget(targetId, cardId) {
  if (!targetId || !cardId) return null;
  const esc = (s) => (window.CSS && CSS.escape) ? CSS.escape(String(s)) : s;
  const container = document.querySelector(`[data-fh-hand="${esc(targetId)}"]`);
  const el = container && container.querySelector(`[data-fh-card="${esc(cardId)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0)) return null;

  return {
    dx: r.left + r.width / 2 - window.innerWidth / 2,
    dy: r.top + r.height / 2 - window.innerHeight / 2,
    scale: r.width / 140,
  };
}

export function CardDrawAnimation({ card, isBust, isFlippingHusks, secondChanceCard, targetId = null, onDone }) {
  const [phase, setPhase] = useState('falling');
  const [flyTransform, setFlyTransform] = useState(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // The three "big moment" reveals get a flourish held on screen before we finish.
  // Flipped 7 ends the round; Freeze/Flip Three live in pendingAction (no hand to fly
  // into) — so none of these do the fly-into-hand handoff.
  const specialKind =
    isFlippingHusks              ? 'flipped7'
    : card.type === 'freeze'     ? 'freeze'
    : card.type === 'flip_three' ? 'flip3'
    : null;

  useEffect(() => {
    const audio = new Audio('/sounds/card-flipping.mp3');
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    // Scale every phase timing by the saved speed so the JS timeline stays in sync
    // with the CSS durations (which scale via the --fh-anim-speed variable).
    const f = currentAnimationFactor();
    const after = (ms, fn) => setTimeout(fn, ms * f);

    // onDone must fire exactly once (advanceAnim pops the queue), so guard it: both the
    // fly path and its backstop timeout can race to call it.
    let fired = false;
    const finish = () => { if (fired) return; fired = true; onDoneRef.current(); };

    // Drawing a Second Chance card gets a holy ascension (grows + rises into a pillar of light).
    const scDraw = card.type === 'second_chance' && !secondChanceCard && !isBust;

    // A plain card landing in a hand gets the fly-into-hand handoff. Bust / Second Chance
    // (drawn → pulses first; or activated → two-card display) / specials have their own paths.
    const canFly = !!targetId && !isBust && !secondChanceCard && !specialKind && !scDraw;

    // Glide the card into its hand slot, or just finish if the hand isn't on screen.
    const flyOrFinish = () => {
      const tgt = computeFlyTarget(targetId, card.id);
      if (tgt) {
        setFlyTransform(`translate(calc(-50% + ${tgt.dx}px), calc(-50% + ${tgt.dy}px)) scale(${tgt.scale})`);
        setPhase('flying');
      } else {
        finish(); // hand not found on screen → just reveal it
      }
    };

    const t = [
      after(1200, () => setPhase('flip-out')),
      after(1400, () => setPhase('flip-in')),
      after(1750, () => setPhase('revealed')),
      after(2000, () => {
        if (isBust) {
          setPhase('busting');
          new Audio('/sounds/busted.mp3').play().catch(() => {});
        } else if (secondChanceCard) {
          setPhase('sc-show');
        } else if (scDraw) {
          setPhase('sc-ascend');
        } else if (specialKind) {
          setPhase('special');
        } else if (canFly) {
          flyOrFinish();
        } else {
          finish();
        }
      }),
    ];
    if (card.type === 'freeze')    t.push(after(1750, () => new Audio('/sounds/freeze.mp3').play().catch(() => {})));
    if (card.type === 'flip_three')   t.push(after(1750, () => new Audio('/sounds/triple.mp3').play().catch(() => {})));
    if (card.type === 'second_chance') t.push(after(1750, () => new Audio('/sounds/2nd-chance.mp3').play().catch(() => {})));
    if (isFlippingHusks) t.push(after(1750, () => new Audio('/sounds/7-unique-numbers.mp3').play().catch(() => {})));
    if (isBust)          t.push(after(4000, finish));
    if (secondChanceCard) {
      // After the offending card holds briefly, slice it in half + play the save sound.
      t.push(after(2600, () => {
        setPhase('sc-exit');
        new Audio('/sounds/2nd-chance-activation.mp3').play().catch(() => {});
      }));
      t.push(after(2600 + SC_CUT_MS, finish));
    }
    if (canFly) t.push(after(2000 + FLY_MS, finish)); // fire once the fly lands
    if (scDraw) t.push(after(2000 + SC_ASCEND_MS, finish)); // ascension done → card delivered to the hand
    if (specialKind) {
      const specialMs =
        specialKind === 'flipped7' ? FLIPPED7_MS :
        specialKind === 'freeze'   ? FREEZE_MS :
        SPECIAL_MS;
      t.push(after(2000 + specialMs, finish)); // fire once the flourish ends
    }
    return () => t.forEach(clearTimeout);
    // card/isFlippingHusks/targetId are fixed for this animation's lifetime — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBust, secondChanceCard]);

  const inSCPhase = phase === 'sc-show' || phase === 'sc-exit';
  const isFlying  = phase === 'flying';
  const isSpecial = phase === 'special';
  const wrapClass = isFlying
    ? 'fhanim-flying'
    : (WRAP_PHASE_CLASS[phase] ?? 'fhanim-revealed')
      + (isSpecial && specialKind ? ` fhanim-scard fhanim-scard-${specialKind}` : '');
  const flipClass = FLIP_PHASE_CLASS[phase] ?? '';

  return (
    <div className={`fhanim-overlay ${isFlying ? 'fhanim-overlay-flying' : ''}`}>
      {phase === 'busting' && (
        <>
          <div className="fhanim-bust-flash" />
          <div className="fhanim-bust-shock" />
        </>
      )}

      {/* ── #6 Special reveals — flourish layers sit behind the card (z below the
          card-wrap); the banner sits above it (z above). ── */}
      {isSpecial && specialKind === 'flipped7' && (
        <>
          <div className="fhanim-rays" />
          <div className="fhanim-burst" />
          <div className="fhanim-special-banner fhanim-banner-gold">FLIPPED 7!</div>
        </>
      )}
      {isSpecial && specialKind === 'freeze' && (
        <>
          <div className="fhanim-frost" />
          <svg className="fhanim-cracks" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {FREEZE_CRACKS.map((c, i) => (
              <path
                key={i}
                className={`fhanim-crack${c.branch ? ' fhanim-crack-branch' : ''}`}
                d={c.d}
                pathLength="1"
              />
            ))}
          </svg>
          <svg className="fhanim-frost-aura" viewBox="0 0 480 620" aria-hidden="true">
            {FROST_AURA.map((d, i) => (
              <path key={i} className="fhanim-frost-line" d={d} pathLength="1" />
            ))}
          </svg>
          <div className="fhanim-special-banner fhanim-banner-ice">FREEZE</div>
        </>
      )}
      {isSpecial && specialKind === 'flip3' && (
        <>
          <div className="fhanim-sweep" />
          <div className="fhanim-fan fhanim-fan-l" />
          <div className="fhanim-fan fhanim-fan-r" />
          <div className="fhanim-special-banner fhanim-banner-purple">FLIP THREE!</div>
        </>
      )}

      {/* Holy pillar of light from above for the Second Chance draw — sits behind the
          ascending card (z below the card-wrap). */}
      {phase === 'sc-ascend' && <div className="fhanim-holy-beam" aria-hidden="true" />}

      {/* Single-card phases — both faces are always rendered and stacked; the 3D
          rotateY on the flipper decides which one the viewer sees. */}
      {!inSCPhase && (
        <div className={`fhanim-card-wrap ${wrapClass}`} style={isFlying && flyTransform ? { transform: flyTransform } : undefined}>
          <div className={`fhanim-flipper ${flipClass}`} style={{ pointerEvents: 'none' }}>
            <div className="fhanim-face fhanim-face-back">
              <FlippingHusksCard card={card} faceDown />
            </div>
            <div className="fhanim-face fhanim-face-front">
              <FlippingHusksCard card={card} />
            </div>
          </div>
          {/* "BUST" stamp lives inside the wrapper so it inherits the card's shake */}
          {phase === 'busting' && <div className="fhanim-bust-stamp">BUST</div>}
        </div>
      )}

      {/* Second-chance ACTIVATION — the offending (would-be-busting) card is shown, then
          sliced obliquely in two and the halves fall apart. Two clipped copies of the same
          card overlay to form the whole; the slash flashes along the cut. */}
      {inSCPhase && (
        <>
          <div className={`fhanim-sc-cutwrap ${phase === 'sc-exit' ? 'fhanim-sc-cutting' : 'fhanim-sc-appear'}`}>
            <div className="fhanim-sc-half fhanim-sc-half-top">
              <FlippingHusksCard card={card} />
            </div>
            <div className="fhanim-sc-half fhanim-sc-half-bottom">
              <FlippingHusksCard card={card} />
            </div>
            <div className="fhanim-sc-slash" />
          </div>
          <div className="fhanim-sc-label">SECOND CHANCE!</div>
        </>
      )}
    </div>
  );
}
