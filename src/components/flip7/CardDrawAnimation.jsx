import { useEffect, useRef, useState } from 'react';
import { Flip7Card } from './Flip7Card';
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
  falling:   'f7anim-falling',
  'flip-out':'f7anim-flip-out',
  'flip-in': 'f7anim-flip-in',
  revealed:  'f7anim-revealed',
  busting:   'f7anim-busting',
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
    <div className="f7anim-overlay">
      {phase === 'busting' && <div className="f7anim-bust-flash" />}

      {/* Single-card phases */}
      {!inSCPhase && (
        <div className={`f7anim-card-wrap ${mainClass ?? ''}`}>
          <div style={{ pointerEvents: 'none' }}>
            <Flip7Card card={card} faceDown={faceDown} />
          </div>
        </div>
      )}

      {/* Second-chance two-card display */}
      {inSCPhase && (
        <div className={`f7anim-sc-wrap ${phase === 'sc-exit' ? 'f7anim-sc-exit' : 'f7anim-sc-show'}`}>
          <div className="f7anim-sc-pair">
            <div style={{ pointerEvents: 'none' }}>
              <Flip7Card card={card} />
            </div>
            {secondChanceCard && (
              <>
                <div className="f7anim-sc-vs">★</div>
                <div style={{ pointerEvents: 'none' }}>
                  <Flip7Card card={secondChanceCard} />
                </div>
              </>
            )}
          </div>
          <div className="f7anim-sc-label">SECOND CHANCE!</div>
        </div>
      )}
    </div>
  );
}
