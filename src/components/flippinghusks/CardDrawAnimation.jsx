import { useEffect, useRef, useState } from 'react';
import { FlippingHusksCard } from './FlippingHusksCard';
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

export function CardDrawAnimation({ card, isBust, secondChanceCard, onDone }) {
  const [phase, setPhase] = useState('falling');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = [
      setTimeout(() => setPhase('flip-out'), 1200),
      setTimeout(() => setPhase('flip-in'),  1400),
      setTimeout(() => setPhase('revealed'), 1750),
      setTimeout(() => {
        if (isBust)             setPhase('busting');
        else if (secondChanceCard) setPhase('sc-show');
        else                    onDoneRef.current();
      }, 2000),
    ];
    if (isBust)          t.push(setTimeout(() => onDoneRef.current(), 4000));
    if (secondChanceCard) {
      t.push(setTimeout(() => setPhase('sc-exit'), 4000));
      t.push(setTimeout(() => onDoneRef.current(), 5000));
    }
    return () => t.forEach(clearTimeout);
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
