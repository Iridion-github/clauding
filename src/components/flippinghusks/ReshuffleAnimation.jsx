import { useEffect } from 'react';
import { currentAnimationFactor } from './settingsStore';
import './ReshuffleAnimation.css';

// Offset values (-3 to 3) control how far each card fans out from center
const CARDS = [-3, -2, -1, 0, 1, 2, 3];

export function ReshuffleAnimation({ onDone }) {
  // Scale the timeline and the staggered card delays by the saved animation speed.
  const factor = currentAnimationFactor();
  useEffect(() => {
    new Audio('/sounds/shuffle.mp3').play().catch(() => {});
    const t = setTimeout(onDone, 4000 * factor);
    return () => clearTimeout(t);
  }, [onDone, factor]);

  return (
    <div className="fh-rs-overlay">
      <div className="fh-rs-stage">
        <div className="fh-rs-deck">
          {CARDS.map((offset, i) => (
            <div
              key={i}
              className="fh-rs-card"
              style={{
                '--offset': offset,
                animationDelay: `${i * 90 * factor}ms`,
              }}
            />
          ))}
        </div>
        <p className="fh-rs-label">Reshuffling Deck…</p>
      </div>
    </div>
  );
}
