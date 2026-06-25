import { useEffect } from 'react';
import { FlippingHusksCard } from './FlippingHusksCard';
import { currentAnimationFactor } from './settingsStore';
import { playFx } from './soundFx';
import './ReshuffleAnimation.css';

// A ring of real (face-down) card backs that burst out of a stack, swirl a full turn,
// then collapse back into a neat deck. 12 cards spaced 30° apart around the ring.
const CARDS = Array.from({ length: 12 }, (_, i) => i);
const RS_CARD = { id: 'rs', type: 'number', value: 0 }; // dummy; only the BACK is shown

// Twinkling sparkles scattered over the screen: [leftVW, topVH, delaySec, sizePx].
const SPARKLES = [
  [16, 24, 0.0, 11], [82, 18, 0.5, 8],  [30, 72, 0.9, 13], [70, 76, 0.25, 9],
  [50, 12, 0.7, 7],  [10, 50, 1.1, 12], [90, 56, 0.35, 8], [44, 90, 1.0, 10],
  [63, 38, 0.55, 7], [24, 40, 1.3, 9],  [78, 86, 0.8, 8],  [54, 62, 0.15, 7],
  [38, 22, 0.6, 8],  [88, 40, 1.2, 10],
];

export function ReshuffleAnimation({ onDone }) {
  // Scale the timeline and the staggered card delays by the saved animation speed.
  const factor = currentAnimationFactor();
  useEffect(() => {
    playFx('shuffle');
    const t = setTimeout(onDone, 5000 * factor);
    return () => clearTimeout(t);
  }, [onDone, factor]);

  return (
    <div className="fh-rs-overlay">
      <div className="fh-rs-rays" />
      <div className="fh-rs-glow" />

      <div className="fh-rs-deck">
        {CARDS.map((i) => (
          <div
            key={i}
            className="fh-rs-card"
            style={{ '--angle': `${i * 30}deg`, animationDelay: `${i * 45 * factor}ms` }}
          >
            <FlippingHusksCard card={RS_CARD} faceDown />
          </div>
        ))}
      </div>

      {SPARKLES.map(([x, y, d, s], i) => (
        <span
          key={i}
          className="fh-rs-spark"
          style={{ left: `${x}vw`, top: `${y}vh`, '--s': `${s}px`, animationDelay: `${d * factor}s` }}
        />
      ))}

      <p className="fh-rs-label">Reshuffling Deck…</p>
    </div>
  );
}
