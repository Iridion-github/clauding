import { useEffect, useId, useState } from 'react';
import { currentAnimationFactor } from './settingsStore';
import './VictoryAnimation.css';

// How long the flourish stays up before auto-dismissing (ms, before the speed factor).
const VICTORY_MS = 5500;

const CONFETTI_COLORS = ['#f7d774', '#f0c040', '#c8900a', '#fff3c0', '#ffe08a', '#ffffff'];
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  left: Math.round(Math.random() * 100),
  delay: +(Math.random() * 2.2).toFixed(2),
  dur: +(2.4 + Math.random() * 1.9).toFixed(2),
  size: 7 + Math.round(Math.random() * 8),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

// One laurel branch curving up the side of the sphere. Rendered on the left as-is and
// mirrored on the right (CSS scaleX(-1)). Leaves are placed along a quadratic bezier so
// the branch reads as a continuous laurel rather than scattered leaves.
const L_P0 = [100, 286], L_P1 = [2, 150], L_P2 = [70, 14];
function lbz(t, i) { const m = 1 - t; return m * m * L_P0[i] + 2 * m * t * L_P1[i] + t * t * L_P2[i]; }
function ldz(t, i) { const m = 1 - t; return 2 * m * (L_P1[i] - L_P0[i]) + 2 * t * (L_P2[i] - L_P1[i]); }
const LEAF_TS = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90];

function Laurel({ className }) {
  const gid = `vicg-${useId().replace(/:/g, '')}`;
  return (
    <svg className={className} viewBox="0 0 130 300" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#8a5e00" />
          <stop offset="45%" stopColor="#e7b53e" />
          <stop offset="75%" stopColor="#ffe9a8" />
          <stop offset="100%" stopColor="#d39b14" />
        </linearGradient>
      </defs>
      <path
        d={`M${L_P0[0]},${L_P0[1]} Q${L_P1[0]},${L_P1[1]} ${L_P2[0]},${L_P2[1]}`}
        fill="none" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round"
      />
      {LEAF_TS.map((t, i) => {
        const x = lbz(t, 0), y = lbz(t, 1);
        const ang = Math.atan2(ldz(t, 1), ldz(t, 0)) * 180 / Math.PI;
        return (
          <g key={i} transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(ang - 90).toFixed(1)})`}>
            <ellipse rx="9.5" ry="23" fill={`url(#${gid})`} />
          </g>
        );
      })}
    </svg>
  );
}

export function VictoryAnimation({ name, avatar, winnerId, standings = [], onDone }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(onDone, VICTORY_MS * currentAnimationFactor());
    return () => clearTimeout(t);
  }, [onDone]);

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const showAvatar = avatar && !imgFailed;

  return (
    <div className="fhvic-overlay" onClick={onDone}>
      <div className="fhvic-rays" />

      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="fhvic-confetti"
          style={{
            left: `${c.left}vw`,
            width: `${c.size}px`,
            height: `${c.size * 1.6}px`,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.dur}s`,
          }}
        />
      ))}

      <div className="fhvic-title">VICTORY</div>

      <div className="fhvic-emblem">
        <Laurel className="fhvic-laurel fhvic-laurel-l" />
        <div className="fhvic-sphere">
          <div className="fhvic-sphere-inner">
            {showAvatar
              ? <img className="fhvic-avatar" src={avatar} alt="" draggable={false} onError={() => setImgFailed(true)} />
              : <span className="fhvic-fallback">{initial}</span>}
          </div>
        </div>
        <Laurel className="fhvic-laurel fhvic-laurel-r" />
      </div>

      <div className="fhvic-name">{name}</div>

      {standings.length > 0 && (
        <div className="fhvic-board">
          {standings.map((p) => (
            <div key={p.id} className={`fhvic-board-row${p.id === winnerId ? ' fhvic-board-win' : ''}`}>
              <span className="fhvic-board-name">{p.name}</span>
              <span className="fhvic-board-score">{p.score}</span>
            </div>
          ))}
        </div>
      )}

      <div className="fhvic-hint">tap to continue</div>
    </div>
  );
}
