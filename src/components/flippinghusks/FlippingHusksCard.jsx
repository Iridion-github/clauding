import './FlippingHusksCard.css';

// Number card styles: background gradient, text color, glow color, pip symbol
const NUMBER_STYLES = [
  { bg: 'linear-gradient(160deg,#1a4a8a,#0d2f5c)', text: '#cce4ff', glow: '#1565c0', sym: '◆', riskColor: '#64b5f6' }, // 0
  { bg: 'linear-gradient(160deg,#1565c0,#0d47a1)', text: '#ddeeff', glow: '#1976d2', sym: '◆', riskColor: '#64b5f6' }, // 1
  { bg: 'linear-gradient(160deg,#00695c,#004d40)', text: '#b2dfdb', glow: '#00796b', sym: '◈', riskColor: '#4db6ac' }, // 2
  { bg: 'linear-gradient(160deg,#2e7d32,#1b5e20)', text: '#c8e6c9', glow: '#388e3c', sym: '◈', riskColor: '#81c784' }, // 3
  { bg: 'linear-gradient(160deg,#558b2f,#33691e)', text: '#dcedc8', glow: '#689f38', sym: '◉', riskColor: '#aed581' }, // 4
  { bg: 'linear-gradient(160deg,#9e6c00,#795500)', text: '#fff9c4', glow: '#f9a825', sym: '◉', riskColor: '#fff176' }, // 5
  { bg: 'linear-gradient(160deg,#b35000,#8c3400)', text: '#ffe0b2', glow: '#f57f17', sym: '▲', riskColor: '#ffb74d' }, // 6
  { bg: 'linear-gradient(160deg,#c84000,#9a2c00)', text: '#ffd0b0', glow: '#e65100', sym: '▲', riskColor: '#ff8a65' }, // 7
  { bg: 'linear-gradient(160deg,#b71c1c,#8b0000)', text: '#ffcdd2', glow: '#c62828', sym: '⬥', riskColor: '#ef9a9a' }, // 8
  { bg: 'linear-gradient(160deg,#a01515,#720000)', text: '#ffcdd2', glow: '#b71c1c', sym: '⬥', riskColor: '#e57373' }, // 9
  { bg: 'linear-gradient(160deg,#880e4f,#5c0035)', text: '#f8bbd0', glow: '#ad1457', sym: '★', riskColor: '#f48fb1' }, // 10
  { bg: 'linear-gradient(160deg,#6a1b9a,#4a0072)', text: '#e1bee7', glow: '#7b1fa2', sym: '★', riskColor: '#ce93d8' }, // 11
  { bg: 'linear-gradient(160deg,#4a148c,#2a0060)', text: '#e8d5ff', glow: '#6a1b9a', sym: '✦', riskColor: '#b39ddb' }, // 12
];

const SPECIAL_STYLES = {
  modifier:      { bg: 'linear-gradient(160deg,#00838f,#005662)', text: '#e0f7fa', glow: '#0097a7', sym: '+', icon: null },
  multiplier:    { bg: 'linear-gradient(160deg,#bf360c,#870000)', text: '#fff8e1', glow: '#e64a19', sym: '×', icon: '×2' },
  freeze:        { bg: 'linear-gradient(160deg,#0277bd,#01579b)', text: '#e1f5fe', glow: '#039be5', sym: '❄', icon: '❄' },
  flip_three:    { bg: 'linear-gradient(160deg,#6a1b9a,#38006b)', text: '#f3e5f5', glow: '#8e24aa', sym: '↺', icon: '↺' },
  second_chance: { bg: 'linear-gradient(160deg,#1b5e20,#0a3d12)', text: '#e8f5e9', glow: '#2e7d32', sym: '★', icon: '★' },
};

const RISK_LABELS = ['SAFE','SAFE','LOW','LOW','LOW','MED','MED','HIGH','HIGH','HIGH','MAX','MAX','MAX'];
const DECK_COUNTS = [1,1,2,3,4,5,6,7,8,9,10,11,12];

