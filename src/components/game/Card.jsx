import './Card.css';

const COLOR_BG = {
  white: '#fffbe6', blue: '#ddeeff', black: '#2a2a2a',
  red: '#ffe6e6', green: '#e6ffe6',
};
const COLOR_TEXT = { black: '#eee' };
const COLOR_SYMBOL = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G', colorless: '' };

export function Card({ card, onClick, selected, playable }) {
  if (!card) return null;

  const primaryColor = card.colors?.[0] || null;
  const bg = primaryColor ? (COLOR_BG[primaryColor] || '#f0f0f0') : '#e8e8e8';
  const textColor = primaryColor ? (COLOR_TEXT[primaryColor] || '#111') : '#111';

  const classNames = [
    'card',
    card.tapped ? 'tapped' : '',
    selected ? 'selected' : '',
    playable ? 'playable' : '',
    card.attacking ? 'attacking' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      style={{ background: bg, color: textColor }}
      onClick={() => onClick?.(card)}
    >
      <div className="card-header">
        <span className="card-name">{card.name}</span>
        <span className="card-cost">{formatCost(card.cost)}</span>
      </div>
      <div className="card-type">{formatType(card)}</div>
      {card.text && <div className="card-text">{card.text}</div>}
      {card.type === 'creature' && (
        <div className="card-pt">
          {card.power}/{card.toughness}
          {card.damage > 0 && <span className="card-damage"> (-{card.damage})</span>}
        </div>
      )}
      {card.tapped && <div className="card-overlay-label">TAPPED</div>}
      {card.summoningSickness && <div className="card-overlay-label sick">SICK</div>}
    </div>
  );
}

export function formatCost(cost) {
  if (!cost) return '';
  const parts = [];
  if (cost.colorless) parts.push(String(cost.colorless));
  for (const [c, n] of Object.entries(cost)) {
    if (c === 'colorless') continue;
    parts.push(COLOR_SYMBOL[c]?.repeat(n) ?? '');
  }
  return parts.join('');
}

function formatType(card) {
  const sub = card.subtype?.join(' ') || '';
  return sub ? `${card.type} — ${sub}` : card.type;
}
