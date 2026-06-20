import { useEffect, useRef, useState } from 'react';
import { FlippingHusksCard } from './FlippingHusksCard';
import { currentAnimationFactor } from './settingsStore';
import './CardDrawAnimation.css';

// Phase timeline (ms):
//   falling    0 – 1200   face-down card falls from top
//   flip-out   1200 – 1400  face-down scaleX 1 → 0
//   flip-in    1400 – 1750  face-up  scaleX 0 → 1
//   revealed   1750 – 2000  hold at centre (2 s total draw)
//   ── then one of: ──
//   busting    2000 – 4000  trembling ±10° (isBust)          → done at 4000
//   sc-show    2000 – 4000  both cards shown (secondChance)   → sc-exit
//   sc-exit    4000 – 5000  both cards slide up               → done at 5000

const MAIN_PHASE_CLASS = {
  falling:   'fhanim-falling',
  'flip-out':'fhanim-flip-out',
  'flip-in': 'fhanim-flip-in',
  revealed:  'fhanim-revealed',
  busting:   'fhanim-busting',
};

export function CardDrawAnimation({ card, isBust, isFlippingHusks, secondChanceCard, onDone }) {
  const [phase, setPhase] = useState('falling');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const audio = new Audio('/sounds/card-flipping.mp3');
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    // Scale every phase timing by the saved speed so the JS timeline stays in sync
    // with the CSS durations (which scale via the --fh-anim-speed variable).
    const f = currentAnimationFactor();
    const after = (ms, fn) => setTimeout(fn, ms * f);
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
        } else {
          onDoneRef.current();
        }
      }),
    ];
    if (card.type === 'freeze')    t.push(after(1750, () => new Audio('/sounds/freeze.mp3').play().catch(() => {})));
    if (card.type === 'flip_three')   t.push(after(1750, () => new Audio('/sounds/triple.mp3').play().catch(() => {})));
    if (card.type === 'second_chance') t.push(after(1750, () => new Audio('/sounds/2nd-chance.mp3').play().catch(() => {})));
    if (isFlippingHusks) t.push(after(1750, () => new Audio('/sounds/7-unique-numbers.mp3').play().catch(() => {})));
    if (isBust)          t.push(after(4000, () => onDoneRef.current()));
    if (secondChanceCard) {
      t.push(after(4000, () => setPhase('sc-exit')));
      t.push(after(5000, () => onDoneRef.current()));
    }
    return () => t.forEach(clearTimeout);
    // card/isFlippingHusks are fixed for this animation's lifetime — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBust, secondChanceCard]);

  const faceDown   = phase === 'falling' || phase === 'flip-out';
  const inSCPhase  = phase === 'sc-show'  || phase === 'sc-exit';
  const mainClass  = MAIN_PHASE_CLASS[phase];

  return (
    <div className="fhanim-overlay">
      {phase === 'busting' && <div className="fhanim-bust-flash" />}

      {/* Single-card phases */}
      {!inSCPhase && (
        <div className={`fhanim-card-wrap ${mainClass ?? ''}`}>
          <div style={{ pointerEvents: 'none' }}>
            <FlippingHusksCard card={card} faceDown={faceDown} />
          </div>
        </div>
      )}

      {/* Second-chance two-card display */}
      {inSCPhase && (
        <div className={`fhanim-sc-wrap ${phase === 'sc-exit' ? 'fhanim-sc-exit' : 'fhanim-sc-show'}`}>
          <div className="fhanim-sc-pair">
            <div style={{ pointerEvents: 'none' }}>
              <FlippingHusksCard card={card} />
            </div>
            {secondChanceCard && (
              <>
                <div className="fhanim-sc-vs">★</div>
                <div style={{ pointerEvents: 'none' }}>
                  <FlippingHusksCard card={secondChanceCard} />
                </div>
              </>
            )}
          </div>
          <div className="fhanim-sc-label">SECOND CHANCE!</div>
        </div>
      )}
    </div>
  );
}
