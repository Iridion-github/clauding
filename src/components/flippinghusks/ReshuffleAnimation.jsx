import { useEffect } from 'react';
import './ReshuffleAnimation.css';

// Offset values (-3 to 3) control how far each card fans out from center
const CARDS = [-3, -2, -1, 0, 1, 2, 3];

export function ReshuffleAnimation({ onDone }) {
  useEffect(() => {
    new Audio('/sounds/shuffle.mp3').play().catch(() => {});
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

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
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </div>
        <p className="fh-rs-label">Reshuffling Deck…</p>
      </div>
    </div>
  );
}
