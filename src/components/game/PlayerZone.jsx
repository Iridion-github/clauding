import { Card } from './Card';
import './PlayerZone.css';

const MANA_COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless'];
const MANA_SYMBOL = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G', colorless: 'C' };

export function PlayerZone({ player, isMe, selectedCard, onCardClick, attackerIds, blockerIds }) {
  if (!player) return null;

  return (
    <div className={`player-zone ${isMe ? 'zone-me' : 'zone-opponent'}`}>
      <div className="zone-info">
        <span className="zone-name">{player.name}</span>
        <span className="zone-life">♥ {player.life}</span>
        <span className="zone-library">Library: {player.library.length}</span>
        <span className="zone-graveyard">GY: {player.graveyard.length}</span>
        <ManaDisplay mana={player.mana} maxMana={player.maxMana} />
      </div>

      <div className="zone-battlefield">
        <span className="zone-label">Battlefield</span>
        <div className="zone-cards">
          {player.battlefield.map(card => (
            <Card
              key={card.id}
              card={card}
              onClick={onCardClick}
              selected={selectedCard?.id === card.id}
              playable={attackerIds?.includes(card.id) || blockerIds?.includes(card.id)}
            />
          ))}
        </div>
      </div>

      {isMe && (
        <div className="zone-hand">
          <span className="zone-label">Hand ({player.hand.length})</span>
          <div className="zone-cards">
            {player.hand.map(card => (
              <Card
                key={card.id}
                card={card}
                onClick={onCardClick}
                selected={selectedCard?.id === card.id}
              />
            ))}
          </div>
        </div>
      )}

      {!isMe && (
        <div className="zone-hand-hidden">
          <span className="zone-label">Hand: {player.hand.length} cards</span>
          <div className="hand-hidden-cards">
            {player.hand.map(card => (
              <div key={card.id} className="card-back" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManaDisplay({ mana, maxMana }) {
  const hasAny = MANA_COLORS.some(c => (maxMana?.[c] || 0) > 0);
  if (!hasAny) return <span className="mana-empty">No mana</span>;

  return (
    <div className="mana-display">
      {MANA_COLORS.map(c => {
        const current = mana?.[c] || 0;
        const max = maxMana?.[c] || 0;
        if (max === 0 && current === 0) return null;
        return (
          <span key={c} className={`mana-pip mana-${c}`}>
            {MANA_SYMBOL[c]}: {current}/{max}
          </span>
        );
      })}
    </div>
  );
}