export function FlippingHusksCard({ card, faceDown = false, small = false, highlight = false }) {
  if (!card) return null;

  if (faceDown) {
    return (
      <div className={`fhcard fhcard-back${small ? ' fhcard-small' : ''}`}>
        <div className="fhcard-back-pattern" />
      </div>
    );
  }

  if (card.type === 'number') return <NumberCard card={card} small={small} highlight={highlight} />;
  return <SpecialCard card={card} small={small} highlight={highlight} />;
}

function NumberCard({ card, small, highlight }) {
  const s = NUMBER_STYLES[card.value] ?? NUMBER_STYLES[12];
  const riskPct = Math.round((card.value / 12) * 100);
  const count = DECK_COUNTS[card.value];

  return (
    <div
      className={`fhcard${small ? ' fhcard-small' : ''}${highlight ? ' fhcard-highlight' : ''}`}
      style={{ background: s.bg, color: s.text, boxShadow: `0 6px 20px ${s.glow}66` }}
    >
      <div className="fhcard-pip fhcard-pip-tl">
        <div className="fhcard-pip-val">{card.label}</div>
        <div className="fhcard-pip-sym">{s.sym}</div>
      </div>

      <div className="fhcard-center">
        <div className="fhcard-watermark">◆</div>
        <div className="fhcard-main-value">{card.label}</div>
        <div className="fhcard-sub">{RISK_LABELS[card.value]} RISK</div>
        <div className="fhcard-risk-bar-wrap">
          <div
            className="fhcard-risk-bar-fill"
            style={{ width: `${riskPct}%`, background: s.riskColor }}
          />
        </div>
        <div className="fhcard-deck-count">×{count} in deck</div>
      </div>

      <div className="fhcard-pip fhcard-pip-br">
        <div className="fhcard-pip-val">{card.label}</div>
        <div className="fhcard-pip-sym">{s.sym}</div>
      </div>
    </div>
  );
}

function SpecialCard({ card, small, highlight }) {
  const s = SPECIAL_STYLES[card.type] ?? { bg: '#333', text: '#fff', glow: '#555', sym: '?', icon: '?' };
  const isModifier = card.type === 'modifier';
  const label = specialLabel(card);
  const sub   = specialSub(card);

  return (
    <div
      className={`fhcard${small ? ' fhcard-small' : ''}${highlight ? ' fhcard-highlight' : ''}`}
      style={{ background: s.bg, color: s.text, boxShadow: `0 6px 20px ${s.glow}66` }}
    >
      <div className="fhcard-pip fhcard-pip-tl">
        <div className="fhcard-pip-val">{isModifier ? card.label : s.sym}</div>
        <div className="fhcard-pip-sym">{card.type === 'second_chance' ? 'SC' : card.type === 'flip_three' ? 'F3' : card.type.slice(0,2).toUpperCase()}</div>
      </div>

      <div className="fhcard-center">
        <div className="fhcard-watermark">{s.sym}</div>
        {s.icon && <div className="fhcard-icon">{isModifier ? null : s.icon}</div>}
        <div className="fhcard-main-value" style={{ fontSize: isModifier ? '44px' : '36px', letterSpacing: 0 }}>
          {label}
        </div>
        {sub && <div className="fhcard-sub">{sub}</div>}
      </div>

      <div className="fhcard-pip fhcard-pip-br">
        <div className="fhcard-pip-val">{isModifier ? card.label : s.sym}</div>
        <div className="fhcard-pip-sym">{card.type === 'second_chance' ? 'SC' : card.type === 'flip_three' ? 'F3' : card.type.slice(0,2).toUpperCase()}</div>
      </div>
    </div>
  );
}

function specialLabel(card) {
  switch (card.type) {
    case 'modifier':      return card.label;
    case 'multiplier':    return '×2';
    case 'freeze':        return '❄';
    case 'flip_three':    return '↺3';
    case 'second_chance': return '★';
    default:              return '?';
  }
}

function specialSub(card) {
  switch (card.type) {
    case 'modifier':      return 'BONUS';
    case 'multiplier':    return 'DOUBLE';
    case 'freeze':        return 'FREEZE';
    case 'flip_three':    return 'FLIP 3';
    case 'second_chance': return '2ND CHANCE';
    default:              return '';
  }
}

export { NUMBER_STYLES, SPECIAL_STYLES };
